import { ICryoConfig } from './config.interface';
import { IRetryConfig, getRetryConfig } from './retry.config';

export class ConfigService {
    private readonly config: ICryoConfig;
    private readonly retryConfig: IRetryConfig;

    constructor() {
        this.config = this.loadConfig();
        this.retryConfig = getRetryConfig();
    }

    getConfig(): ICryoConfig {
        return this.config;
    }

    getRetryConfig(): IRetryConfig {
        return this.retryConfig;
    }

    private loadConfig(): ICryoConfig {
        return {
            appEnv: process.env.APP_ENV || '',
            ec2InstanceIds: this.parseCommaSeparated(process.env.EC2_INSTANCE_IDS || ''),
            rdsResources: this.parseRdsResources(process.env.RDS_RESOURCES || ''),
            ecsClusters: this.parseEcsClusters(process.env.ECS_CLUSTERS || ''),
            ruleNames: this.parseCommaSeparated(process.env.RULE_NAMES || ''),
            apiGateways: this.parseApiGateways(process.env.API_GW_NAMES || ''),
            rdsListenerRuleNames: this.parseCommaSeparated(process.env.RDS_LISTENER_RULE_NAMES || ''),
            autoDisableRuleName: process.env.AUTO_DISABLE_RULE_NAME || '',
            completionCheck: {
                name: process.env.COMPLETION_CHECK_RULE_NAME || '',
                maxAttempts: parseInt(process.env.COMPLETION_CHECK_MAX_ATTEMPTS || '10', 10),
                delayMinutes: parseInt(process.env.COMPLETION_CHECK_DELAY_MINUTES || '5', 10),
            },
        };
    }

    private parseCommaSeparated(value: string): string[] {
        return value
            .split(',')
            .map((id) => id.trim())
            .filter((id) => id.length > 0);
    }

    private parseRdsResources(resourcesStr: string): Array<{ identifier: string; type: 'cluster' | 'instance' }> {
        if (!resourcesStr) {
            return [];
        }

        try {
            const parsed = JSON.parse(resourcesStr);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('[ConfigService] Failed to parse RDS_RESOURCES environment variable:', error);
            return [];
        }
    }

    private parseEcsClusters(clustersStr: string): Array<{ clusterName: string; serviceNames: string[] }> {
        if (!clustersStr) {
            return [];
        }

        try {
            const parsed = JSON.parse(clustersStr);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('[ConfigService] Failed to parse ECS_CLUSTERS environment variable:', error);
            return [];
        }
    }

    private parseApiGateways(apiGwStr: string): Array<{ domain: string; mapping: string }> {
        if (!apiGwStr) {
            return [];
        }

        try {
            const parsed = JSON.parse(apiGwStr);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('[ConfigService] Failed to parse API_GW_NAMES environment variable:', error);
            return [];
        }
    }
}