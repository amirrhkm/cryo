import {
    ECSClient,
    DescribeServicesCommand,
    UpdateServiceCommand,
} from '@aws-sdk/client-ecs';
import { LoggerService } from '../logger/logger.service';
import { StateManagerService } from '../state-manager/state-manager.service';
import { IEcsClusterConfig } from './ecs.interface';
import { IRetryConfig } from '../config/retry.config';

export class EcsService {
    private readonly ecsClient: ECSClient;

    constructor(
        private readonly clusters: IEcsClusterConfig[],
        private readonly retryConfig: IRetryConfig['ecs'],
        private readonly stateManager: StateManagerService,
        private readonly logger: LoggerService
    ) {
        this.ecsClient = new ECSClient({});
    }

    async saveDesiredCounts(): Promise<void> {
        this.logger.info('[EcsService] Saving ECS desired counts');

        for (const cluster of this.clusters) {
            for (const serviceName of cluster.serviceNames) {
                const desiredCount = await this.getServiceDesiredCount(
                    cluster.clusterName,
                    serviceName
                );

                if (desiredCount !== null) {
                    await this.stateManager.setEcsDesiredCount(
                        cluster.clusterName,
                        serviceName,
                        desiredCount
                    );
                }
            }
        }

        this.logger.info('[EcsService] Saved all ECS desired counts');
    }

    async scaleDown(): Promise<void> {
        this.logger.info('[EcsService] Scaling down ECS services');

        await this.saveDesiredCounts();

        for (const cluster of this.clusters) {
            for (const serviceName of cluster.serviceNames) {
                await this.updateServiceDesiredCount(cluster.clusterName, serviceName, 0);
            }
        }

        await this.waitForServicesStable();
        this.logger.info('[EcsService] All ECS services scaled down');
    }

    async scaleUp(): Promise<void> {
        this.logger.info('[EcsService] Scaling up ECS services');

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
                    this.logger.warn('[EcsService] No saved desired count found for service', {
                        cluster: cluster.clusterName,
                        service: serviceName,
                    });
                }
            }
        }

        await this.waitForServicesStable();
        this.logger.info('[EcsService] All ECS services scaled up');
    }

    async scaleUpNoWait(): Promise<void> {
        this.logger.info('[EcsService] Scaling up ECS services (no-wait)');

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
                    this.logger.warn('[EcsService] No saved desired count found for service', {
                        cluster: cluster.clusterName,
                        service: serviceName,
                    });
                }
            }
        }

        this.logger.info('[EcsService] Scale up commands issued for all ECS services');
    }

    async scaleDownNoWait(): Promise<void> {
        this.logger.info('[EcsService] Scaling down ECS services (no-wait)');

        for (const cluster of this.clusters) {
            for (const serviceName of cluster.serviceNames) {
                await this.updateServiceDesiredCount(cluster.clusterName, serviceName, 0);
            }
        }

        this.logger.info('[EcsService] Scale down commands issued for all ECS services');
    }

    async checkAllServicesStable(targetCount: 'up' | 'down'): Promise<boolean> {
        if (this.clusters.length === 0) {
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

            for (const service of response.services || []) {
                const expectedCount = targetCount === 'up' 
                    ? (await this.stateManager.getEcsDesiredCount(cluster.clusterName, service.serviceName || '') || 0)
                    : 0;

                const isStable =
                    service.runningCount === expectedCount &&
                    service.desiredCount === expectedCount &&
                    (service.deployments?.length || 0) <= 1;

                if (!isStable) {
                    allStable = false;
                    this.logger.info('[EcsService] ECS service not yet stable', {
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

        this.logger.info('[EcsService] Checked ECS service states', {
            targetCount,
            allStable,
        });

        return allStable;
    }

    async reconcile(desiredState: 'up' | 'down'): Promise<void> {
        this.logger.info('[EcsService] Reconciling ECS services', { desiredState });

        if (desiredState === 'up') {
            await this.scaleUp();
        } else {
            await this.scaleDown();
        }
    }

    private async getServiceDesiredCount(
        clusterName: string,
        serviceName: string
    ): Promise<number | null> {
        try {
            const response = await this.ecsClient.send(
                new DescribeServicesCommand({
                    cluster: clusterName,
                    services: [serviceName],
                })
            );

            const service = response.services?.[0];
            if (service && service.desiredCount !== undefined) {
                this.logger.info('[EcsService] Retrieved ECS service desired count', {
                    cluster: clusterName,
                    service: serviceName,
                    desiredCount: service.desiredCount,
                });
                return service.desiredCount;
            }

            return null;
        } catch (error: any) {
            this.logger.error('[EcsService] Failed to get ECS service desired count', {
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
        this.logger.info('[EcsService] Updating ECS service desired count', {
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

        this.logger.info('[EcsService] Updated ECS service desired count', {
            cluster: clusterName,
            service: serviceName,
            desiredCount,
        });
    }

    private async waitForServicesStable(): Promise<void> {
        const maxAttempts = this.retryConfig.waitForServicesStable.maxAttempts;
        const delayMs = this.retryConfig.waitForServicesStable.delayMs;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            let allStable = true;

            for (const cluster of this.clusters) {
                const response = await this.ecsClient.send(
                    new DescribeServicesCommand({
                        cluster: cluster.clusterName,
                        services: cluster.serviceNames,
                    })
                );

                for (const service of response.services || []) {
                    const isStable =
                        service.runningCount === service.desiredCount &&
                        (service.deployments?.length || 0) <= 1;

                    if (!isStable) {
                        allStable = false;
                        this.logger.info('[EcsService] ECS service not yet stable', {
                            cluster: cluster.clusterName,
                            service: service.serviceName,
                            runningCount: service.runningCount,
                            desiredCount: service.desiredCount,
                            deployments: service.deployments?.length,
                        });
                    }
                }
            }

            if (allStable) {
                this.logger.info('[EcsService] All ECS services are stable', { attempt });
                return;
            }

            this.logger.info('[EcsService] Waiting for ECS services to stabilize', {
                attempt,
                maxAttempts,
            });

            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        throw new Error(
            `[EcsService] ECS services did not stabilize after ${maxAttempts} attempts`
        );
    }
}

