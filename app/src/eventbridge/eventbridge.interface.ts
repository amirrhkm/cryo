import { EVENTBRIDGE_RULE_STATE } from '../shared/eventbridge-rule-state';
import { PROMISE_SETTLED_STATUS } from '../shared/promise-settled-status';

export interface IEventBridgeConfig {
    ruleNames: string[];
}

export { EVENTBRIDGE_RULE_STATE, PROMISE_SETTLED_STATUS };

export const EVENTBRIDGE_LOG_MESSAGES = {
    NO_RULES_ENABLE: 'No rules to enable',
    NO_RULES_DISABLE: 'No rules to disable',
    ALREADY_IN_DESIRED_STATE: 'EventBridge rules already in desired state',
    ENABLING_RULES: 'Enabling EventBridge rules',
    DISABLING_RULES: 'Disabling EventBridge rules',
    RULE_ENABLED: 'Rule enabled',
    RULE_DISABLED: 'Rule disabled',
    FAILED_TO_ENABLE: 'Failed to enable rule',
    FAILED_TO_DISABLE: 'Failed to disable rule',
    SOME_RULES_FAILED_ENABLE: 'Some rules failed to enable',
    SOME_RULES_FAILED_DISABLE: 'Some rules failed to disable',
    ALL_RULES_ENABLED: 'All rules enabled successfully',
    ALL_RULES_DISABLED: 'All rules disabled successfully',
} as const;
