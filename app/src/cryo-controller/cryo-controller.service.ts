import { CryoRequest, CryoResponse } from './cryo-controller.interface';
import { ConfigService } from '../config/config.service';
import { LoggerService } from '../logger/logger.service';
import { StateManagerService } from '../state-manager/state-manager.service';
import { Ec2Service } from '../ec2/ec2.service';
import { RdsService } from '../rds/rds.service';
import { EcsService } from '../ecs/ecs.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { EventBridgeService } from '../eventbridge/eventbridge.service';
import { ApiGatewayService } from '../api-gateway/api-gateway.service';

export class CryoControllerService {
    private readonly stateManager: StateManagerService;
    private readonly ec2Service: Ec2Service;
    private readonly rdsService: RdsService;
    private readonly ecsService: EcsService;
    private readonly schedulerService: SchedulerService;
    private readonly eventBridgeService: EventBridgeService;
    private readonly apiGatewayService: ApiGatewayService;

    constructor(
        private readonly config: ConfigService,
        private readonly logger: LoggerService
    ) {
        const cryoConfig = this.config.getConfig();
        const retryConfig = this.config.getRetryConfig();
        
        this.stateManager = new StateManagerService(logger, config);
        this.ec2Service = new Ec2Service(cryoConfig.ec2InstanceIds, retryConfig.ec2, logger);
        this.rdsService = new RdsService(cryoConfig.rdsResources, retryConfig.rds, logger);
        this.ecsService = new EcsService(cryoConfig.ecsClusters, retryConfig.ecs, this.stateManager, logger);
        this.eventBridgeService = new EventBridgeService(cryoConfig.ruleNames, logger);
        this.apiGatewayService = new ApiGatewayService(cryoConfig.apiGateways, logger);
        this.schedulerService = new SchedulerService(
            cryoConfig.autoDisableRuleName,
            cryoConfig.completionCheck.name,
            cryoConfig.rdsListenerRuleNames,
            logger
        );
    }

    async handle(request: CryoRequest): Promise<CryoResponse> {
        this.logger.info('[CryoControllerService] Handling Cryo request', { type: request.type });

        try {
            switch (request.type) {
                case 'enable':
                    return await this.handleEnable(request.duration);
                case 'disable':
                    return await this.handleDisable();
                case 'save':
                    return await this.handleSave();
                case 'reconcile':
                    return await this.handleReconcile(request.source, request.clusterIdentifier);
                default:
                    throw new Error(`Unknown request type: ${(request as any).type}`);
            }
        } catch (error: any) {
            this.logger.error('[CryoControllerService] Cryo request failed', {
                type: request.type,
                error: error.message,
                stack: error.stack,
            });
            return { success: false, message: `[CryoControllerService] ${error.message}` };
        }
    }

    private async handleEnable(durationStr: string): Promise<CryoResponse> {
        const currentState = await this.stateManager.getState();
        const duration = Number.parseInt(durationStr, 10);

        if (currentState === 'enabled') {
            this.logger.info('[CryoControllerService] Environment already enabled, skipping');
            return { success: true, message: '[CryoControllerService] Environment already enabled' };
        }

        if (currentState === 'enabling') {
            this.logger.info('[CryoControllerService] Environment already enabling, skipping');
            return { success: true, message: '[CryoControllerService] Environment is currently enabling' };
        }

        this.logger.info('[CryoControllerService] Enabling environment (fire-and-forget)', { duration: durationStr });

        await this.stateManager.setState('enabling');
        await this.stateManager.resetCompletionCheckAttempts();
        await this.schedulerService.disableRdsListeners();

        await Promise.all([
            this.ec2Service.startNoWait(),
            this.rdsService.startNoWait(),
            this.ecsService.scaleUpNoWait(),
            this.eventBridgeService.enableRules(),
            this.apiGatewayService.enableApiMappings(),
        ]);

        await this.schedulerService.enableCompletionCheck();
        await this.schedulerService.scheduleDisable(duration);

        this.logger.info('[CryoControllerService] Enable commands issued, completion check enabled', { duration });
        return {
            success: true,
            message: `[CryoControllerService] Environment enable initiated for ${duration} days. Check in progress.`,
        };
    }

    private async handleDisable(): Promise<CryoResponse> {
        const currentState = await this.stateManager.getState();

        if (currentState === 'disabled') {
            this.logger.info('[CryoControllerService] Environment already disabled, skipping');
            return { success: true, message: '[CryoControllerService] Environment already disabled' };
        }

        if (currentState === 'disabling') {
            this.logger.info('[CryoControllerService] Environment already disabling, skipping');
            return { success: true, message: '[CryoControllerService] Environment is currently disabling' };
        }

        this.logger.info('[CryoControllerService] Disabling environment (fire-and-forget)');

        await this.stateManager.setState('disabling');
        await this.stateManager.resetCompletionCheckAttempts();
        await this.schedulerService.enableRdsListeners();

        await Promise.all([
            this.ecsService.scaleDownNoWait(),
            this.ec2Service.stopNoWait(),
            this.rdsService.stopNoWait(),
            this.eventBridgeService.disableRules(),
            this.apiGatewayService.disableApiMappings(),
        ]);

        await this.schedulerService.enableCompletionCheck();
        await this.schedulerService.disableScheduler();

        this.logger.info('[CryoControllerService] Disable commands issued, completion check enabled');
        return { success: true, message: '[CryoControllerService] Environment disable initiated. Check in progress.' };
    }

    private async handleSave(): Promise<CryoResponse> {
        this.logger.info('[CryoControllerService] Saving ECS desired counts');
        await this.ecsService.saveDesiredCounts();
        this.logger.info('[CryoControllerService] ECS desired counts saved successfully');
        return { success: true, message: '[CryoControllerService] ECS desired counts saved' };
    }

    private async handleCompletionCheck(currentState: string): Promise<CryoResponse> {
        const transitionalStates = ['enabling', 'disabling'];
        const completionCheckConfig = this.config.getConfig().completionCheck;
        const maxAttempts = completionCheckConfig.maxAttempts;
        const delayMinutes = completionCheckConfig.delayMinutes;

        if (!transitionalStates.includes(currentState)) {
            this.logger.info('[CryoControllerService] Not in transitional state, disabling completion check', { currentState });
            await this.schedulerService.disableCompletionCheck();
            return { success: true, message: '[CryoControllerService] Already completed, check disabled' };
        }

        const attempts = await this.stateManager.getCompletionCheckAttempts();

        if (attempts >= maxAttempts) {
            this.logger.error('[CryoControllerService] Operation timed out after max attempts', {
                attempts,
                maxAttempts,
                currentState,
            });
            await this.schedulerService.disableCompletionCheck();
            await this.stateManager.resetCompletionCheckAttempts();
            return {
                success: false,
                message: `[CryoControllerService] Operation timed out after ${maxAttempts * delayMinutes} minutes`,
            };
        }

        await this.stateManager.incrementCompletionCheckAttempts();

        const desiredState = currentState === 'enabling' ? 'enabled' : 'disabled';

        this.logger.info('[CryoControllerService] Checking completion', {
            currentState,
            desiredState,
            attempt: attempts + 1,
            maxAttempts,
        });

        const allReady = await this.checkAllResourcesReady(currentState);

        if (allReady) {
            this.logger.info('[CryoControllerService] All resources ready, operation complete', {
                finalState: desiredState,
            });

            await this.stateManager.setState(desiredState);
            await this.schedulerService.disableCompletionCheck();
            await this.stateManager.resetCompletionCheckAttempts();

            return {
                success: true,
                message: `[CryoControllerService] Environment ${desiredState} successfully`,
            };
        }

        this.logger.info(`[CryoControllerService] Resources not ready yet, will check again in ${delayMinutes} minutes`, {
            attempt: attempts + 1,
            maxAttempts,
        });

        return {
            success: true,
            message: `[CryoControllerService] Still in progress (attempt ${attempts + 1}/${maxAttempts})`,
        };
    }

    private async checkAllResourcesReady(currentState: string): Promise<boolean> {
        if (currentState === 'enabling') {
            const [ec2Ready, rdsReady, ecsReady] = await Promise.all([
                this.ec2Service.checkAllInState('running'),
                this.rdsService.checkAllInState('available'),
                this.ecsService.checkAllServicesStable('up'),
            ]);

            this.logger.info('[CryoControllerService] Resource readiness check (enabling)', {
                ec2Ready,
                rdsReady,
                ecsReady,
            });

            return ec2Ready && rdsReady && ecsReady;
        } else {
            const [ec2Ready, rdsReady, ecsReady] = await Promise.all([
                this.ec2Service.checkAllInState('stopped'),
                this.rdsService.checkAllInState('stopped'),
                this.ecsService.checkAllServicesStable('down'),
            ]);

            this.logger.info('[CryoControllerService] Resource readiness check (disabling)', {
                ec2Ready,
                rdsReady,
                ecsReady,
            });

            return ec2Ready && rdsReady && ecsReady;
        }
    }

    private async handleReconcile(source?: string, clusterIdentifier?: string): Promise<CryoResponse> {
        const isRdsAutoRestart = source === 'rds-auto-restart';
        const isCompletionCheck = source === 'completion-check';
        const desiredState = await this.stateManager.getState();
        const transitionalStates = ['enabling', 'disabling'];

        this.logger.info('[CryoControllerService] Reconciling environment', { desiredState, source, clusterIdentifier });

        if (isCompletionCheck) {
            return await this.handleCompletionCheck(desiredState);
        }
        
        if (transitionalStates.includes(desiredState)) {
            this.logger.info('[CryoControllerService] Environment in transitional state, skipping reconciliation', {
                state: desiredState,
            });
            return {
                success: true,
                message: `[CryoControllerService] Environment is ${desiredState}, reconciliation skipped`,
            };
        }

        if (isRdsAutoRestart && clusterIdentifier) {
            if (desiredState === 'enabled') {
                this.logger.info('[CryoControllerService] Desired state is enabled, skipping RDS cluster reconciliation', {
                    clusterIdentifier,
                });
                return {
                    success: true,
                    message: `[CryoControllerService] Environment is enabled, cluster ${clusterIdentifier} reconciliation skipped`,
                };
            }

            this.logger.info('[CryoControllerService] Reconciling single RDS cluster (auto-restart mode)', {
                clusterIdentifier,
            });
            await this.rdsService.reconcileSingleCluster(clusterIdentifier, 'stopped', true);

            return {
                success: true,
                message: `[CryoControllerService] RDS cluster ${clusterIdentifier} reconciled (auto-restart)`,
            };
        }

        if (desiredState === 'enabled') {
            this.logger.info('[CryoControllerService] Reconciling to enabled state');
            await Promise.all([
                this.ec2Service.reconcile('running'),
                this.rdsService.reconcile('available', false),
                this.ecsService.reconcile('up'),
                this.eventBridgeService.enableRules(),
                this.apiGatewayService.enableApiMappings(),
            ]);
        } else {
            this.logger.info('[CryoControllerService] Reconciling to disabled state');
            await Promise.all([
                this.ecsService.reconcile('down'),
                this.ec2Service.reconcile('stopped'),
                this.rdsService.reconcile('stopped', false),
                this.eventBridgeService.disableRules(),
                this.apiGatewayService.disableApiMappings(),
            ]);
        }

        this.logger.info('[CryoControllerService] Environment reconciled successfully', { desiredState });
        return {
            success: true,
            message: `[CryoControllerService] Environment reconciled to ${desiredState} state`,
        };
    }
}

