export interface IRetryConfig {
    rds: {
        stopRetry: {
            maxAttempts: number;
            initialDelayMs: number;
            backoffCap: number;
        };
        waitForState: {
            maxAttempts: number;
            delayMs: number;
        };
    };
    ec2: {
        waitForState: {
            maxAttempts: number;
            delayMs: number;
        };
    };
    ecs: {
        waitForServicesStable: {
            maxAttempts: number;
            delayMs: number;
        };
    };
    reconciliation: {
        rdsAutoRestartDelayMs: number;
    };
}

export const DEFAULT_RETRY_CONFIG: IRetryConfig = {
    rds: {
        stopRetry: {
            maxAttempts: 100,
            initialDelayMs: 5000,
            backoffCap: 5,
        },
        waitForState: {
            maxAttempts: 100,
            delayMs: 300000,
        },
    },
    ec2: {
        waitForState: {
            maxAttempts: 100,
            delayMs: 60000,
        },
    },
    ecs: {
        waitForServicesStable: {
            maxAttempts: 100,
            delayMs: 60000,
        },
    },
    reconciliation: {
        rdsAutoRestartDelayMs: 300000,
    }
};

export function getRetryConfig(): IRetryConfig {
    return DEFAULT_RETRY_CONFIG;
}