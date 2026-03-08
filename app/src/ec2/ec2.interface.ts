import { InstanceStateName } from '@aws-sdk/client-ec2';

export { InstanceStateName };

export type Ec2InstanceState = 'running' | 'stopped';

export const EC2_INSTANCE_STATES = {
    RUNNING: 'running' as Ec2InstanceState,
    STOPPED: 'stopped' as Ec2InstanceState,
} as const;

export const EC2_LOG_MESSAGES = {
    INSTANCE_STATE_UNKNOWN: 'EC2 instance has no state in response',
    INSTANCE_NOT_IN_RESPONSE: 'EC2 instance not found in DescribeInstances response',
    NO_INSTANCES_START: 'No EC2 instances to start (no-wait)',
    NO_INSTANCES_STOP: 'No EC2 instances to stop (no-wait)',
    NO_INSTANCES_RECONCILE: 'No EC2 instances to reconcile',
    STARTING_INSTANCES: 'Starting EC2 instances (no-wait)',
    STOPPING_INSTANCES: 'Stopping EC2 instances (no-wait)',
    START_COMMAND_ISSUED: 'Start command issued for EC2 instances',
    STOP_COMMAND_ISSUED: 'Stop command issued for EC2 instances',
    CHECKED_STATES: 'Checked EC2 instance states',
    ALREADY_IN_DESIRED_STATE: 'EC2 instances already in desired state',
    RECONCILING_INSTANCES: 'Reconciling EC2 instances',
    RECONCILE_COMMAND_ISSUED: 'Reconcile command issued for EC2 instances',
} as const;

