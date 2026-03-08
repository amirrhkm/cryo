import { EnvironmentState, ENVIRONMENT_STATES } from '../shared/environment-state';

export type { EnvironmentState };
export { ENVIRONMENT_STATES };

export const VALID_ENVIRONMENT_STATES: EnvironmentState[] = [
    ENVIRONMENT_STATES.ENABLED,
    ENVIRONMENT_STATES.DISABLED,
    ENVIRONMENT_STATES.ENABLING,
    ENVIRONMENT_STATES.DISABLING,
];

export const SSM_ERROR_NAMES = {
    PARAMETER_NOT_FOUND: 'ParameterNotFound',
} as const;

export const SSM_PARAMETER_PATHS = {
    STATE: (appEnv: string) => `/cryo/${appEnv}/state`,
    COMPLETION_CHECK_ATTEMPTS: (appEnv: string) => `/cryo/${appEnv}/completion-check-attempts`,
    ECS_DESIRED_COUNT: (appEnv: string, cluster: string, service: string) =>
        `/cryo/${appEnv}/ecs/${cluster}/${service}/desired_count`,
} as const;

export const STATE_MANAGER_LOG_MESSAGES = {
    INVALID_STATE: 'Invalid state value in SSM parameter',
    RETRIEVED_STATE: 'Retrieved environment state',
    STATE_PARAMETER_NOT_FOUND: 'State parameter not found, initializing as disabled',
    UPDATED_STATE: 'Updated environment state',
    RETRIEVED_ECS_DESIRED_COUNT: 'Retrieved ECS desired count',
    ECS_DESIRED_COUNT_NOT_FOUND: 'ECS desired count parameter not found',
    SAVED_ECS_DESIRED_COUNT: 'Saved ECS desired count',
    RETRIEVED_COMPLETION_CHECK_ATTEMPTS: 'Retrieved completion check attempts',
    COMPLETION_CHECK_NOT_FOUND: 'Completion check attempts not found, initializing to 0',
    SET_COMPLETION_CHECK_ATTEMPTS: 'Set completion check attempts',
    RESET_COMPLETION_CHECK_ATTEMPTS: 'Reset completion check attempts',
} as const;

