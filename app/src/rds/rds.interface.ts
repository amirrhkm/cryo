export interface IRdsResource {
    identifier: string;
    type: RdsResourceType;
}

export interface IRdsCluster {
    identifier: string;
    status: string;
}

export type RdsResourceType = 'cluster' | 'instance';

export type RdsResourceState = 'available' | 'stopped';

export const RDS_RESOURCE_TYPES = {
    CLUSTER: 'cluster' as RdsResourceType,
    INSTANCE: 'instance' as RdsResourceType,
} as const;

export const RDS_RESOURCE_STATES = {
    AVAILABLE: 'available' as RdsResourceState,
    STOPPED: 'stopped' as RdsResourceState,
} as const;

export interface IRdsResourceState {
    identifier: string;
    type: RdsResourceType;
    state: string;
}

/* 
 * These are the error codes returned by the RDS API.
 * https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_StartDBCluster.html
 * https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_StartDBInstance.html
 * https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_StopDBCluster.html
 * https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_StopDBInstance.html
 */
export const RDS_ERROR_CODES = {
    INVALID_CLUSTER_STATE: 'InvalidDBClusterStateFault',
    INVALID_INSTANCE_STATE: 'InvalidDBInstanceState',
} as const;

export const RDS_LOG_MESSAGES = {
    NO_RESOURCES_START: 'No RDS resources to start (no-wait)',
    NO_RESOURCES_STOP: 'No RDS resources to stop (no-wait)',
    NO_RESOURCES_RECONCILE: 'No RDS resources to reconcile',
    STARTING_RESOURCES: 'Starting RDS resources (no-wait)',
    STOPPING_RESOURCES: 'Stopping RDS resources (no-wait)',
    START_COMMANDS_ISSUED: 'Start commands issued for all RDS resources',
    STOP_COMMANDS_ISSUED: 'Stop commands issued for all RDS resources',
    STARTED_RESOURCE: 'Started RDS resource (no-wait)',
    STOPPED_RESOURCE: 'Stopped RDS resource (no-wait)',
    ALREADY_STARTING: 'RDS resource already starting or available',
    ALREADY_STOPPING: 'RDS resource already stopping or stopped',
    CHECKED_STATES: 'Checked RDS resource states',
    ALREADY_IN_DESIRED_STATE: 'RDS resources already in desired state',
    NEEDS_RECONCILIATION: 'RDS resources need reconciliation',
    RECONCILE_COMMANDS_ISSUED: 'Reconcile commands issued for all RDS resources',
    STARTED_CLUSTER: 'Started RDS cluster',
    STARTED_INSTANCE: 'Started RDS instance',
    STOPPED_WITH_RETRY: 'Stopped RDS resource',
    IN_TRANSITIONAL_STATE: 'RDS resource in transitional state, retrying',
    CLUSTER_NOT_FOUND: 'RDS cluster not found in configuration',
    CLUSTER_STATE_UNKNOWN: 'Could not fetch RDS cluster current state',
    RECONCILING_SINGLE_CLUSTER: 'Reconciling single RDS cluster',
    CLUSTER_ALREADY_IN_STATE: 'RDS cluster already in desired state',
    CLUSTER_NEEDS_RECONCILIATION: 'RDS cluster needs reconciliation',
    STOPPED_CLUSTER: 'Stopped RDS cluster',
    FAILED_TO_STOP: 'Failed to stop RDS',
} as const;

