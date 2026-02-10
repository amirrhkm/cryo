import {
    EventBridgeClient,
    PutRuleCommand,
    EnableRuleCommand,
    DisableRuleCommand,
} from '@aws-sdk/client-eventbridge';
import { LoggerService } from '../logger/logger.service';

export class SchedulerService {
    private readonly eventBridgeClient: EventBridgeClient;

    constructor(
        private readonly autoDisableRuleName: string,
        private readonly completionCheckRuleName: string,
        private readonly rdsListenerRuleNames: string[],
        private readonly logger: LoggerService
    ) {
        this.eventBridgeClient = new EventBridgeClient({});
    }

    async scheduleDisable(durationDays: number): Promise<void> {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + durationDays);

        const minute = targetDate.getUTCMinutes();
        const hour = targetDate.getUTCHours();
        const day = targetDate.getUTCDate();
        const month = targetDate.getUTCMonth() + 1;
        const year = targetDate.getUTCFullYear();

        const scheduleExpression = `cron(${minute} ${hour} ${day} ${month} ? ${year})`;

        this.logger.info('[SchedulerService] Scheduling disable operation', {
            durationDays,
            targetDate: targetDate.toISOString(),
            scheduleExpression,
        });

        await this.eventBridgeClient.send(
            new PutRuleCommand({
                Name: this.autoDisableRuleName,
                ScheduleExpression: scheduleExpression,
                State: 'ENABLED',
                Description: `Auto-disable Cryo environment at ${targetDate.toISOString()}`,
            })
        );

        await this.eventBridgeClient.send(
            new EnableRuleCommand({
                Name: this.autoDisableRuleName,
            })
        );

        this.logger.info('[SchedulerService] Scheduled disable operation', {
            ruleName: this.autoDisableRuleName,
            targetDate: targetDate.toISOString(),
        });
    }

    async disableScheduler(): Promise<void> {
        this.logger.info('[SchedulerService] Disabling auto-disable scheduler', { ruleName: this.autoDisableRuleName });

        try {
            await this.eventBridgeClient.send(
                new DisableRuleCommand({
                    Name: this.autoDisableRuleName,
                })
            );

            this.logger.info('[SchedulerService] Disabled auto-disable scheduler', { ruleName: this.autoDisableRuleName });
        } catch (error: any) {
            this.logger.error('[SchedulerService] Failed to disable auto-disable scheduler', {
                ruleName: this.autoDisableRuleName,
                error: error.message,
            });
            throw error;
        }
    }

    async enableCompletionCheck(): Promise<void> {
        this.logger.info('[SchedulerService] Enabling completion check', { ruleName: this.completionCheckRuleName });

        try {
            await this.eventBridgeClient.send(
                new EnableRuleCommand({
                    Name: this.completionCheckRuleName,
                })
            );

            this.logger.info('[SchedulerService] Enabled completion check', { ruleName: this.completionCheckRuleName });
        } catch (error: any) {
            this.logger.error('[SchedulerService] Failed to enable completion check', {
                ruleName: this.completionCheckRuleName,
                error: error.message,
            });
            throw error;
        }
    }

    async disableCompletionCheck(): Promise<void> {
        this.logger.info('[SchedulerService] Disabling completion check', { ruleName: this.completionCheckRuleName });

        try {
            await this.eventBridgeClient.send(
                new DisableRuleCommand({
                    Name: this.completionCheckRuleName,
                })
            );

            this.logger.info('[SchedulerService] Disabled completion check', { ruleName: this.completionCheckRuleName });
        } catch (error: any) {
            this.logger.error('[SchedulerService] Failed to disable completion check', {
                ruleName: this.completionCheckRuleName,
                error: error.message,
            });
            throw error;
        }
    }

    async enableRdsListeners(): Promise<void> {
        if (this.rdsListenerRuleNames.length === 0) {
            this.logger.info('[SchedulerService] No RDS listener rules to enable');
            return;
        }

        this.logger.info('[SchedulerService] Enabling RDS listener rules', {
            ruleNames: this.rdsListenerRuleNames,
            count: this.rdsListenerRuleNames.length,
        });

        const results = await Promise.allSettled(
            this.rdsListenerRuleNames.map(async (ruleName) => {
                try {
                    await this.eventBridgeClient.send(
                        new EnableRuleCommand({ Name: ruleName })
                    );
                    this.logger.info('[SchedulerService] RDS listener rule enabled', { ruleName });
                } catch (error: any) {
                    this.logger.error('[SchedulerService] Failed to enable RDS listener rule', {
                        ruleName,
                        error: error.message,
                    });
                    throw error;
                }
            })
        );

        const failures = results.filter((r) => r.status === 'rejected');
        if (failures.length > 0) {
            this.logger.warn('[SchedulerService] Some RDS listener rules failed to enable', {
                failed: failures.length,
                total: this.rdsListenerRuleNames.length,
            });
        } else {
            this.logger.info('[SchedulerService] All RDS listener rules enabled successfully');
        }
    }

    async disableRdsListeners(): Promise<void> {
        if (this.rdsListenerRuleNames.length === 0) {
            this.logger.info('[SchedulerService] No RDS listener rules to disable');
            return;
        }

        this.logger.info('[SchedulerService] Disabling RDS listener rules', {
            ruleNames: this.rdsListenerRuleNames,
            count: this.rdsListenerRuleNames.length,
        });

        const results = await Promise.allSettled(
            this.rdsListenerRuleNames.map(async (ruleName) => {
                try {
                    await this.eventBridgeClient.send(
                        new DisableRuleCommand({ Name: ruleName })
                    );
                    this.logger.info('[SchedulerService] RDS listener rule disabled', { ruleName });
                } catch (error: any) {
                    this.logger.error('[SchedulerService] Failed to disable RDS listener rule', {
                        ruleName,
                        error: error.message,
                    });
                    throw error;
                }
            })
        );

        const failures = results.filter((r) => r.status === 'rejected');
        if (failures.length > 0) {
            this.logger.warn('[SchedulerService] Some RDS listener rules failed to disable', {
                failed: failures.length,
                total: this.rdsListenerRuleNames.length,
            });
        } else {
            this.logger.info('[SchedulerService] All RDS listener rules disabled successfully');
        }
    }
}

