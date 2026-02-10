import { EventBridgeClient, EnableRuleCommand, DisableRuleCommand } from '@aws-sdk/client-eventbridge';
import { LoggerService } from '../logger/logger.service';

export class EventBridgeService {
    private readonly client: EventBridgeClient;

    constructor(
        private readonly ruleNames: string[],
        private readonly logger: LoggerService
    ) {
        this.client = new EventBridgeClient({});
    }

    async enableRules(): Promise<void> {
        if (this.ruleNames.length === 0) {
            this.logger.info('[EventBridgeService] No rules to enable');
            return;
        }

        this.logger.info('[EventBridgeService] Enabling EventBridge rules', { 
            ruleNames: this.ruleNames,
            count: this.ruleNames.length 
        });

        const results = await Promise.allSettled(
            this.ruleNames.map(async (ruleName) => {
                try {
                    await this.client.send(new EnableRuleCommand({ Name: ruleName }));
                    this.logger.info('[EventBridgeService] Rule enabled', { ruleName });
                } catch (error: any) {
                    this.logger.error('[EventBridgeService] Failed to enable rule', {
                        ruleName,
                        error: error.message,
                    });
                    throw error;
                }
            })
        );

        const failures = results.filter((r) => r.status === 'rejected');
        if (failures.length > 0) {
            this.logger.warn('[EventBridgeService] Some rules failed to enable', {
                failed: failures.length,
                total: this.ruleNames.length,
            });
        } else {
            this.logger.info('[EventBridgeService] All rules enabled successfully');
        }
    }

    async disableRules(): Promise<void> {
        if (this.ruleNames.length === 0) {
            this.logger.info('[EventBridgeService] No rules to disable');
            return;
        }

        this.logger.info('[EventBridgeService] Disabling EventBridge rules', { 
            ruleNames: this.ruleNames,
            count: this.ruleNames.length 
        });

        const results = await Promise.allSettled(
            this.ruleNames.map(async (ruleName) => {
                try {
                    await this.client.send(new DisableRuleCommand({ Name: ruleName }));
                    this.logger.info('[EventBridgeService] Rule disabled', { ruleName });
                } catch (error: any) {
                    this.logger.error('[EventBridgeService] Failed to disable rule', {
                        ruleName,
                        error: error.message,
                    });
                    throw error;
                }
            })
        );

        const failures = results.filter((r) => r.status === 'rejected');
        if (failures.length > 0) {
            this.logger.warn('[EventBridgeService] Some rules failed to disable', {
                failed: failures.length,
                total: this.ruleNames.length,
            });
        } else {
            this.logger.info('[EventBridgeService] All rules disabled successfully');
        }
    }
}

