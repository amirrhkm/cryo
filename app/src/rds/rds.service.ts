import { Context } from 'aws-lambda';
import {
    RDSClient,
    DescribeDBClustersCommand,
    StartDBClusterCommand,
    StopDBClusterCommand,
    DescribeDBInstancesCommand,
    StartDBInstanceCommand,
    StopDBInstanceCommand,
} from '@aws-sdk/client-rds';
import { LoggerService } from '../logger';
import { 
    IRdsResource, 
    IRdsResourceState,
    RdsResourceState,
    RDS_ERROR_CODES,
    RDS_LOG_MESSAGES as LOG,
    RDS_RESOURCE_TYPES,
    RDS_RESOURCE_STATES,
} from './rds.interface';
import { IRetryConfig } from '../config/retry.config';

export class RdsService {
    private static readonly SERVICE_NAME = 'RdsService';
    private static readonly INVALID_STATE_ERROR_CODES = [
        RDS_ERROR_CODES.INVALID_CLUSTER_STATE,
        RDS_ERROR_CODES.INVALID_INSTANCE_STATE,
    ];

    private readonly rdsClient: RDSClient;
    private readonly logger: LoggerService;

    constructor(
        private readonly rdsResources: IRdsResource[],
        private readonly retryConfig: IRetryConfig['rds'],
        context?: Context
    ) {
        this.rdsClient = new RDSClient({});
        this.logger = new LoggerService(context, 'RdsService');
    }

    async startAllResourcesWithoutWaiting(): Promise<void> {
        if (this.hasNoResources()) {
            this.logger.info(LOG.NO_RESOURCES_START);
            return;
        }

        this.logger.info(LOG.STARTING_RESOURCES, {
            resources: this.rdsResources,
        });

        for (const resource of this.rdsResources) {
            await this.startSingleResourceIgnoringTransitionalState(resource);
        }

        this.logger.info(LOG.START_COMMANDS_ISSUED);
    }

    async stopAllResourcesWithoutWaiting(): Promise<void> {
        if (this.hasNoResources()) {
            this.logger.info(LOG.NO_RESOURCES_STOP);
            return;
        }

        this.logger.info(LOG.STOPPING_RESOURCES, {
            resources: this.rdsResources,
        });

        for (const resource of this.rdsResources) {
            await this.stopSingleResourceIgnoringTransitionalState(resource);
        }

        this.logger.info(LOG.STOP_COMMANDS_ISSUED);
    }

    async verifyAllResourcesInState(targetState: string): Promise<boolean> {
        if (this.hasNoResources()) {
            return true;
        }

        const resourceStates = await this.fetchAllResourceStates();
        const allInState = resourceStates.every((rs) => rs.state === targetState);

        this.logger.info(LOG.CHECKED_STATES, {
            targetState,
            allInState,
            resources: resourceStates,
        });

        return allInState;
    }

    async reconcileToDesiredState(desiredState: RdsResourceState, isRdsAutoRestart = false): Promise<void> {
        if (this.hasNoResources()) {
            this.logger.info(LOG.NO_RESOURCES_RECONCILE);
            return;
        }

        const resourceStates = await this.fetchAllResourceStates();
        const needsAction = resourceStates.some((rs) => rs.state !== desiredState);

        if (!needsAction) {
            this.logger.info(LOG.ALREADY_IN_DESIRED_STATE, {
                desiredState,
                resources: resourceStates,
            });
            return;
        }

        this.logger.info(LOG.NEEDS_RECONCILIATION, {
            desiredState,
            resources: resourceStates,
        });

        if (desiredState === RDS_RESOURCE_STATES.AVAILABLE) {
            await this.startAllResources();
        } else {
            await this.stopAllResourcesWithRetry(isRdsAutoRestart);
        }

        this.logger.info(LOG.RECONCILE_COMMANDS_ISSUED);
    }

    async reconcileSingleClusterToDesiredState(
        clusterIdentifier: string,
        desiredState: RdsResourceState,
        isRdsAutoRestart = false
    ): Promise<void> {
        const resource = this.findClusterResource(clusterIdentifier);

        if (!resource) {
            this.logger.warn(LOG.CLUSTER_NOT_FOUND, { clusterIdentifier });
            return;
        }

        this.logger.info(LOG.RECONCILING_SINGLE_CLUSTER, {
            clusterIdentifier,
            desiredState,
            isRdsAutoRestart,
        });

        const currentState = await this.fetchClusterCurrentState(clusterIdentifier);

        if (currentState === undefined) {
            this.logger.error(LOG.CLUSTER_STATE_UNKNOWN, { clusterIdentifier });
            throw new Error(`${LOG.CLUSTER_STATE_UNKNOWN}: ${clusterIdentifier}`);
        }

        if (currentState === desiredState) {
            this.logger.info(LOG.CLUSTER_ALREADY_IN_STATE, {
                clusterIdentifier,
                currentState,
                desiredState,
            });
            return;
        }

        this.logger.info(LOG.CLUSTER_NEEDS_RECONCILIATION, {
            clusterIdentifier,
            currentState,
            desiredState,
        });

        if (desiredState === RDS_RESOURCE_STATES.AVAILABLE) {
            await this.startClusterIgnoringTransitionalState(clusterIdentifier);
        } else {
            await this.stopResourceWithRetryStrategy(resource, isRdsAutoRestart);
            this.logger.info(LOG.STOPPED_CLUSTER, { clusterIdentifier });
        }
    }

    private async startAllResources(): Promise<void> {
        for (const resource of this.rdsResources) {
            await this.startResourceAndLogResult(resource);
        }
    }

    private async stopAllResourcesWithRetry(isRdsAutoRestart: boolean): Promise<void> {
        for (const resource of this.rdsResources) {
            await this.stopResourceWithRetryStrategy(resource, isRdsAutoRestart);
        }
    }

    private async startSingleResourceIgnoringTransitionalState(resource: IRdsResource): Promise<void> {
        try {
            await this.executeStartCommand(resource);
            this.logger.info(LOG.STARTED_RESOURCE, { 
                identifier: resource.identifier, 
                type: resource.type 
            });
        } catch (error: any) {
            if (this.isInvalidStateError(error)) {
                this.logger.warn(LOG.ALREADY_STARTING, {
                    identifier: resource.identifier,
                    type: resource.type,
                });
            } else {
                throw error;
            }
        }
    }

    private async stopSingleResourceIgnoringTransitionalState(resource: IRdsResource): Promise<void> {
        try {
            await this.executeStopCommand(resource);
            this.logger.info(LOG.STOPPED_RESOURCE, { 
                identifier: resource.identifier, 
                type: resource.type 
            });
        } catch (error: any) {
            if (this.isInvalidStateError(error)) {
                this.logger.warn(LOG.ALREADY_STOPPING, {
                    identifier: resource.identifier,
                    type: resource.type,
                });
            } else {
                throw error;
            }
        }
    }

    private async startResourceAndLogResult(resource: IRdsResource): Promise<void> {
        try {
            await this.executeStartCommand(resource);
            const logMessage = resource.type === RDS_RESOURCE_TYPES.CLUSTER
                ? LOG.STARTED_CLUSTER 
                : LOG.STARTED_INSTANCE;
            this.logger.info(logMessage, { identifier: resource.identifier });
        } catch (error: any) {
            if (this.isInvalidStateError(error)) {
                this.logger.warn(LOG.ALREADY_STARTING, {
                    identifier: resource.identifier,
                    type: resource.type,
                });
            } else {
                throw error;
            }
        }
    }

    private async startClusterIgnoringTransitionalState(clusterIdentifier: string): Promise<void> {
        try {
            await this.rdsClient.send(
                new StartDBClusterCommand({ DBClusterIdentifier: clusterIdentifier })
            );
            this.logger.info(LOG.STARTED_CLUSTER, { clusterIdentifier });
        } catch (error: any) {
            if (error.name === RDS_ERROR_CODES.INVALID_CLUSTER_STATE) {
                this.logger.warn(LOG.ALREADY_STARTING, { clusterIdentifier });
            } else {
                throw error;
            }
        }
    }

    private async stopResourceWithRetryStrategy(
        resource: IRdsResource,
        retryOnTransitional: boolean
    ): Promise<void> {
        const maxAttempts = this.retryConfig.stopRetry.maxAttempts;
        const initialDelayMs = this.retryConfig.stopRetry.initialDelayMs;
        const backoffCap = this.retryConfig.stopRetry.backoffCap;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await this.executeStopCommand(resource);
                this.logger.info(LOG.STOPPED_WITH_RETRY, {
                    identifier: resource.identifier,
                    type: resource.type,
                    attempt,
                });
                return;
            } catch (error: any) {
                if (this.isInvalidStateError(error)) {
                    if (retryOnTransitional) {
                        const delayMs = initialDelayMs * Math.min(attempt, backoffCap);
                        this.logger.warn(LOG.IN_TRANSITIONAL_STATE, {
                            identifier: resource.identifier,
                            type: resource.type,
                            attempt,
                            maxAttempts,
                            delayMs,
                        });
                        await this.delay(delayMs);
                        continue;
                    } else {
                        this.logger.warn(LOG.ALREADY_STOPPING, {
                            identifier: resource.identifier,
                            type: resource.type,
                        });
                        return;
                    }
                }
                throw error;
            }
        }

        throw new Error(
            `[${RdsService.SERVICE_NAME}] ${LOG.FAILED_TO_STOP} ${resource.type} ${resource.identifier} after ${maxAttempts} attempts`
        );
    }

    private async executeStartCommand(resource: IRdsResource): Promise<void> {
        if (resource.type === RDS_RESOURCE_TYPES.CLUSTER) {
            await this.rdsClient.send(
                new StartDBClusterCommand({ DBClusterIdentifier: resource.identifier })
            );
        } else {
            await this.rdsClient.send(
                new StartDBInstanceCommand({ DBInstanceIdentifier: resource.identifier })
            );
        }
    }

    private async executeStopCommand(resource: IRdsResource): Promise<void> {
        if (resource.type === RDS_RESOURCE_TYPES.CLUSTER) {
            await this.rdsClient.send(
                new StopDBClusterCommand({ DBClusterIdentifier: resource.identifier })
            );
        } else {
            await this.rdsClient.send(
                new StopDBInstanceCommand({ DBInstanceIdentifier: resource.identifier })
            );
        }
    }

    private async fetchAllResourceStates(): Promise<IRdsResourceState[]> {
        const states: IRdsResourceState[] = [];

        for (const resource of this.rdsResources) {
            const state = await this.fetchSingleResourceState(resource);
            if (state == null) {
                throw new Error(
                    `${LOG.CLUSTER_STATE_UNKNOWN}: could not fetch state for resource ${resource.identifier} (${resource.type})`
                );
            }
            states.push(state);
        }

        return states;
    }

    private async fetchSingleResourceState(resource: IRdsResource): Promise<IRdsResourceState | null> {
        if (resource.type === RDS_RESOURCE_TYPES.CLUSTER) {
            return await this.fetchClusterState(resource.identifier);
        } else {
            return await this.fetchInstanceState(resource.identifier);
        }
    }

    private async fetchClusterState(identifier: string): Promise<IRdsResourceState | null> {
        const response = await this.rdsClient.send(
            new DescribeDBClustersCommand({
                DBClusterIdentifier: identifier,
            })
        );
        const cluster = response.DBClusters?.[0];
        
        if (cluster?.Status) {
            return {
                identifier,
                type: RDS_RESOURCE_TYPES.CLUSTER,
                state: cluster.Status,
            };
        }
        
        return null;
    }

    private async fetchInstanceState(identifier: string): Promise<IRdsResourceState | null> {
        const response = await this.rdsClient.send(
            new DescribeDBInstancesCommand({
                DBInstanceIdentifier: identifier,
            })
        );
        const instance = response.DBInstances?.[0];
        
        if (instance?.DBInstanceStatus) {
            return {
                identifier,
                type: RDS_RESOURCE_TYPES.INSTANCE,
                state: instance.DBInstanceStatus,
            };
        }
        
        return null;
    }

    private async fetchClusterCurrentState(clusterIdentifier: string): Promise<string | undefined> {
        const describeResponse = await this.rdsClient.send(
            new DescribeDBClustersCommand({ DBClusterIdentifier: clusterIdentifier })
        );
        return describeResponse.DBClusters?.[0]?.Status;
    }

    private findClusterResource(clusterIdentifier: string): IRdsResource | undefined {
        return this.rdsResources.find(
            r => r.identifier === clusterIdentifier && r.type === RDS_RESOURCE_TYPES.CLUSTER
        );
    }

    private hasNoResources(): boolean {
        return this.rdsResources.length === 0;
    }

    private isInvalidStateError(error: any): boolean {
        return RdsService.INVALID_STATE_ERROR_CODES.includes(error.name);
    }

    private async delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
