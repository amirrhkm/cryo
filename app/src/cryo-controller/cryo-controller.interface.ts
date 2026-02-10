export type EnvironmentState = 'enabled' | 'disabled';

export interface EnableRequest {
    type: 'enable';
    duration: string; // in days
}

export interface DisableRequest {
    type: 'disable';
}

export interface SaveRequest {
    type: 'save';
}

export interface ReconcileRequest {
    type: 'reconcile';
    source?: 'rds-auto-restart';
    clusterIdentifier?: string;
}

export type CryoRequest = EnableRequest | DisableRequest | SaveRequest | ReconcileRequest;

export interface CryoResponse {
    success: boolean;
    message: string;
}

