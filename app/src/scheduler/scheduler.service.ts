import { Context } from 'aws-lambda';
import {
    EventBridgeClient,
    PutRuleCommand,
    EnableRuleCommand,
    DisableRuleCommand,
} from '@aws-sdk/client-eventbridge';
import { LoggerService } from '../logger/logger.service';
import {
    EVENTBRIDGE_RULE_STATE,
    PROMISE_SETTLED_STATUS,
    SCHEDULER_ERROR_MESSAGES,
    SCHEDULER_LOG_MESSAGES as LOG,
} from './scheduler.interface';

export class SchedulerService {
    private readonly eventBridgeClient: EventBridgeClient;
    private readonly logger: LoggerService;

    constructor(
        private readonly autoDisableRuleName: string,
        private readonly completionCheckRuleName: string,
        private readonly rdsListenerRuleNames: string[],
        context?: Context
    ) {
        this.eventBridgeClient = new EventBridgeClient({});
        this.logger = new LoggerService(context, 'SchedulerService');
    }

    private static readonly ISO8601_STRICT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

    async scheduleDisable(durationDays?: number, endDateTime?: string): Promise<void> {
        let targetDate: Date;

        if (durationDays !== undefined) {
            if (
                !Number.isFinite(durationDays) ||
                !Number.isInteger(durationDays) ||
                durationDays <= 0
            ) {
                throw new TypeError(SCHEDULER_ERROR_MESSAGES.DURATION_MUST_BE_POSITIVE);
            }
            targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + durationDays);
        } else if (endDateTime) {
            if (!SchedulerService.ISO8601_STRICT.test(endDateTime.trim())) {
                throw new TypeError(`${SCHEDULER_ERROR_MESSAGES.INVALID_END_DATE_TIME} Received: ${endDateTime}`);
            }
            targetDate = new Date(endDateTime);
            if (!Number.isFinite(targetDate.getTime())) {
                throw new TypeError(`${SCHEDULER_ERROR_MESSAGES.INVALID_END_DATE_TIME} Received: ${endDateTime}`);
            }
            if (targetDate.getTime() <= Date.now()) {
                throw new TypeError(SCHEDULER_ERROR_MESSAGES.PAST_END_DATE_TIME);
            }
        } else {
            throw new TypeError(SCHEDULER_ERROR_MESSAGES.DURATION_OR_END_DATE_REQUIRED);
        }

        const minute = targetDate.getUTCMinutes();
        const hour = targetDate.getUTCHours();
        const day = targetDate.getUTCDate();
        const month = targetDate.getUTCMonth() + 1;
        const year = targetDate.getUTCFullYear();

        const scheduleExpression = `cron(${minute} ${hour} ${day} ${month} ? ${year})`;

        this.logger.info(LOG.SCHEDULING_DISABLE, {
            durationDays,
            endDateTime,
            targetDate: targetDate.toISOString(),
            scheduleExpression,
        });

        await this.eventBridgeClient.send(
            new PutRuleCommand({
                Name: this.autoDisableRuleName,
                ScheduleExpression: scheduleExpression,
                State: EVENTBRIDGE_RULE_STATE.ENABLED,
                Description: `Auto-disable Cryo environment at ${targetDate.toISOString()}`,
            })
        );

        await this.eventBridgeClient.send(
            new EnableRuleCommand({
                Name: this.autoDisableRuleName,
            })
        );

        this.logger.info(LOG.SCHEDULED_DISABLE, {
            ruleName: this.autoDisableRuleName,
            targetDate: targetDate.toISOString(),
        });
    }

    async disableScheduler(): Promise<void> {
        await this.setRuleState(this.autoDisableRuleName, false, {
            enabling: LOG.DISABLING_AUTO_DISABLE,
            success: LOG.DISABLED_AUTO_DISABLE,
            failure: LOG.FAILED_TO_DISABLE_AUTO_DISABLE,
        });
    }

    async enableCompletionCheck(): Promise<void> {
        await this.setRuleState(this.completionCheckRuleName, true, {
            enabling: LOG.ENABLING_COMPLETION_CHECK,
            success: LOG.ENABLED_COMPLETION_CHECK,
            failure: LOG.FAILED_TO_ENABLE_COMPLETION_CHECK,
        });
    }

    async disableCompletionCheck(): Promise<void> {
        await this.setRuleState(this.completionCheckRuleName, false, {
            enabling: LOG.DISABLING_COMPLETION_CHECK,
            success: LOG.DISABLED_COMPLETION_CHECK,
            failure: LOG.FAILED_TO_DISABLE_COMPLETION_CHECK,
        });
    }

    private async setRuleState(
        ruleName: string,
        enabled: boolean,
        logMessages: { enabling: string; success: string; failure: string }
    ): Promise<void> {
        this.logger.info(logMessages.enabling, { ruleName });

        try {
            const command = enabled
                ? new EnableRuleCommand({ Name: ruleName })
                : new DisableRuleCommand({ Name: ruleName });
            await this.eventBridgeClient.send(command);
            this.logger.info(logMessages.success, { ruleName });
        } catch (error: any) {
            this.logger.error(logMessages.failure, { ruleName, error: error.message });
            throw error;
        }
    }

    async enableRdsListeners(): Promise<void> {
        if (this.rdsListenerRuleNames.length === 0) {
            this.logger.info(LOG.NO_RDS_LISTENER_RULES_ENABLE);
            return;
        }

        this.logger.info(LOG.ENABLING_RDS_LISTENER_RULES, {
            ruleNames: this.rdsListenerRuleNames,
            count: this.rdsListenerRuleNames.length,
        });

        const results = await Promise.allSettled(
            this.rdsListenerRuleNames.map(async (ruleName) => {
                try {
                    await this.eventBridgeClient.send(new EnableRuleCommand({ Name: ruleName }));
                    this.logger.info(LOG.RDS_LISTENER_RULE_ENABLED, { ruleName });
                } catch (error: any) {
                    this.logger.error(LOG.FAILED_TO_ENABLE_RDS_LISTENER_RULE, {
                        ruleName,
                        error: error.message,
                    });
                    throw error;
                }
            })
        );

        const failures = results.filter((r) => r.status === PROMISE_SETTLED_STATUS.REJECTED);
        if (failures.length > 0) {
            this.logger.warn(LOG.SOME_RDS_LISTENER_RULES_FAILED_ENABLE, {
                failed: failures.length,
                total: this.rdsListenerRuleNames.length,
            });
            const reasons = failures
                .map((f) => (f as PromiseRejectedResult).reason?.message ?? String((f as PromiseRejectedResult).reason))
                .join('; ');
            throw new Error(
                `${LOG.SOME_RDS_LISTENER_RULES_FAILED_ENABLE}: ${failures.length}/${this.rdsListenerRuleNames.length} failed. ${reasons}`
            );
        }
        this.logger.info(LOG.ALL_RDS_LISTENER_RULES_ENABLED);
    }

    async disableRdsListeners(): Promise<void> {
        if (this.rdsListenerRuleNames.length === 0) {
            this.logger.info(LOG.NO_RDS_LISTENER_RULES_DISABLE);
            return;
        }

        this.logger.info(LOG.DISABLING_RDS_LISTENER_RULES, {
            ruleNames: this.rdsListenerRuleNames,
            count: this.rdsListenerRuleNames.length,
        });

        const results = await Promise.allSettled(
            this.rdsListenerRuleNames.map(async (ruleName) => {
                try {
                    await this.eventBridgeClient.send(new DisableRuleCommand({ Name: ruleName }));
                    this.logger.info(LOG.RDS_LISTENER_RULE_DISABLED, { ruleName });
                } catch (error: any) {
                    this.logger.error(LOG.FAILED_TO_DISABLE_RDS_LISTENER_RULE, {
                        ruleName,
                        error: error.message,
                    });
                    throw error;
                }
            })
        );

        const failures = results.filter((r) => r.status === PROMISE_SETTLED_STATUS.REJECTED);
        if (failures.length > 0) {
            this.logger.warn(LOG.SOME_RDS_LISTENER_RULES_FAILED_DISABLE, {
                failed: failures.length,
                total: this.rdsListenerRuleNames.length,
            });
            const reasons = failures
                .map((f) => (f as PromiseRejectedResult).reason?.message ?? String((f as PromiseRejectedResult).reason))
                .join('; ');
            throw new Error(
                `${LOG.SOME_RDS_LISTENER_RULES_FAILED_DISABLE}: ${failures.length}/${this.rdsListenerRuleNames.length} failed. ${reasons}`
            );
        }
        this.logger.info(LOG.ALL_RDS_LISTENER_RULES_DISABLED);
    }
}

