import {
    RDSClient,
    DescribeDBClustersCommand,
    StartDBClusterCommand,
    StopDBClusterCommand,
    DescribeDBInstancesCommand,
    StartDBInstanceCommand,
    StopDBInstanceCommand,
} from '@aws-sdk/client-rds';
import { LoggerService } from '../logger/logger.service';
import { IRdsResource } from './rds.interface';
import { IRetryConfig } from '../config/retry.config';

export class RdsService {
    private readonly rdsClient: RDSClient;

    constructor(
        private readonly rdsResources: IRdsResource[],
        private readonly retryConfig: IRetryConfig['rds'],
        private readonly logger: LoggerService
    ) {
        this.rdsClient = new RDSClient({});
    }

    async start(): Promise<void> {
        if (this.rdsResources.length === 0) {
            this.logger.info('[RdsService] No RDS resources to start');
            return;
        }

        this.logger.info('[RdsService] Starting RDS resources', {
            resources: this.rdsResources,
        });

        for (const resource of this.rdsResources) {
            try {
                if (resource.type === 'cluster') {
                    await this.rdsClient.send(
                        new StartDBClusterCommand({ DBClusterIdentifier: resource.identifier })
                    );
                    this.logger.info('[RdsService] Started RDS cluster', { identifier: resource.identifier });
                } else {
                    await this.rdsClient.send(
                        new StartDBInstanceCommand({ DBInstanceIdentifier: resource.identifier })
                    );
                    this.logger.info('[RdsService] Started RDS instance', { identifier: resource.identifier });
                }
            } catch (error: any) {
                const invalidStateFaults = ['InvalidDBClusterStateFault', 'InvalidDBInstanceState'];
                if (invalidStateFaults.includes(error.name)) {
                    this.logger.warn('[RdsService] RDS resource already starting or available', {
                        identifier: resource.identifier,
                        type: resource.type,
                    });
                } else {
                    throw error;
                }
            }
        }

        await this.waitForState('available');
        this.logger.info('[RdsService] All RDS resources are available');
    }

    async stop(retryOnTransitional = false): Promise<void> {
        if (this.rdsResources.length === 0) {
            this.logger.info('[RdsService] No RDS resources to stop');
            return;
        }

        this.logger.info('[RdsService] Stopping RDS resources', {
            resources: this.rdsResources,
            retryOnTransitional,
        });

        for (const resource of this.rdsResources) {
            await this.stopResourceWithRetry(resource, retryOnTransitional);
        }

        await this.waitForState('stopped');
        this.logger.info('[RdsService] All RDS resources are stopped');
    }

    async startNoWait(): Promise<void> {
        if (this.rdsResources.length === 0) {
            this.logger.info('[RdsService] No RDS resources to start (no-wait)');
            return;
        }

        this.logger.info('[RdsService] Starting RDS resources (no-wait)', {
            resources: this.rdsResources,
        });

        for (const resource of this.rdsResources) {
            try {
                if (resource.type === 'cluster') {
                    await this.rdsClient.send(
                        new StartDBClusterCommand({ DBClusterIdentifier: resource.identifier })
                    );
                } else {
                    await this.rdsClient.send(
                        new StartDBInstanceCommand({ DBInstanceIdentifier: resource.identifier })
                    );
                }
                this.logger.info('[RdsService] Started RDS resource (no-wait)', { identifier: resource.identifier, type: resource.type });
            } catch (error: any) {
                const invalidStateFaults = ['InvalidDBClusterStateFault', 'InvalidDBInstanceStateFault'];
                if (invalidStateFaults.includes(error.name)) {
                    this.logger.warn('[RdsService] RDS resource already starting or available', {
                        identifier: resource.identifier,
                        type: resource.type,
                    });
                } else {
                    throw error;
                }
            }
        }

        this.logger.info('[RdsService] Start commands issued for all RDS resources');
    }

    async stopNoWait(): Promise<void> {
        if (this.rdsResources.length === 0) {
            this.logger.info('[RdsService] No RDS resources to stop (no-wait)');
            return;
        }

        this.logger.info('[RdsService] Stopping RDS resources (no-wait)', {
            resources: this.rdsResources,
        });

        for (const resource of this.rdsResources) {
            try {
                if (resource.type === 'cluster') {
                    await this.rdsClient.send(
                        new StopDBClusterCommand({ DBClusterIdentifier: resource.identifier })
                    );
                } else {
                    await this.rdsClient.send(
                        new StopDBInstanceCommand({ DBInstanceIdentifier: resource.identifier })
                    );
                }
                this.logger.info('[RdsService] Stopped RDS resource (no-wait)', { identifier: resource.identifier, type: resource.type });
            } catch (error: any) {
                const invalidStateFaults = ['InvalidDBClusterStateFault', 'InvalidDBInstanceStateFault'];
                if (invalidStateFaults.includes(error.name)) {
                    this.logger.warn('[RdsService] RDS resource already stopping or stopped', {
                        identifier: resource.identifier,
                        type: resource.type,
                    });
                } else {
                    throw error;
                }
            }
        }

        this.logger.info('[RdsService] Stop commands issued for all RDS resources');
    }

    async checkAllInState(targetState: string): Promise<boolean> {
        if (this.rdsResources.length === 0) {
            return true;
        }

        const resourceStates = await this.getResourceStates();
        const allInState = resourceStates.every((rs) => rs.state === targetState);

        this.logger.info('[RdsService] Checked RDS resource states', {
            targetState,
            allInState,
            resources: resourceStates,
        });

        return allInState;
    }

    async reconcile(desiredState: 'available' | 'stopped', isRdsAutoRestart = false): Promise<void> {
        if (this.rdsResources.length === 0) {
            this.logger.info('[RdsService] No RDS resources to reconcile');
            return;
        }

        const resourceStates = await this.getResourceStates();
        const needsAction = resourceStates.some((rs) => rs.state !== desiredState);

        if (!needsAction) {
            this.logger.info('[RdsService] RDS resources already in desired state', {
                desiredState,
                resources: resourceStates,
            });
            return;
        }

        this.logger.info('[RdsService] RDS resources need reconciliation', {
            desiredState,
            resources: resourceStates,
        });

        if (desiredState === 'available') {
            await this.start();
        } else {
            await this.stop(isRdsAutoRestart);
        }
    }

    async reconcileSingleCluster(
        clusterIdentifier: string,
        desiredState: 'available' | 'stopped',
        isRdsAutoRestart = false
    ): Promise<void> {
        const resource = this.rdsResources.find(
            r => r.identifier === clusterIdentifier && r.type === 'cluster'
        );

        if (!resource) {
            this.logger.warn('[RdsService] RDS cluster not found in configuration', { clusterIdentifier });
            return;
        }

        this.logger.info('[RdsService] Reconciling single RDS cluster', {
            clusterIdentifier,
            desiredState,
            isRdsAutoRestart,
        });

        const describeResponse = await this.rdsClient.send(
            new DescribeDBClustersCommand({ DBClusterIdentifier: clusterIdentifier })
        );
        const cluster = describeResponse.DBClusters?.[0];
        const currentState = cluster?.Status;

        if (currentState === desiredState) {
            this.logger.info('[RdsService] RDS cluster already in desired state', {
                clusterIdentifier,
                currentState,
                desiredState,
            });
            return;
        }

        this.logger.info('[RdsService] RDS cluster needs reconciliation', {
            clusterIdentifier,
            currentState,
            desiredState,
        });

        if (desiredState === 'available') {
            try {
                await this.rdsClient.send(
                    new StartDBClusterCommand({ DBClusterIdentifier: clusterIdentifier })
                );
                this.logger.info('[RdsService] Started RDS cluster', { clusterIdentifier });
            } catch (error: any) {
                if (error.name === 'InvalidDBClusterStateFault') {
                    this.logger.warn('[RdsService] RDS cluster already starting or available', { clusterIdentifier });
                } else {
                    throw error;
                }
            }
        } else {
            await this.stopResourceWithRetry(resource, isRdsAutoRestart);
            this.logger.info('[RdsService] Stopped RDS cluster', { clusterIdentifier });
        }
    }

    private async stopResourceWithRetry(
        resource: IRdsResource,
        retryOnTransitional: boolean
    ): Promise<void> {
        const maxAttempts = this.retryConfig.stopRetry.maxAttempts;
        const initialDelayMs = this.retryConfig.stopRetry.initialDelayMs;
        const backoffCap = this.retryConfig.stopRetry.backoffCap;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                if (resource.type === 'cluster') {
                    await this.rdsClient.send(
                        new StopDBClusterCommand({ DBClusterIdentifier: resource.identifier })
                    );
                } else {
                    await this.rdsClient.send(
                        new StopDBInstanceCommand({ DBInstanceIdentifier: resource.identifier })
                    );
                }
                this.logger.info('[RdsService] Stopped RDS resource', {
                    identifier: resource.identifier,
                    type: resource.type,
                    attempt,
                });
                return;
            } catch (error: any) {
                const invalidStateFaults = ['InvalidDBClusterStateFault', 'InvalidDBInstanceState'];
                    if (invalidStateFaults.includes(error.name)) {
                        if (retryOnTransitional) {
                            const delayMs = initialDelayMs * Math.min(attempt, backoffCap);
                        this.logger.warn('[RdsService] RDS resource in transitional state, retrying', {
                            identifier: resource.identifier,
                            type: resource.type,
                            attempt,
                            maxAttempts,
                            delayMs,
                        });
                        await new Promise((resolve) => setTimeout(resolve, delayMs));
                        continue;
                    } else {
                        this.logger.warn('[RdsService] RDS resource already stopping or stopped', {
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
            `[RdsService] Failed to stop RDS ${resource.type} ${resource.identifier} after ${maxAttempts} attempts`
        );
    }

    private async getResourceStates(): Promise<Array<{ identifier: string; type: string; state: string }>> {
        const states: Array<{ identifier: string; type: string; state: string }> = [];

        for (const resource of this.rdsResources) {
            if (resource.type === 'cluster') {
                const response = await this.rdsClient.send(
                    new DescribeDBClustersCommand({
                        DBClusterIdentifier: resource.identifier,
                    })
                );
                const cluster = response.DBClusters?.[0];
                if (cluster?.Status) {
                    states.push({
                        identifier: resource.identifier,
                        type: resource.type,
                        state: cluster.Status,
                    });
                }
            } else {
                const response = await this.rdsClient.send(
                    new DescribeDBInstancesCommand({
                        DBInstanceIdentifier: resource.identifier,
                    })
                );
                const instance = response.DBInstances?.[0];
                if (instance?.DBInstanceStatus) {
                    states.push({
                        identifier: resource.identifier,
                        type: resource.type,
                        state: instance.DBInstanceStatus,
                    });
                }
            }
        }

        return states;
    }

    private async waitForState(
        targetState: string
    ): Promise<void> {
        const maxAttempts = this.retryConfig.waitForState.maxAttempts;
        const delayMs = this.retryConfig.waitForState.delayMs;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const resourceStates = await this.getResourceStates();
            const allInTargetState = resourceStates.every((rs) => rs.state === targetState);

            if (allInTargetState) {
                this.logger.info('[RdsService] RDS resources reached target state', {
                    targetState,
                    attempt,
                    resources: resourceStates,
                });
                return;
            }

            this.logger.info('[RdsService] Waiting for RDS resources to reach target state', {
                targetState,
                attempt,
                maxAttempts,
                resources: resourceStates,
            });

            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        const finalStates = await this.getResourceStates();
        throw new Error(
            `[RdsService] RDS resources did not reach target state ${targetState} after ${maxAttempts} attempts. Final states: ${JSON.stringify(finalStates)}`
        );
    }
}

