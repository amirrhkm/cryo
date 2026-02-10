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
    autoDisableRuleName: string;
    completionCheck: {
        name: string;
        maxAttempts: number;
        delayMinutes: number;
    }
}