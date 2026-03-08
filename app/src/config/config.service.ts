import { ICryoConfig, CONFIG_ENV_VAR_NAMES, CONFIG_LOG_MESSAGES } from './config.interface';
import { IRetryConfig, getRetryConfig } from './retry.config';
import { LoggerService } from '../logger/logger.service';

export class ConfigService {
    private readonly config: ICryoConfig;
    private readonly retryConfig: IRetryConfig;
    private readonly logger: LoggerService;

    constructor(logger?: LoggerService) {
        this.logger = logger ?? new LoggerService(undefined, 'ConfigService');
        this.config = this.loadConfig();
        this.retryConfig = getRetryConfig();
    }

    getConfig(): ICryoConfig {
        return this.config;
    }

    getRetryConfig(): IRetryConfig {
        return this.retryConfig;
    }

    private parseIntWithDefault(value: string | undefined, defaultValue: number): number {
        const trimmed = (value ?? '').trim();
        if (!trimmed || !/^\d+$/.test(trimmed)) {
            return defaultValue;
        }
        const parsed = parseInt(trimmed, 10);
        return parsed > 0 ? parsed : defaultValue;
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
                maxAttempts: this.parseIntWithDefault(process.env.COMPLETION_CHECK_MAX_ATTEMPTS, 10),
                delayMinutes: this.parseIntWithDefault(process.env.COMPLETION_CHECK_DELAY_MINUTES, 5),
            },
        };
    }

    private parseCommaSeparated(value: string): string[] {
        return value
            .split(',')
            .map((id) => id.trim())
            .filter((id) => id.length > 0);
    }

    private parseJsonArray<T>(
        str: string,
        envVarName: string,
        validator: (el: unknown, index: number) => { valid: boolean; value?: T }
    ): T[] {
        if (!str) return [];
        try {
            const parsed = JSON.parse(str);
            if (!Array.isArray(parsed)) return [];

            const valid: T[] = [];
            for (let i = 0; i < parsed.length; i++) {
                const result = validator(parsed[i], i);
                if (result.valid && result.value !== undefined) {
                    valid.push(result.value);
                } else {
                    this.logger.warn(CONFIG_LOG_MESSAGES.DROPPED_INVALID_ENTRY, {
                        index: i,
                        envVarName,
                        value: parsed[i],
                    });
                }
            }
            return valid;
        } catch (error: any) {
            this.logger.error(CONFIG_LOG_MESSAGES.PARSE_FAILED, {
                envVarName,
                error: error?.message ?? String(error),
            });
            return [];
        }
    }

    private parseRdsResources(resourcesStr: string): Array<{ identifier: string; type: 'cluster' | 'instance' }> {
        return this.parseJsonArray(resourcesStr, CONFIG_ENV_VAR_NAMES.RDS_RESOURCES, (el) => {
            if (
                el &&
                typeof (el as any).identifier === 'string' &&
                ((el as any).type === 'cluster' || (el as any).type === 'instance')
            ) {
                return { valid: true, value: { identifier: (el as any).identifier, type: (el as any).type } };
            }
            return { valid: false };
        });
    }

    private parseEcsClusters(clustersStr: string): Array<{ clusterName: string; serviceNames: string[] }> {
        return this.parseJsonArray(clustersStr, CONFIG_ENV_VAR_NAMES.ECS_CLUSTERS, (el) => {
            const serviceNames = (el as any)?.serviceNames;
            if (
                el &&
                typeof (el as any).clusterName === 'string' &&
                Array.isArray(serviceNames) &&
                serviceNames.every((s: unknown) => typeof s === 'string')
            ) {
                return { valid: true, value: { clusterName: (el as any).clusterName, serviceNames } };
            }
            return { valid: false };
        });
    }

    private parseApiGateways(apiGwStr: string): Array<{ domain: string; mapping: string }> {
        return this.parseJsonArray(apiGwStr, CONFIG_ENV_VAR_NAMES.API_GW_NAMES, (el) => {
            if (el && typeof (el as any).domain === 'string' && typeof (el as any).mapping === 'string') {
                return { valid: true, value: { domain: (el as any).domain, mapping: (el as any).mapping } };
            }
            return { valid: false };
        });
    }
}