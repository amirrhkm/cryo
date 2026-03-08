import { EnvironmentState, ENVIRONMENT_STATES } from '../shared/environment-state';

export type { EnvironmentState };
export { ENVIRONMENT_STATES };

export const RESPONSE_MESSAGE_PREFIX = '[CryoControllerService]';

export type ReconcileSource = 'rds-auto-restart' | 'completion-check';

export const REQUEST_TYPES = {
    ENABLE: 'enable',
    DISABLE: 'disable',
    SAVE: 'save',
    RECONCILE: 'reconcile',
} as const;

export type RequestType = (typeof REQUEST_TYPES)[keyof typeof REQUEST_TYPES];

export const RECONCILE_SOURCES = {
    RDS_AUTO_RESTART: 'rds-auto-restart' as ReconcileSource,
    COMPLETION_CHECK: 'completion-check' as ReconcileSource,
} as const;

export const TRANSITIONAL_STATES: EnvironmentState[] = [
    ENVIRONMENT_STATES.ENABLING,
    ENVIRONMENT_STATES.DISABLING,
];

/** Expected resource states when checking readiness during enable vs disable transition */
export const RESOURCE_READINESS_STATES = {
    ENABLING: { ec2: 'running' as const, rds: 'available' as const, ecs: 'up' as const },
    DISABLING: { ec2: 'stopped' as const, rds: 'stopped' as const, ecs: 'down' as const },
} as const;

export const CRYO_CONTROLLER_LOG_MESSAGES = {
    HANDLING_REQUEST: 'Handling Cryo request',
    REQUEST_FAILED: 'Cryo request failed',
    ALREADY_ENABLED: 'Environment already enabled, skipping',
    ALREADY_ENABLED_MSG: 'Environment already enabled',
    ALREADY_ENABLING: 'Environment already enabling, skipping',
    ALREADY_ENABLING_MSG: 'Environment is currently enabling',
    ENABLING_ENVIRONMENT: 'Enabling environment (fire-and-forget)',
    ENABLE_COMMANDS_ISSUED: 'Enable commands issued, completion check enabled',
    ENABLE_INITIATED: 'Environment enable initiated',
    WITHOUT_AUTO_DISABLE: 'without auto-disable',
    INVALID_SCHEDULE: 'Invalid schedule parameters',
    UNTIL: 'until',
    FOR_DAYS: 'for',
    DAYS: 'days',
    ALREADY_DISABLED: 'Environment already disabled, skipping',
    ALREADY_DISABLED_MSG: 'Environment already disabled',
    ALREADY_DISABLING: 'Environment already disabling, skipping',
    ALREADY_DISABLING_MSG: 'Environment is currently disabling',
    CANNOT_DISABLE_WHILE_ENABLING: 'Cannot disable while environment is enabling, skipping',
    CANNOT_DISABLE_WHILE_ENABLING_MSG: 'Cannot disable while environment is enabling',
    DISABLING_ENVIRONMENT: 'Disabling environment (fire-and-forget)',
    DISABLE_COMMANDS_ISSUED: 'Disable commands issued, completion check enabled',
    DISABLE_INITIATED: 'Environment disable initiated. Check in progress.',
    CANNOT_SAVE_WHEN_DISABLED: 'Cannot save ECS desired counts when environment is disabled - would overwrite with 0',
    CANNOT_SAVE_WHEN_DISABLED_MSG: 'Cannot save when environment is disabled. Enable environment first to capture desired counts.',
    SAVING_ECS_COUNTS: 'Saving ECS desired counts',
    ECS_COUNTS_SAVED: 'ECS desired counts saved successfully',
    ECS_COUNTS_SAVED_MSG: 'ECS desired counts saved',
    NOT_IN_TRANSITIONAL_STATE: 'Not in transitional state, disabling completion check',
    ALREADY_COMPLETED: 'Already completed, check disabled',
    OPERATION_TIMED_OUT: 'Operation timed out after max attempts',
    OPERATION_TIMED_OUT_MSG: 'Operation timed out after',
    MINUTES: 'minutes',
    CHECKING_COMPLETION: 'Checking completion',
    ALL_RESOURCES_READY: 'All resources ready, operation complete',
    ENVIRONMENT_STATE_SUCCESS: 'Environment',
    SUCCESSFULLY: 'successfully',
    RESOURCES_NOT_READY: 'Resources not ready yet, will check again in',
    STILL_IN_PROGRESS: 'Still in progress (attempt',
    RECONCILING_ENVIRONMENT: 'Reconciling environment',
    IN_TRANSITIONAL_STATE_SKIP: 'Environment in transitional state, skipping reconciliation',
    RECONCILIATION_SKIPPED: 'Environment is',
    RECONCILIATION_SKIPPED_MSG: 'reconciliation skipped',
    RDS_DESIRED_ENABLED_SKIP: 'Desired state is enabled, skipping RDS cluster reconciliation',
    RDS_ENABLED_SKIP_MSG: 'Environment is enabled, cluster',
    RECONCILING_SINGLE_RDS: 'Reconciling single RDS cluster (auto-restart mode)',
    RDS_MISSING_CLUSTER_IDENTIFIER: 'RDS auto-restart request requires clusterIdentifier',
    RDS_RECONCILED: 'RDS cluster',
    RDS_RECONCILED_MSG: 'reconciled (auto-restart)',
    RECONCILING_TO_ENABLED: 'Reconciling to enabled state',
    RECONCILING_TO_DISABLED: 'Reconciling to disabled state',
    RECONCILED_SUCCESSFULLY: 'Environment reconciled successfully',
    RECONCILED_TO_STATE: 'Environment reconciled to',
    STATE: 'state',
    RESOURCE_READINESS_ENABLING: 'Resource readiness check (enabling)',
    RESOURCE_READINESS_DISABLING: 'Resource readiness check (disabling)',
    UNKNOWN_REQUEST_TYPE: 'Unknown request type',
} as const;

export interface EnableRequest {
    type: typeof REQUEST_TYPES.ENABLE;
    durationDays?: string;
    endDateTime?: string; // in YYYY-MM-DDTHH:MM:SSZ format
}

export interface DisableRequest {
    type: typeof REQUEST_TYPES.DISABLE;
}

export interface SaveRequest {
    type: typeof REQUEST_TYPES.SAVE;
}

export interface ReconcileRequest {
    type: typeof REQUEST_TYPES.RECONCILE;
    source?: ReconcileSource;
    clusterIdentifier?: string;
}

export type CryoRequest = EnableRequest | DisableRequest | SaveRequest | ReconcileRequest;

export interface CryoResponse {
    success: boolean;
    message: string;
}

