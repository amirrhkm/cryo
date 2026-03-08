import { Context } from 'aws-lambda';
import {
    EC2Client,
    DescribeInstancesCommand,
    StartInstancesCommand,
    StopInstancesCommand,
    InstanceStateName,
} from '@aws-sdk/client-ec2';
import { LoggerService } from '../logger';
import { Ec2InstanceState, EC2_INSTANCE_STATES, EC2_LOG_MESSAGES as LOG } from './ec2.interface';

export class Ec2Service {
    private readonly ec2Client: EC2Client;
    private readonly logger: LoggerService;

    constructor(
        private readonly instanceIds: string[],
        context?: Context
    ) {
        this.ec2Client = new EC2Client({});
        this.logger = new LoggerService(context, 'Ec2Service');
    }

    async startAllInstancesWithoutWaiting(): Promise<void> {
        if (this.hasNoInstances()) {
            this.logger.info(LOG.NO_INSTANCES_START);
            return;
        }

        this.logger.info(LOG.STARTING_INSTANCES, { instanceIds: this.instanceIds });

        await this.ec2Client.send(
            new StartInstancesCommand({ InstanceIds: this.instanceIds })
        );

        this.logger.info(LOG.START_COMMAND_ISSUED);
    }

    async stopAllInstancesWithoutWaiting(): Promise<void> {
        if (this.hasNoInstances()) {
            this.logger.info(LOG.NO_INSTANCES_STOP);
            return;
        }

        this.logger.info(LOG.STOPPING_INSTANCES, { instanceIds: this.instanceIds });

        await this.ec2Client.send(
            new StopInstancesCommand({ InstanceIds: this.instanceIds })
        );

        this.logger.info(LOG.STOP_COMMAND_ISSUED);
    }

    async verifyAllInstancesInState(targetState: InstanceStateName): Promise<boolean> {
        if (this.hasNoInstances()) {
            return true;
        }

        const currentStates = await this.fetchInstanceStates();
        const allInState = currentStates.every((state) => state === targetState);

        this.logger.info(LOG.CHECKED_STATES, {
            targetState,
            allInState,
            currentStates,
        });

        return allInState;
    }

    async reconcileToDesiredState(desiredState: Ec2InstanceState): Promise<void> {
        if (this.hasNoInstances()) {
            this.logger.info(LOG.NO_INSTANCES_RECONCILE);
            return;
        }

        const currentStates = await this.fetchInstanceStates();
        const outOfSyncInstanceIds = this.instanceIds.filter(
            (_, i) => currentStates[i] !== desiredState
        );

        if (outOfSyncInstanceIds.length === 0) {
            this.logger.info(LOG.ALREADY_IN_DESIRED_STATE, { desiredState });
            return;
        }

        this.logger.info(LOG.RECONCILING_INSTANCES, { desiredState, outOfSyncInstanceIds });

        if (desiredState === EC2_INSTANCE_STATES.RUNNING) {
            await this.ec2Client.send(
                new StartInstancesCommand({ InstanceIds: outOfSyncInstanceIds })
            );
        } else {
            await this.ec2Client.send(
                new StopInstancesCommand({ InstanceIds: outOfSyncInstanceIds })
            );
        }

        this.logger.info(LOG.RECONCILE_COMMAND_ISSUED);
    }

    private async fetchInstanceStates(): Promise<InstanceStateName[]> {
        const response = await this.ec2Client.send(
            new DescribeInstancesCommand({ InstanceIds: this.instanceIds })
        );

        const instanceIdToState = new Map<string, InstanceStateName>();
        for (const reservation of response.Reservations || []) {
            for (const instance of reservation.Instances || []) {
                const id = instance.InstanceId;
                if (!id) continue;
                if (!instance.State?.Name) {
                    this.logger.error(LOG.INSTANCE_STATE_UNKNOWN, { instanceId: id });
                    throw new Error(`${LOG.INSTANCE_STATE_UNKNOWN}: ${id}`);
                }
                instanceIdToState.set(id, instance.State.Name);
            }
        }

        const states: InstanceStateName[] = [];
        for (const id of this.instanceIds) {
            const state = instanceIdToState.get(id);
            if (state === undefined) {
                this.logger.error(LOG.INSTANCE_NOT_IN_RESPONSE, { instanceId: id });
                throw new Error(`${LOG.INSTANCE_NOT_IN_RESPONSE}: ${id}`);
            }
            states.push(state);
        }
        return states;
    }

    private hasNoInstances(): boolean {
        return this.instanceIds.length === 0;
    }
}
