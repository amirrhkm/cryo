import { Context } from 'aws-lambda';
import {
    ECSClient,
    DescribeServicesCommand,
    UpdateServiceCommand,
} from '@aws-sdk/client-ecs';
import { LoggerService } from '../logger';
import { StateManagerService } from '../state-manager/state-manager.service';
import { IEcsClusterConfig, EcsServiceState, ECS_SERVICE_STATES, ECS_LOG_MESSAGES as LOG } from './ecs.interface';

export class EcsService {
    private readonly ecsClient: ECSClient;
    private readonly logger: LoggerService;

    constructor(
        private readonly clusters: IEcsClusterConfig[],
        private readonly stateManager: StateManagerService,
        context?: Context
    ) {
        this.ecsClient = new ECSClient({});
        this.logger = new LoggerService(context, 'EcsService');
    }

    async saveDesiredCounts(): Promise<void> {
        this.logger.info(LOG.SAVING_DESIRED_COUNTS);

        for (const cluster of this.clusters) {
            for (const serviceName of cluster.serviceNames) {
                const desiredCount = await this.fetchServiceDesiredCount(
                    cluster.clusterName,
                    serviceName
                );
                await this.stateManager.setEcsDesiredCount(
                    cluster.clusterName,
                    serviceName,
                    desiredCount
                );
            }
        }

        this.logger.info(LOG.SAVED_ALL_DESIRED_COUNTS);
    }

    async scaleUpAllServicesWithoutWaiting(): Promise<void> {
        this.logger.info(LOG.SCALING_UP);

        for (const cluster of this.clusters) {
            for (const serviceName of cluster.serviceNames) {
                const savedCount = await this.stateManager.getEcsDesiredCount(
                    cluster.clusterName,
                    serviceName
                );

                if (savedCount !== null && savedCount > 0) {
                    await this.updateServiceDesiredCount(
                        cluster.clusterName,
                        serviceName,
                        savedCount
                    );
                } else {
                    this.logger.warn(LOG.NO_SAVED_COUNT_FOUND, {
                        cluster: cluster.clusterName,
                        service: serviceName,
                    });
                }
            }
        }

        this.logger.info(LOG.SCALE_UP_COMMANDS_ISSUED);
    }

    async scaleDownAllServicesWithoutWaiting(): Promise<void> {
        this.logger.info(LOG.SCALING_DOWN);

        await this.saveDesiredCounts();

        for (const cluster of this.clusters) {
            for (const serviceName of cluster.serviceNames) {
                await this.updateServiceDesiredCount(cluster.clusterName, serviceName, 0);
            }
        }

        this.logger.info(LOG.SCALE_DOWN_COMMANDS_ISSUED);
    }

    async verifyAllServicesStable(targetCount: EcsServiceState): Promise<boolean> {
        if (this.hasNoClusters()) {
            return true;
        }

        let allStable = true;

        for (const cluster of this.clusters) {
            const response = await this.ecsClient.send(
                new DescribeServicesCommand({
                    cluster: cluster.clusterName,
                    services: cluster.serviceNames,
                })
            );

            for (const failure of response.failures || []) {
                this.logger.warn(LOG.SERVICE_DESCRIBE_FAILED, {
                    arn: failure.arn,
                    reason: failure.reason,
                });
            }

            for (const service of response.services || []) {
                const serviceName = service.serviceName;
                if (!serviceName) {
                    this.logger.warn(LOG.NO_SAVED_COUNT_FOUND, {
                        cluster: cluster.clusterName,
                        service: '(missing service name)',
                    });
                    allStable = false;
                    continue;
                }
                const expectedCount = targetCount === ECS_SERVICE_STATES.UP
                    ? (await this.stateManager.getEcsDesiredCount(cluster.clusterName, serviceName) || 0)
                    : 0;

                const isStable =
                    service.runningCount === expectedCount &&
                    service.desiredCount === expectedCount &&
                    (service.deployments?.length || 0) <= 1;

                if (!isStable) {
                    allStable = false;
                    this.logger.info(LOG.SERVICE_NOT_STABLE, {
                        cluster: cluster.clusterName,
                        service: service.serviceName,
                        runningCount: service.runningCount,
                        desiredCount: service.desiredCount,
                        expectedCount,
                        targetCount,
                    });
                }
            }
        }

        this.logger.info(LOG.CHECKED_SERVICE_STATES, {
            targetCount,
            allStable,
        });

        return allStable;
    }

    async reconcileToDesiredState(desiredState: EcsServiceState): Promise<void> {
        if (this.hasNoClusters()) {
            this.logger.info(LOG.NO_SERVICES_SET);
            return;
        }

        const alreadyInDesiredState = await this.verifyAllServicesStable(desiredState);
        if (alreadyInDesiredState) {
            this.logger.info(LOG.ALREADY_IN_DESIRED_STATE, { desiredState });
            return;
        }

        this.logger.info(LOG.RECONCILING_SERVICES, { desiredState });

        if (desiredState === ECS_SERVICE_STATES.UP) {
            await this.scaleUpAllServices();
        } else {
            await this.scaleDownAllServices();
        }

        this.logger.info(LOG.RECONCILE_COMMANDS_ISSUED);
    }

    private async scaleUpAllServices(): Promise<void> {
        for (const cluster of this.clusters) {
            for (const serviceName of cluster.serviceNames) {
                const savedCount = await this.stateManager.getEcsDesiredCount(
                    cluster.clusterName,
                    serviceName
                );

                if (savedCount !== null && savedCount > 0) {
                    await this.updateServiceDesiredCount(
                        cluster.clusterName,
                        serviceName,
                        savedCount
                    );
                } else {
                    this.logger.warn(LOG.NO_SAVED_COUNT_FOUND, {
                        cluster: cluster.clusterName,
                        service: serviceName,
                    });
                }
            }
        }
    }

    private async scaleDownAllServices(): Promise<void> {
        await this.saveDesiredCounts();
        for (const cluster of this.clusters) {
            for (const serviceName of cluster.serviceNames) {
                await this.updateServiceDesiredCount(cluster.clusterName, serviceName, 0);
            }
        }
    }

    private async fetchServiceDesiredCount(
        clusterName: string,
        serviceName: string
    ): Promise<number> {
        try {
            const response = await this.ecsClient.send(
                new DescribeServicesCommand({
                    cluster: clusterName,
                    services: [serviceName],
                })
            );

            const failures = response.failures || [];
            if (failures.length > 0) {
                for (const failure of failures) {
                    this.logger.error(LOG.SERVICE_DESCRIBE_FAILED, {
                        arn: failure.arn,
                        reason: failure.reason,
                        clusterName,
                        serviceName,
                    });
                }
                throw new Error(
                    `${LOG.SERVICE_DESCRIBE_FAILED}: ${failures.length} failure(s) for ${clusterName}/${serviceName}`
                );
            }

            const service = response.services?.[0];
            if (service?.desiredCount === undefined) {
                this.logger.error(LOG.SERVICE_DESCRIBE_FAILED, {
                    clusterName,
                    serviceName,
                    reason: 'No desiredCount in response',
                });
                throw new Error(
                    `${LOG.SERVICE_DESCRIBE_FAILED}: no desiredCount for ${clusterName}/${serviceName}`
                );
            }

            this.logger.info(LOG.RETRIEVED_DESIRED_COUNT, {
                cluster: clusterName,
                service: serviceName,
                desiredCount: service.desiredCount,
            });
            return service.desiredCount;
        } catch (error: any) {
            this.logger.error(LOG.FAILED_TO_GET_DESIRED_COUNT, {
                cluster: clusterName,
                service: serviceName,
                error: error.message,
            });
            throw error;
        }
    }

    private async updateServiceDesiredCount(
        clusterName: string,
        serviceName: string,
        desiredCount: number
    ): Promise<void> {
        this.logger.info(LOG.UPDATING_DESIRED_COUNT, {
            cluster: clusterName,
            service: serviceName,
            desiredCount,
        });

        await this.ecsClient.send(
            new UpdateServiceCommand({
                cluster: clusterName,
                service: serviceName,
                desiredCount,
            })
        );

        this.logger.info(LOG.UPDATED_DESIRED_COUNT, {
            cluster: clusterName,
            service: serviceName,
            desiredCount,
        });
    }

    private hasNoClusters(): boolean {
        return this.clusters.length === 0;
    }
}
