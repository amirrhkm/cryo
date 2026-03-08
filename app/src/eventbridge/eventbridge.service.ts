import { Context } from 'aws-lambda';
import {
    EventBridgeClient,
    DescribeRuleCommand,
    EnableRuleCommand,
    DisableRuleCommand,
} from '@aws-sdk/client-eventbridge';
import { LoggerService } from '../logger';
import {
    EVENTBRIDGE_RULE_STATE,
    EVENTBRIDGE_LOG_MESSAGES,
    PROMISE_SETTLED_STATUS,
} from './eventbridge.interface';

export class EventBridgeService {
    private readonly client: EventBridgeClient;
    private readonly logger: LoggerService;

    constructor(
        private readonly ruleNames: string[],
        context?: Context
    ) {
        this.client = new EventBridgeClient({});
        this.logger = new LoggerService(context, 'EventBridgeService');
    }

    async enableAllRules(): Promise<void> {
        if (this.hasNoRules()) {
            this.logger.info(EVENTBRIDGE_LOG_MESSAGES.NO_RULES_ENABLE);
            return;
        }

        const alreadyEnabled = await this.areAllRulesInState(EVENTBRIDGE_RULE_STATE.ENABLED);
        if (alreadyEnabled) {
            this.logger.info(EVENTBRIDGE_LOG_MESSAGES.ALREADY_IN_DESIRED_STATE, {
                desiredState: EVENTBRIDGE_RULE_STATE.ENABLED,
            });
            return;
        }

        this.logger.info(EVENTBRIDGE_LOG_MESSAGES.ENABLING_RULES, { 
            ruleNames: this.ruleNames,
            count: this.ruleNames.length 
        });

        const results = await Promise.allSettled(
            this.ruleNames.map(async (ruleName) => {
                try {
                    await this.client.send(new EnableRuleCommand({ Name: ruleName }));
                    this.logger.info(EVENTBRIDGE_LOG_MESSAGES.RULE_ENABLED, { ruleName });
                } catch (error: any) {
                    this.logger.error(EVENTBRIDGE_LOG_MESSAGES.FAILED_TO_ENABLE, {
                        ruleName,
                        error: error.message,
                    });
                    throw error;
                }
            })
        );

        const failures = results.filter((r) => r.status === PROMISE_SETTLED_STATUS.REJECTED);
        if (failures.length > 0) {
            this.logger.warn(EVENTBRIDGE_LOG_MESSAGES.SOME_RULES_FAILED_ENABLE, {
                failed: failures.length,
                total: this.ruleNames.length,
            });
            throw new Error(
                `${EVENTBRIDGE_LOG_MESSAGES.SOME_RULES_FAILED_ENABLE}: ${failures.length}/${this.ruleNames.length} failed`
            );
        }
        this.logger.info(EVENTBRIDGE_LOG_MESSAGES.ALL_RULES_ENABLED);
    }

    async disableAllRules(): Promise<void> {
        if (this.hasNoRules()) {
            this.logger.info(EVENTBRIDGE_LOG_MESSAGES.NO_RULES_DISABLE);
            return;
        }

        const alreadyDisabled = await this.areAllRulesInState(EVENTBRIDGE_RULE_STATE.DISABLED);
        if (alreadyDisabled) {
            this.logger.info(EVENTBRIDGE_LOG_MESSAGES.ALREADY_IN_DESIRED_STATE, {
                desiredState: EVENTBRIDGE_RULE_STATE.DISABLED,
            });
            return;
        }

        this.logger.info(EVENTBRIDGE_LOG_MESSAGES.DISABLING_RULES, { 
            ruleNames: this.ruleNames,
            count: this.ruleNames.length 
        });

        const results = await Promise.allSettled(
            this.ruleNames.map(async (ruleName) => {
                try {
                    await this.client.send(new DisableRuleCommand({ Name: ruleName }));
                    this.logger.info(EVENTBRIDGE_LOG_MESSAGES.RULE_DISABLED, { ruleName });
                } catch (error: any) {
                    this.logger.error(EVENTBRIDGE_LOG_MESSAGES.FAILED_TO_DISABLE, {
                        ruleName,
                        error: error.message,
                    });
                    throw error;
                }
            })
        );

        const failures = results.filter((r) => r.status === PROMISE_SETTLED_STATUS.REJECTED);
        if (failures.length > 0) {
            this.logger.warn(EVENTBRIDGE_LOG_MESSAGES.SOME_RULES_FAILED_DISABLE, {
                failed: failures.length,
                total: this.ruleNames.length,
            });
            throw new Error(
                `${EVENTBRIDGE_LOG_MESSAGES.SOME_RULES_FAILED_DISABLE}: ${failures.length}/${this.ruleNames.length} failed`
            );
        }
        this.logger.info(EVENTBRIDGE_LOG_MESSAGES.ALL_RULES_DISABLED);
    }

    private hasNoRules(): boolean {
        return this.ruleNames.length === 0;
    }

    private async areAllRulesInState(targetState: string): Promise<boolean> {
        const results = await Promise.allSettled(
            this.ruleNames.map(async (ruleName) => {
                const response = await this.client.send(
                    new DescribeRuleCommand({ Name: ruleName })
                );
                return response.State === targetState;
            })
        );

        return results.every((r) => r.status === PROMISE_SETTLED_STATUS.FULFILLED && r.value === true);
    }
}
