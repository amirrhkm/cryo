export const ENVIRONMENT_STATES = {
    ENABLED: 'enabled',
    DISABLED: 'disabled',
    ENABLING: 'enabling',
    DISABLING: 'disabling',
} as const;

export type EnvironmentState = (typeof ENVIRONMENT_STATES)[keyof typeof ENVIRONMENT_STATES];
