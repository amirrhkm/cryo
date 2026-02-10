import {
    EC2Client,
    DescribeInstancesCommand,
    StartInstancesCommand,
    StopInstancesCommand,
    InstanceStateName,
} from '@aws-sdk/client-ec2';
import { LoggerService } from '../logger/logger.service';
import { IRetryConfig } from '../config/retry.config';

export class Ec2Service {
    private readonly ec2Client: EC2Client;

    constructor(
        private readonly instanceIds: string[],
        private readonly retryConfig: IRetryConfig['ec2'],
        private readonly logger: LoggerService
    ) {
        this.ec2Client = new EC2Client({});
    }

    async start(): Promise<void> {
        if (this.instanceIds.length === 0) {
            this.logger.info('[Ec2Service] No EC2 instances to start');
            return;
        }

        this.logger.info('[Ec2Service] Starting EC2 instances', { instanceIds: this.instanceIds });

        await this.ec2Client.send(
            new StartInstancesCommand({ InstanceIds: this.instanceIds })
        );

        await this.waitForState(['running']);
        this.logger.info('[Ec2Service] All EC2 instances are running');
    }

    async stop(): Promise<void> {
        if (this.instanceIds.length === 0) {
            this.logger.info('[Ec2Service] No EC2 instances to stop');
            return;
        }

        this.logger.info('[Ec2Service] Stopping EC2 instances', { instanceIds: this.instanceIds });

        await this.ec2Client.send(
            new StopInstancesCommand({ InstanceIds: this.instanceIds })
        );

        await this.waitForState(['stopped']);
        this.logger.info('[Ec2Service] All EC2 instances are stopped');
    }

    async startNoWait(): Promise<void> {
        if (this.instanceIds.length === 0) {
            this.logger.info('[Ec2Service] No EC2 instances to start (no-wait)');
            return;
        }

        this.logger.info('[Ec2Service] Starting EC2 instances (no-wait)', { instanceIds: this.instanceIds });

        await this.ec2Client.send(
            new StartInstancesCommand({ InstanceIds: this.instanceIds })
        );

        this.logger.info('[Ec2Service] Start command issued for EC2 instances');
    }

    async stopNoWait(): Promise<void> {
        if (this.instanceIds.length === 0) {
            this.logger.info('[Ec2Service] No EC2 instances to stop (no-wait)');
            return;
        }

        this.logger.info('[Ec2Service] Stopping EC2 instances (no-wait)', { instanceIds: this.instanceIds });

        await this.ec2Client.send(
            new StopInstancesCommand({ InstanceIds: this.instanceIds })
        );

        this.logger.info('[Ec2Service] Stop command issued for EC2 instances');
    }

    async checkAllInState(targetState: InstanceStateName): Promise<boolean> {
        if (this.instanceIds.length === 0) {
            return true;
        }

        const currentStates = await this.getInstanceStates();
        const allInState = currentStates.every((state) => state === targetState);

        this.logger.info('[Ec2Service] Checked EC2 instance states', {
            targetState,
            allInState,
            currentStates,
        });

        return allInState;
    }

    async reconcile(desiredState: 'running' | 'stopped'): Promise<void> {
        if (this.instanceIds.length === 0) {
            this.logger.info('[Ec2Service] No EC2 instances to reconcile');
            return;
        }

        const currentStates = await this.getInstanceStates();
        const needsAction = currentStates.some((state) => state !== desiredState);

        if (!needsAction) {
            this.logger.info('[Ec2Service] EC2 instances already in desired state', { desiredState });
            return;
        }

        if (desiredState === 'running') {
            await this.start();
        } else {
            await this.stop();
        }
    }

    private async getInstanceStates(): Promise<InstanceStateName[]> {
        const response = await this.ec2Client.send(
            new DescribeInstancesCommand({ InstanceIds: this.instanceIds })
        );

        const states: InstanceStateName[] = [];
        for (const reservation of response.Reservations || []) {
            for (const instance of reservation.Instances || []) {
                if (instance.State?.Name) {
                    states.push(instance.State.Name);
                }
            }
        }

        return states;
    }

    private async waitForState(
        targetStates: InstanceStateName[]
    ): Promise<void> {
        const maxAttempts = this.retryConfig.waitForState.maxAttempts;
        const delayMs = this.retryConfig.waitForState.delayMs;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const states = await this.getInstanceStates();
            const allInTargetState = states.every((state) => targetStates.includes(state));

            if (allInTargetState) {
                this.logger.info('[Ec2Service] EC2 instances reached target state', {
                    targetStates,
                    attempt,
                });
                return;
            }

            this.logger.info('[Ec2Service] Waiting for EC2 instances to reach target state', {
                currentStates: states,
                targetStates,
                attempt,
                maxAttempts,
            });

            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        throw new Error(
            `[Ec2Service] EC2 instances did not reach target state ${targetStates.join(', ')} after ${maxAttempts} attempts`
        );
    }
}

