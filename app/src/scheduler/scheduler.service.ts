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
}

