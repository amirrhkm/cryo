import { 
    ApiGatewayV2Client, 
    CreateApiMappingCommand, 
    DeleteApiMappingCommand,
    GetApiMappingsCommand
} from '@aws-sdk/client-apigatewayv2';
import { LoggerService } from '../logger/logger.service';

interface ApiGatewayConfig {
    domain: string;
    mapping: string;
}

interface ApiMappingState {
    domain: string;
    mapping: string;
    apiMappingId?: string;
}

export class ApiGatewayService {
    private readonly client: ApiGatewayV2Client;
    private readonly apiMappingStates: Map<string, ApiMappingState> = new Map();

    constructor(
        private readonly apiGateways: ApiGatewayConfig[],
        private readonly logger: LoggerService
    ) {
        this.client = new ApiGatewayV2Client({});
    }

    async enableApiMappings(): Promise<void> {
        if (this.apiGateways.length === 0) {
            this.logger.info('[ApiGatewayService] No API Gateway mappings to enable');
            return;
        }

        this.logger.info('[ApiGatewayService] Enabling API Gateway custom domain mappings', { 
            apiGateways: this.apiGateways,
            count: this.apiGateways.length 
        });

        const results = await Promise.allSettled(
            this.apiGateways.map(async (config) => {
                try {
                    await this.createApiMapping(config);
                } catch (error: any) {
                    this.logger.error('[ApiGatewayService] Failed to enable API mapping', {
                        domain: config.domain,
                        mapping: config.mapping,
                        error: error.message,
                    });
                    throw error;
                }
            })
        );

        const failures = results.filter((r) => r.status === 'rejected');
        if (failures.length > 0) {
            this.logger.warn('[ApiGatewayService] Some API mappings failed to enable', {
                failed: failures.length,
                total: this.apiGateways.length,
            });
        } else {
            this.logger.info('[ApiGatewayService] All API mappings enabled successfully');
        }
    }

    async disableApiMappings(): Promise<void> {
        if (this.apiGateways.length === 0) {
            this.logger.info('[ApiGatewayService] No API Gateway mappings to disable');
            return;
        }

        this.logger.info('[ApiGatewayService] Disabling API Gateway custom domain mappings', { 
            apiGateways: this.apiGateways,
            count: this.apiGateways.length 
        });

        const results = await Promise.allSettled(
            this.apiGateways.map(async (config) => {
                try {
                    await this.deleteApiMapping(config);
                } catch (error: any) {
                    this.logger.error('[ApiGatewayService] Failed to disable API mapping', {
                        domain: config.domain,
                        mapping: config.mapping,
                        error: error.message,
                    });
                    throw error;
                }
            })
        );

        const failures = results.filter((r) => r.status === 'rejected');
        if (failures.length > 0) {
            this.logger.warn('[ApiGatewayService] Some API mappings failed to disable', {
                failed: failures.length,
                total: this.apiGateways.length,
            });
        } else {
            this.logger.info('[ApiGatewayService] All API mappings disabled successfully');
        }
    }

    private async createApiMapping(config: ApiGatewayConfig): Promise<void> {
        try {
            const existingMappingId = await this.findExistingMapping(config.domain, config.mapping);
            
            if (existingMappingId) {
                this.logger.info('[ApiGatewayService] API mapping already exists', {
                    domain: config.domain,
                    mapping: config.mapping,
                    apiMappingId: existingMappingId,
                });
                return;
            }

            const response = await this.client.send(
                new CreateApiMappingCommand({
                    DomainName: config.domain,
                    ApiId: config.mapping,
                    Stage: '$default',
                })
            );

            this.apiMappingStates.set(`${config.domain}:${config.mapping}`, {
                domain: config.domain,
                mapping: config.mapping,
                apiMappingId: response.ApiMappingId,
            });

            this.logger.info('[ApiGatewayService] API mapping created', {
                domain: config.domain,
                mapping: config.mapping,
                apiMappingId: response.ApiMappingId,
            });
        } catch (error: any) {
            if (error.name === 'ConflictException') {
                this.logger.info('[ApiGatewayService] API mapping already exists (conflict)', {
                    domain: config.domain,
                    mapping: config.mapping,
                });
                return;
            }
            throw error;
        }
    }

    private async deleteApiMapping(config: ApiGatewayConfig): Promise<void> {
        try {
            const apiMappingId = await this.findExistingMapping(config.domain, config.mapping);

            if (!apiMappingId) {
                this.logger.info('[ApiGatewayService] API mapping not found, nothing to delete', {
                    domain: config.domain,
                    mapping: config.mapping,
                });
                return;
            }

            await this.client.send(
                new DeleteApiMappingCommand({
                    DomainName: config.domain,
                    ApiMappingId: apiMappingId,
                })
            );

            this.apiMappingStates.delete(`${config.domain}:${config.mapping}`);

            this.logger.info('[ApiGatewayService] API mapping deleted', {
                domain: config.domain,
                mapping: config.mapping,
                apiMappingId,
            });
        } catch (error: any) {
            if (error.name === 'NotFoundException') {
                this.logger.info('[ApiGatewayService] API mapping not found (already deleted)', {
                    domain: config.domain,
                    mapping: config.mapping,
                });
                return;
            }
            throw error;
        }
    }

    private async findExistingMapping(domain: string, apiId: string): Promise<string | null> {
        try {
            const response = await this.client.send(
                new GetApiMappingsCommand({
                    DomainName: domain,
                })
            );

            const mapping = response.Items?.find((item) => item.ApiId === apiId);
            return mapping?.ApiMappingId || null;
        } catch (error: any) {
            if (error.name === 'NotFoundException') {
                return null;
            }
            throw error;
        }
    }
}

