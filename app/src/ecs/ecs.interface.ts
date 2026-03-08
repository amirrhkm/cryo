export interface IEcsClusterConfig {
    clusterName: string;
    serviceNames: string[];
}

export type EcsServiceState = 'up' | 'down';

export const ECS_SERVICE_STATES = {
    UP: 'up' as EcsServiceState,
    DOWN: 'down' as EcsServiceState,
} as const;

export const ECS_LOG_MESSAGES = {
    SAVING_DESIRED_COUNTS: 'Saving ECS desired counts',
    SAVED_ALL_DESIRED_COUNTS: 'Saved all ECS desired counts',
    SCALING_UP: 'Scaling up ECS services (no-wait)',
    SCALING_DOWN: 'Scaling down ECS services (no-wait)',
    SCALE_UP_COMMANDS_ISSUED: 'Scale up commands issued for all ECS services',
    SCALE_DOWN_COMMANDS_ISSUED: 'Scale down commands issued for all ECS services',
    NO_SAVED_COUNT_FOUND: 'No saved desired count found for service',
    SERVICE_DESCRIBE_FAILED: 'DescribeServices returned failures for one or more services',
    SERVICE_NOT_STABLE: 'ECS service not yet stable',
    CHECKED_SERVICE_STATES: 'Checked ECS service states',
    RECONCILING_SERVICES: 'Reconciling ECS services',
    ALREADY_IN_DESIRED_STATE: 'ECS services already in desired state',
    RECONCILE_COMMANDS_ISSUED: 'Reconcile commands issued for all ECS services',
    RETRIEVED_DESIRED_COUNT: 'Retrieved ECS service desired count',
    FAILED_TO_GET_DESIRED_COUNT: 'Failed to get ECS service desired count',
    UPDATING_DESIRED_COUNT: 'Updating ECS service desired count',
    UPDATED_DESIRED_COUNT: 'Updated ECS service desired count',
    NO_SERVICES_SET: 'No services set for ECS cluster',
} as const;

