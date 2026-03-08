import { EVENTBRIDGE_RULE_STATE } from '../shared/eventbridge-rule-state';
import { PROMISE_SETTLED_STATUS } from '../shared/promise-settled-status';

export { EVENTBRIDGE_RULE_STATE, PROMISE_SETTLED_STATUS };

export const SCHEDULER_ERROR_MESSAGES = {
    INVALID_END_DATE_TIME: 'Invalid endDateTime format. Expected YYYY-MM-DDTHH:MM:SSZ format.',
    PAST_END_DATE_TIME: 'endDateTime must be in the future',
    DURATION_OR_END_DATE_REQUIRED: 'Either durationDays or endDateTime must be provided',
    DURATION_MUST_BE_POSITIVE: 'durationDays must be a positive integer',
} as const;

export const SCHEDULER_LOG_MESSAGES = {
    SCHEDULING_DISABLE: 'Scheduling disable operation',
    SCHEDULED_DISABLE: 'Scheduled disable operation',
    DISABLING_AUTO_DISABLE: 'Disabling auto-disable scheduler',
    DISABLED_AUTO_DISABLE: 'Disabled auto-disable scheduler',
    FAILED_TO_DISABLE_AUTO_DISABLE: 'Failed to disable auto-disable scheduler',
    ENABLING_COMPLETION_CHECK: 'Enabling completion check',
    ENABLED_COMPLETION_CHECK: 'Enabled completion check',
    FAILED_TO_ENABLE_COMPLETION_CHECK: 'Failed to enable completion check',
    DISABLING_COMPLETION_CHECK: 'Disabling completion check',
    DISABLED_COMPLETION_CHECK: 'Disabled completion check',
    FAILED_TO_DISABLE_COMPLETION_CHECK: 'Failed to disable completion check',
    NO_RDS_LISTENER_RULES_ENABLE: 'No RDS listener rules to enable',
    ENABLING_RDS_LISTENER_RULES: 'Enabling RDS listener rules',
    RDS_LISTENER_RULE_ENABLED: 'RDS listener rule enabled',
    FAILED_TO_ENABLE_RDS_LISTENER_RULE: 'Failed to enable RDS listener rule',
    SOME_RDS_LISTENER_RULES_FAILED_ENABLE: 'Some RDS listener rules failed to enable',
    ALL_RDS_LISTENER_RULES_ENABLED: 'All RDS listener rules enabled successfully',
    NO_RDS_LISTENER_RULES_DISABLE: 'No RDS listener rules to disable',
    DISABLING_RDS_LISTENER_RULES: 'Disabling RDS listener rules',
    RDS_LISTENER_RULE_DISABLED: 'RDS listener rule disabled',
    FAILED_TO_DISABLE_RDS_LISTENER_RULE: 'Failed to disable RDS listener rule',
    SOME_RDS_LISTENER_RULES_FAILED_DISABLE: 'Some RDS listener rules failed to disable',
    ALL_RDS_LISTENER_RULES_DISABLED: 'All RDS listener rules disabled successfully',
} as const;