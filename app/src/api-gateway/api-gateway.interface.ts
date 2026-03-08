import { PROMISE_SETTLED_STATUS } from '../shared/promise-settled-status';

export interface IApiGatewayConfig {
    domain: string;
    mapping: string;
}

export { PROMISE_SETTLED_STATUS };

export const API_GATEWAY_CONSTANTS = {
    DEFAULT_STAGE: '$default',
    CONFLICT_EXCEPTION: 'ConflictException',
    NOT_FOUND_EXCEPTION: 'NotFoundException',
    MAX_RESULTS: '100',
} as const;

export const API_GATEWAY_LOG_MESSAGES = {
    NO_MAPPINGS_ENABLE: 'No API Gateway mappings to enable',
    NO_MAPPINGS_DISABLE: 'No API Gateway mappings to disable',
    ALREADY_IN_DESIRED_STATE: 'API Gateway mappings already in desired state',
    ENABLING_MAPPINGS: 'Enabling API Gateway custom domain mappings',
    DISABLING_MAPPINGS: 'Disabling API Gateway custom domain mappings',
    FAILED_TO_ENABLE: 'Failed to enable API mapping',
    FAILED_TO_DISABLE: 'Failed to disable API mapping',
    SOME_MAPPINGS_FAILED_ENABLE: 'Some API mappings failed to enable',
    SOME_MAPPINGS_FAILED_DISABLE: 'Some API mappings failed to disable',
    ALL_MAPPINGS_ENABLED: 'All API mappings enabled successfully',
    ALL_MAPPINGS_DISABLED: 'All API mappings disabled successfully',
    API_NOT_FOUND: 'API not found by name',
    MAPPING_ALREADY_EXISTS: 'API mapping already exists',
    MAPPING_CREATED: 'API mapping created',
    MAPPING_ALREADY_EXISTS_CONFLICT: 'API mapping already exists (conflict)',
    MAPPING_NOT_FOUND: 'API mapping not found, nothing to delete',
    MAPPING_DELETED: 'API mapping deleted',
    MAPPING_NOT_FOUND_ALREADY_DELETED: 'API mapping not found (already deleted)',
    LOOKING_UP_API_ID: 'Looking up API ID by name',
    FOUND_API_ID: 'Found API ID',
    API_NOT_FOUND_WARN: 'API not found',
    FAILED_TO_LOOKUP_API: 'Failed to lookup API by name',
} as const;
