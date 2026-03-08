import { Context } from 'aws-lambda';
import {
    CryoRequest,
    CryoResponse,
    ENVIRONMENT_STATES,
    RECONCILE_SOURCES,
    REQUEST_TYPES,
    TRANSITIONAL_STATES,
    RESPONSE_MESSAGE_PREFIX,
    RESOURCE_READINESS_STATES,
    CRYO_CONTROLLER_LOG_MESSAGES as LOG,
} from './cryo-controller.interface';
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
        private readonly logger: LoggerService,
        private readonly context?: Context
    ) {
        const cryoConfig = this.config.getConfig();
        const retryConfig = this.config.getRetryConfig();

        this.stateManager = new StateManagerService(config, this.context);
        this.ec2Service = new Ec2Service(cryoConfig.ec2InstanceIds, this.context);
        this.rdsService = new RdsService(cryoConfig.rdsResources, retryConfig.rds, this.context);
        this.ecsService = new EcsService(cryoConfig.ecsClusters, this.stateManager, this.context);
        this.eventBridgeService = new EventBridgeService(cryoConfig.ruleNames, this.context);
        this.apiGatewayService = new ApiGatewayService(cryoConfig.apiGateways, this.context);
        this.schedulerService = new SchedulerService(
            cryoConfig.autoDisableRuleName,
            cryoConfig.completionCheck.name,
            cryoConfig.rdsListenerRuleNames,
            this.context
        );
    }

    async handle(request: CryoRequest): Promise<CryoResponse> {
        this.logger.info(LOG.HANDLING_REQUEST, { type: request.type });

        try {
            switch (request.type) {
                case REQUEST_TYPES.ENABLE:
                    return await this.handleEnable(request.durationDays, request.endDateTime);
                case REQUEST_TYPES.DISABLE:
                    return await this.handleDisable();
                case REQUEST_TYPES.SAVE:
                    return await this.handleSave();
                case REQUEST_TYPES.RECONCILE:
                    return await this.handleReconcile(request.source, request.clusterIdentifier);
                default:
                    throw new Error(`${LOG.UNKNOWN_REQUEST_TYPE}: ${(request as any).type}`);
            }
        } catch (error: any) {
            this.logger.error(LOG.REQUEST_FAILED, {
                type: request.type,
                error: error.message,
                stack: error.stack,
            });
            return { success: false, message: this.formatResponseMessage(error.message) };
        }
    }

    private async handleEnable(durationDays?: string, endDateTime?: string): Promise<CryoResponse> {
        const currentState = await this.stateManager.getState();

        if (currentState === ENVIRONMENT_STATES.ENABLED) {
            this.logger.info(LOG.ALREADY_ENABLED);
            return { success: true, message: this.formatResponseMessage(LOG.ALREADY_ENABLED_MSG) };
        }

        if (currentState === ENVIRONMENT_STATES.ENABLING) {
            this.logger.info(LOG.ALREADY_ENABLING);
            return { success: true, message: this.formatResponseMessage(LOG.ALREADY_ENABLING_MSG) };
        }

        this.logger.info(LOG.ENABLING_ENVIRONMENT, { durationDays, endDateTime });

        await this.stateManager.setState(ENVIRONMENT_STATES.ENABLING);
        await this.stateManager.resetCompletionCheckAttempts();
        await this.schedulerService.disableRdsListeners();

        try {
            await Promise.all([
                this.ec2Service.startAllInstancesWithoutWaiting(),
                this.rdsService.startAllResourcesWithoutWaiting(),
                this.ecsService.scaleUpAllServicesWithoutWaiting(),
                this.eventBridgeService.enableAllRules(),
                this.apiGatewayService.enableAllApiMappings(),
            ]);

            await this.schedulerService.enableCompletionCheck();

            if (endDateTime) {
                const parsedDate = new Date(endDateTime);
                if (!Number.isFinite(parsedDate.getTime())) {
                    throw new Error(`${LOG.INVALID_SCHEDULE}: invalid endDateTime format: ${endDateTime}`);
                }
                await this.schedulerService.scheduleDisable(undefined, endDateTime);
            } else if (durationDays) {
                const duration = Number.parseInt(durationDays, 10);
                if (!Number.isFinite(duration) || duration <= 0) {
                    throw new Error(`${LOG.INVALID_SCHEDULE}: durationDays must be a positive integer, got: ${durationDays}`);
                }
                await this.schedulerService.scheduleDisable(duration);
            }
        } catch (error: any) {
            await this.stateManager.setState(ENVIRONMENT_STATES.DISABLED);
            await this.schedulerService.enableRdsListeners();
            await this.schedulerService.disableCompletionCheck();
            await this.stateManager.resetCompletionCheckAttempts();
            throw error;
        }

        this.logger.info(LOG.ENABLE_COMMANDS_ISSUED, { durationDays, endDateTime });
        return {
            success: true,
            message: this.formatResponseMessage(
                `${LOG.ENABLE_INITIATED} ${this.buildScheduleInfo(durationDays, endDateTime)}. Check in progress.`
            ),
        };
    }

    private async handleDisable(): Promise<CryoResponse> {
        const currentState = await this.stateManager.getState();

        if (currentState === ENVIRONMENT_STATES.DISABLED) {
            this.logger.info(LOG.ALREADY_DISABLED);
            return { success: true, message: this.formatResponseMessage(LOG.ALREADY_DISABLED_MSG) };
        }

        if (currentState === ENVIRONMENT_STATES.DISABLING) {
            this.logger.info(LOG.ALREADY_DISABLING);
            return { success: true, message: this.formatResponseMessage(LOG.ALREADY_DISABLING_MSG) };
        }

        if (currentState === ENVIRONMENT_STATES.ENABLING) {
            this.logger.info(LOG.CANNOT_DISABLE_WHILE_ENABLING);
            return { success: false, message: this.formatResponseMessage(LOG.CANNOT_DISABLE_WHILE_ENABLING_MSG) };
        }

        this.logger.info(LOG.DISABLING_ENVIRONMENT);

        await this.stateManager.setState(ENVIRONMENT_STATES.DISABLING);
        await this.stateManager.resetCompletionCheckAttempts();
        await this.schedulerService.enableRdsListeners();

        try {
            await Promise.all([
                this.ecsService.scaleDownAllServicesWithoutWaiting(),
                this.ec2Service.stopAllInstancesWithoutWaiting(),
                this.rdsService.stopAllResourcesWithoutWaiting(),
                this.eventBridgeService.disableAllRules(),
                this.apiGatewayService.disableAllApiMappings(),
            ]);

            await this.schedulerService.enableCompletionCheck();
            await this.schedulerService.disableScheduler();
        } catch (error: any) {
            await this.stateManager.setState(ENVIRONMENT_STATES.ENABLED);
            await this.schedulerService.disableRdsListeners();
            await this.schedulerService.disableCompletionCheck();
            await this.stateManager.resetCompletionCheckAttempts();
            throw error;
        }

        this.logger.info(LOG.DISABLE_COMMANDS_ISSUED);
        return { success: true, message: this.formatResponseMessage(LOG.DISABLE_INITIATED) };
    }

    private async handleSave(): Promise<CryoResponse> {
        const currentState = await this.stateManager.getState();

        if (currentState === ENVIRONMENT_STATES.DISABLED) {
            this.logger.warn(LOG.CANNOT_SAVE_WHEN_DISABLED);
            return {
                success: false,
                message: this.formatResponseMessage(LOG.CANNOT_SAVE_WHEN_DISABLED_MSG),
            };
        }

        this.logger.info(LOG.SAVING_ECS_COUNTS);
        await this.ecsService.saveDesiredCounts();
        this.logger.info(LOG.ECS_COUNTS_SAVED);
        return { success: true, message: this.formatResponseMessage(LOG.ECS_COUNTS_SAVED_MSG) };
    }

    private async handleCompletionCheck(currentState: string): Promise<CryoResponse> {
        const completionCheckConfig = this.config.getConfig().completionCheck;
        const maxAttempts = completionCheckConfig.maxAttempts;
        const delayMinutes = completionCheckConfig.delayMinutes;

        if (!TRANSITIONAL_STATES.includes(currentState as any)) {
            this.logger.info(LOG.NOT_IN_TRANSITIONAL_STATE, { currentState });
            await this.schedulerService.disableCompletionCheck();
            return { success: true, message: this.formatResponseMessage(LOG.ALREADY_COMPLETED) };
        }

        const attempts = await this.stateManager.getCompletionCheckAttempts();

        if (attempts >= maxAttempts) {
            this.logger.error(LOG.OPERATION_TIMED_OUT, {
                attempts,
                maxAttempts,
                currentState,
            });
            await this.schedulerService.disableCompletionCheck();
            await this.stateManager.resetCompletionCheckAttempts();
            return {
                success: false,
                message: this.formatResponseMessage(
                    `${LOG.OPERATION_TIMED_OUT_MSG} ${maxAttempts * delayMinutes} ${LOG.MINUTES}`
                ),
            };
        }

        await this.stateManager.incrementCompletionCheckAttempts();

        const desiredState = currentState === ENVIRONMENT_STATES.ENABLING ? ENVIRONMENT_STATES.ENABLED : ENVIRONMENT_STATES.DISABLED;

        this.logger.info(LOG.CHECKING_COMPLETION, {
            currentState,
            desiredState,
            attempt: attempts + 1,
            maxAttempts,
        });

        const allReady = await this.checkAllResourcesReady(currentState);

        if (allReady) {
            this.logger.info(LOG.ALL_RESOURCES_READY, { finalState: desiredState });

            await this.stateManager.setState(desiredState);
            await this.schedulerService.disableCompletionCheck();
            await this.stateManager.resetCompletionCheckAttempts();

            return {
                success: true,
                message: this.formatResponseMessage(
                    `${LOG.ENVIRONMENT_STATE_SUCCESS} ${desiredState} ${LOG.SUCCESSFULLY}`
                ),
            };
        }

        this.logger.info(`${LOG.RESOURCES_NOT_READY} ${delayMinutes} ${LOG.MINUTES}`, {
            attempt: attempts + 1,
            maxAttempts,
        });

        return {
            success: true,
            message: this.formatResponseMessage(`${LOG.STILL_IN_PROGRESS} ${attempts + 1}/${maxAttempts})`),
        };
    }

    private async checkAllResourcesReady(currentState: string): Promise<boolean> {
        const states =
            currentState === ENVIRONMENT_STATES.ENABLING
                ? RESOURCE_READINESS_STATES.ENABLING
                : RESOURCE_READINESS_STATES.DISABLING;

        const [ec2Ready, rdsReady, ecsReady] = await Promise.all([
            this.ec2Service.verifyAllInstancesInState(states.ec2),
            this.rdsService.verifyAllResourcesInState(states.rds),
            this.ecsService.verifyAllServicesStable(states.ecs),
        ]);

        this.logger.info(
            currentState === ENVIRONMENT_STATES.ENABLING
                ? LOG.RESOURCE_READINESS_ENABLING
                : LOG.RESOURCE_READINESS_DISABLING,
            { ec2Ready, rdsReady, ecsReady }
        );

        return ec2Ready && rdsReady && ecsReady;
    }

    private async handleReconcile(source?: string, clusterIdentifier?: string): Promise<CryoResponse> {
        const isRdsAutoRestart = source === RECONCILE_SOURCES.RDS_AUTO_RESTART;
        const isCompletionCheck = source === RECONCILE_SOURCES.COMPLETION_CHECK;
        const desiredState = await this.stateManager.getState();

        this.logger.info(LOG.RECONCILING_ENVIRONMENT, { desiredState, source, clusterIdentifier });

        if (isCompletionCheck) {
            return await this.handleCompletionCheck(desiredState);
        }

        if (isRdsAutoRestart && !clusterIdentifier) {
            this.logger.error(LOG.RDS_MISSING_CLUSTER_IDENTIFIER);
            return {
                success: false,
                message: this.formatResponseMessage(LOG.RDS_MISSING_CLUSTER_IDENTIFIER),
            };
        }
        
        if (TRANSITIONAL_STATES.includes(desiredState as any)) {
            this.logger.info(LOG.IN_TRANSITIONAL_STATE_SKIP, { state: desiredState });
            return {
                success: true,
                message: this.formatResponseMessage(
                    `${LOG.RECONCILIATION_SKIPPED} ${desiredState}, ${LOG.RECONCILIATION_SKIPPED_MSG}`
                ),
            };
        }

        if (isRdsAutoRestart && clusterIdentifier) {
            if (desiredState === ENVIRONMENT_STATES.ENABLED) {
                this.logger.info(LOG.RDS_DESIRED_ENABLED_SKIP, { clusterIdentifier });
                return {
                    success: true,
                    message: this.formatResponseMessage(
                        `${LOG.RDS_ENABLED_SKIP_MSG} ${clusterIdentifier} ${LOG.RECONCILIATION_SKIPPED_MSG}`
                    ),
                };
            }

            this.logger.info(LOG.RECONCILING_SINGLE_RDS, { clusterIdentifier });
            await this.rdsService.reconcileSingleClusterToDesiredState(
                clusterIdentifier,
                RESOURCE_READINESS_STATES.DISABLING.rds,
                true
            );

            return {
                success: true,
                message: this.formatResponseMessage(
                    `${LOG.RDS_RECONCILED} ${clusterIdentifier} ${LOG.RDS_RECONCILED_MSG}`
                ),
            };
        }

        if (desiredState === ENVIRONMENT_STATES.ENABLED) {
            const states = RESOURCE_READINESS_STATES.ENABLING;
            this.logger.info(LOG.RECONCILING_TO_ENABLED);
            await Promise.all([
                this.ec2Service.reconcileToDesiredState(states.ec2),
                this.rdsService.reconcileToDesiredState(states.rds, false),
                this.ecsService.reconcileToDesiredState(states.ecs),
                this.eventBridgeService.enableAllRules(),
                this.apiGatewayService.enableAllApiMappings(),
            ]);
        }

        if (desiredState === ENVIRONMENT_STATES.DISABLED) {
            const states = RESOURCE_READINESS_STATES.DISABLING;
            this.logger.info(LOG.RECONCILING_TO_DISABLED);
            await Promise.all([
                this.ecsService.reconcileToDesiredState(states.ecs),
                this.ec2Service.reconcileToDesiredState(states.ec2),
                this.rdsService.reconcileToDesiredState(states.rds, false),
                this.eventBridgeService.disableAllRules(),
                this.apiGatewayService.disableAllApiMappings(),
            ]);
        }

        this.logger.info(LOG.RECONCILED_SUCCESSFULLY, { desiredState });
        return {
            success: true,
            message: this.formatResponseMessage(`${LOG.RECONCILED_TO_STATE} ${desiredState} ${LOG.STATE}`),
        };
    }

    private formatResponseMessage(text: string): string {
        return `${RESPONSE_MESSAGE_PREFIX} ${text}`;
    }

    private buildScheduleInfo(durationDays?: string, endDateTime?: string): string {
        if (endDateTime) return `${LOG.UNTIL} ${endDateTime}`;
        if (durationDays) return `${LOG.FOR_DAYS} ${durationDays} ${LOG.DAYS}`;
        return LOG.WITHOUT_AUTO_DISABLE;
    }
}

