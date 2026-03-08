export const CONFIG_ENV_VAR_NAMES = {
    RDS_RESOURCES: 'RDS_RESOURCES',
    ECS_CLUSTERS: 'ECS_CLUSTERS',
    API_GW_NAMES: 'API_GW_NAMES',
} as const;

export const CONFIG_LOG_MESSAGES = {
    DROPPED_INVALID_ENTRY: 'Dropped invalid entry at index',
    PARSE_FAILED: 'Failed to parse',
} as const;

export interface ICryoConfig {
    appEnv: string;
    ec2InstanceIds: string[];
    rdsResources: Array<{
        identifier: string;
        type: 'cluster' | 'instance';
    }>;
    ecsClusters: Array<{
        clusterName: string;
        serviceNames: string[];
    }>;
    ruleNames: string[];
    apiGateways: Array<{
        domain: string;
        mapping: string;
    }>;
    rdsListenerRuleNames: string[];
    autoDisableRuleName: string;
    completionCheck: {
        name: string;
        maxAttempts: number;
        delayMinutes: number;
    }
}