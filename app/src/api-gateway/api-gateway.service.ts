import { Context } from 'aws-lambda';
import { 
    ApiGatewayV2Client, 
    CreateApiMappingCommand, 
    DeleteApiMappingCommand,
    GetApiMappingsCommand,
    GetApisCommand
} from '@aws-sdk/client-apigatewayv2';
import { LoggerService } from '../logger';
import { 
    IApiGatewayConfig, 
    API_GATEWAY_CONSTANTS, 
    API_GATEWAY_LOG_MESSAGES as LOG,
    PROMISE_SETTLED_STATUS,
} from './api-gateway.interface';

export class ApiGatewayService {
    private readonly client: ApiGatewayV2Client;
    private readonly apiIdCache: Map<string, string> = new Map();
    private readonly logger: LoggerService;

    constructor(
        private readonly apiGateways: IApiGatewayConfig[],
        context?: Context
    ) {
        this.client = new ApiGatewayV2Client({});
        this.logger = new LoggerService(context, 'ApiGatewayService');
    }

    async enableAllApiMappings(): Promise<void> {
        if (this.hasNoApiGateways()) {
            this.logger.info(LOG.NO_MAPPINGS_ENABLE);
            return;
        }

        const alreadyEnabled = await this.areAllMappingsInState(true);
        if (alreadyEnabled) {
            this.logger.info(LOG.ALREADY_IN_DESIRED_STATE, { desiredState: 'enabled' });
            return;
        }

        this.logger.info(LOG.ENABLING_MAPPINGS, { 
            apiGateways: this.apiGateways,
            count: this.apiGateways.length 
        });

        const results = await Promise.allSettled(
            this.apiGateways.map(async (config) => {
                try {
                    await this.createApiMapping(config);
                } catch (error: any) {
                    this.logger.error(LOG.FAILED_TO_ENABLE, {
                        domain: config.domain,
                        mapping: config.mapping,
                        error: error.message,
                    });
                    throw error;
                }
            })
        );

        const failures = results.filter((r) => r.status === PROMISE_SETTLED_STATUS.REJECTED);
        if (failures.length > 0) {
            this.logger.warn(LOG.SOME_MAPPINGS_FAILED_ENABLE, {
                failed: failures.length,
                total: this.apiGateways.length,
            });
            throw new Error(
                `${LOG.SOME_MAPPINGS_FAILED_ENABLE}: ${failures.length}/${this.apiGateways.length} failed`
            );
        }
        this.logger.info(LOG.ALL_MAPPINGS_ENABLED);
    }

    async disableAllApiMappings(): Promise<void> {
        if (this.hasNoApiGateways()) {
            this.logger.info(LOG.NO_MAPPINGS_DISABLE);
            return;
        }

        const alreadyDisabled = await this.areAllMappingsInState(false);
        if (alreadyDisabled) {
            this.logger.info(LOG.ALREADY_IN_DESIRED_STATE, { desiredState: 'disabled' });
            return;
        }

        this.logger.info(LOG.DISABLING_MAPPINGS, { 
            apiGateways: this.apiGateways,
            count: this.apiGateways.length 
        });

        const results = await Promise.allSettled(
            this.apiGateways.map(async (config) => {
                try {
                    await this.deleteApiMapping(config);
                } catch (error: any) {
                    this.logger.error(LOG.FAILED_TO_DISABLE, {
                        domain: config.domain,
                        mapping: config.mapping,
                        error: error.message,
                    });
                    throw error;
                }
            })
        );

        const failures = results.filter((r) => r.status === PROMISE_SETTLED_STATUS.REJECTED);
        if (failures.length > 0) {
            this.logger.warn(LOG.SOME_MAPPINGS_FAILED_DISABLE, {
                failed: failures.length,
                total: this.apiGateways.length,
            });
            throw new Error(
                `${LOG.SOME_MAPPINGS_FAILED_DISABLE}: ${failures.length}/${this.apiGateways.length} failed`
            );
        }
        this.logger.info(LOG.ALL_MAPPINGS_DISABLED);
    }

    private async createApiMapping(config: IApiGatewayConfig): Promise<void> {
        try {
            const apiId = await this.fetchApiIdByName(config.mapping);
            
            if (!apiId) {
                this.logger.error(LOG.API_NOT_FOUND, {
                    domain: config.domain,
                    apiName: config.mapping,
                });
                throw new Error(`${LOG.API_NOT_FOUND}: ${config.mapping}`);
            }

            const existingMappingId = await this.findExistingMapping(config.domain, apiId);
            
            if (existingMappingId) {
                this.logger.info(LOG.MAPPING_ALREADY_EXISTS, {
                    domain: config.domain,
                    apiName: config.mapping,
                    apiId,
                    apiMappingId: existingMappingId,
                });
                return;
            }

            const response = await this.client.send(
                new CreateApiMappingCommand({
                    DomainName: config.domain,
                    ApiId: apiId,
                    Stage: API_GATEWAY_CONSTANTS.DEFAULT_STAGE,
                })
            );

            this.logger.info(LOG.MAPPING_CREATED, {
                domain: config.domain,
                apiName: config.mapping,
                apiId,
                apiMappingId: response.ApiMappingId,
            });
        } catch (error: any) {
            if (error.name === API_GATEWAY_CONSTANTS.CONFLICT_EXCEPTION) {
                this.logger.info(LOG.MAPPING_ALREADY_EXISTS_CONFLICT, {
                    domain: config.domain,
                    apiName: config.mapping,
                });
                return;
            }
            throw error;
        }
    }

    private async deleteApiMapping(config: IApiGatewayConfig): Promise<void> {
        try {
            const apiId = await this.fetchApiIdByName(config.mapping);
            
            if (!apiId) {
                this.logger.warn(LOG.API_NOT_FOUND, {
                    domain: config.domain,
                    apiName: config.mapping,
                });
                return;
            }

            const apiMappingId = await this.findExistingMapping(config.domain, apiId);

            if (!apiMappingId) {
                this.logger.info(LOG.MAPPING_NOT_FOUND, {
                    domain: config.domain,
                    apiName: config.mapping,
                    apiId,
                });
                return;
            }

            await this.client.send(
                new DeleteApiMappingCommand({
                    DomainName: config.domain,
                    ApiMappingId: apiMappingId,
                })
            );

            this.logger.info(LOG.MAPPING_DELETED, {
                domain: config.domain,
                apiName: config.mapping,
                apiId,
                apiMappingId,
            });
        } catch (error: any) {
            if (error.name === API_GATEWAY_CONSTANTS.NOT_FOUND_EXCEPTION) {
                this.logger.info(LOG.MAPPING_NOT_FOUND_ALREADY_DELETED, {
                    domain: config.domain,
                    apiName: config.mapping,
                });
                return;
            }
            throw error;
        }
    }

    private async findExistingMapping(domain: string, apiId: string): Promise<string | null> {
        try {
            let nextToken: string | undefined;

            do {
                const response = await this.client.send(
                    new GetApiMappingsCommand({
                        DomainName: domain,
                        NextToken: nextToken,
                        MaxResults: API_GATEWAY_CONSTANTS.MAX_RESULTS,
                    })
                );

                const mapping = response.Items?.find((item) => item.ApiId === apiId);
                
                if (mapping?.ApiMappingId) {
                    return mapping.ApiMappingId;
                }

                nextToken = response.NextToken;
            } while (nextToken);

            return null;
        } catch (error: any) {
            if (error.name === API_GATEWAY_CONSTANTS.NOT_FOUND_EXCEPTION) {
                return null;
            }
            throw error;
        }
    }

    private async fetchApiIdByName(apiName: string): Promise<string | null> {
        if (this.apiIdCache.has(apiName)) {
            return this.apiIdCache.get(apiName)!;
        }

        try {
            this.logger.info(LOG.LOOKING_UP_API_ID, { apiName });
            
            let nextToken: string | undefined;
            let totalApis = 0;
            const availableApiNames: string[] = [];

            do {
                const response = await this.client.send(
                    new GetApisCommand({
                        NextToken: nextToken,
                        MaxResults: API_GATEWAY_CONSTANTS.MAX_RESULTS,
                    })
                );

                totalApis += response.Items?.length || 0;

                const api = response.Items?.find((item) => item.Name === apiName);
                
                if (api?.ApiId) {
                    this.logger.info(LOG.FOUND_API_ID, {
                        apiName,
                        apiId: api.ApiId,
                        totalApisScanned: totalApis,
                    });
                    this.apiIdCache.set(apiName, api.ApiId);
                    return api.ApiId;
                }

                if (response.Items) {
                    availableApiNames.push(...response.Items.map(item => item.Name || 'unnamed'));
                }

                nextToken = response.NextToken;
            } while (nextToken);

            this.logger.warn(LOG.API_NOT_FOUND_WARN, {
                apiName,
                totalApisScanned: totalApis,
                availableApis: availableApiNames,
            });
            return null;
        } catch (error: any) {
            this.logger.error(LOG.FAILED_TO_LOOKUP_API, {
                apiName,
                error: error.message,
            });
            throw error;
        }
    }

    private hasNoApiGateways(): boolean {
        return this.apiGateways.length === 0;
    }

    private async areAllMappingsInState(enabled: boolean): Promise<boolean> {
        const results = await Promise.allSettled(
            this.apiGateways.map(async (config) => {
                const apiId = await this.fetchApiIdByName(config.mapping);
                if (!apiId) return !enabled;
                const existingMappingId = await this.findExistingMapping(config.domain, apiId);
                return enabled ? !!existingMappingId : !existingMappingId;
            })
        );

        return results.every((r) => r.status === PROMISE_SETTLED_STATUS.FULFILLED && r.value === true);
    }
}
