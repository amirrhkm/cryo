import { Context } from 'aws-lambda';
import { SSMClient, GetParameterCommand, PutParameterCommand, ParameterType } from '@aws-sdk/client-ssm';
import {
    EnvironmentState,
    ENVIRONMENT_STATES,
    VALID_ENVIRONMENT_STATES,
    SSM_ERROR_NAMES,
    SSM_PARAMETER_PATHS,
    STATE_MANAGER_LOG_MESSAGES as LOG,
} from './state-manager.interface';
import { LoggerService } from '../logger/logger.service';
import { ConfigService } from '../config/config.service';

export class StateManagerService {
    private readonly ssmClient: SSMClient;
    private readonly logger: LoggerService;
    private readonly stateParameter: string;
    private readonly checkParameter: string;
    private readonly appEnv: string;

    constructor(
        private readonly configService: ConfigService,
        context?: Context
    ) {
        this.logger = new LoggerService(context, 'StateManagerService');
        this.appEnv = this.configService.getConfig().appEnv;
        this.ssmClient = new SSMClient({});
        this.stateParameter = SSM_PARAMETER_PATHS.STATE(this.appEnv);
        this.checkParameter = SSM_PARAMETER_PATHS.COMPLETION_CHECK_ATTEMPTS(this.appEnv);
    }

    async getState(): Promise<EnvironmentState> {
        try {
            const response = await this.ssmClient.send(
                new GetParameterCommand({ Name: this.stateParameter })
            );
            
            const value = response.Parameter?.Value;

            if (!value || !VALID_ENVIRONMENT_STATES.includes(value as EnvironmentState)) {
                this.logger.error(LOG.INVALID_STATE, { invalidValue: value });
                throw new Error(
                    `${LOG.INVALID_STATE}: ${value}. Expected one of: ${VALID_ENVIRONMENT_STATES.join(', ')}`
                );
            }
            
            const state = value as EnvironmentState;
            this.logger.info(LOG.RETRIEVED_STATE, { state });
            return state;
        } catch (error: any) {
            if (error.name === SSM_ERROR_NAMES.PARAMETER_NOT_FOUND) {
                this.logger.info(LOG.STATE_PARAMETER_NOT_FOUND);
                await this.setState(ENVIRONMENT_STATES.DISABLED);
                return ENVIRONMENT_STATES.DISABLED;
            }
            
            throw error;
        }
    }

    async setState(state: EnvironmentState): Promise<void> {
        await this.ssmClient.send(
            new PutParameterCommand({
                Name: this.stateParameter,
                Value: state,
                Type: ParameterType.STRING,
                Overwrite: true,
            })
        );
        this.logger.info(LOG.UPDATED_STATE, { state });
    }

    async getEcsDesiredCount(cluster: string, service: string): Promise<number | null> {
        const parameterName = SSM_PARAMETER_PATHS.ECS_DESIRED_COUNT(this.appEnv, cluster, service);
        const value = await this.getSsmParameterAsInt(parameterName);
        if (value === null) {
            this.logger.warn(LOG.ECS_DESIRED_COUNT_NOT_FOUND, { cluster, service });
            return null;
        }
        this.logger.info(LOG.RETRIEVED_ECS_DESIRED_COUNT, { cluster, service, count: value });
        return value;
    }

    async setEcsDesiredCount(cluster: string, service: string, count: number): Promise<void> {
        const parameterName = SSM_PARAMETER_PATHS.ECS_DESIRED_COUNT(this.appEnv, cluster, service);
        await this.ssmClient.send(
            new PutParameterCommand({
                Name: parameterName,
                Value: count.toString(),
                Type: ParameterType.STRING,
                Overwrite: true,
            })
        );
        this.logger.info(LOG.SAVED_ECS_DESIRED_COUNT, { cluster, service, count });
    }

    async getCompletionCheckAttempts(): Promise<number> {
        const value = await this.getSsmParameterAsInt(this.checkParameter);
        if (value === null) {
            this.logger.info(LOG.COMPLETION_CHECK_NOT_FOUND);
            await this.setCompletionCheckAttempts(0);
            return 0;
        }
        this.logger.info(LOG.RETRIEVED_COMPLETION_CHECK_ATTEMPTS, { attempts: value });
        return value;
    }

    private async getSsmParameterAsInt(parameterName: string): Promise<number | null> {
        try {
            const response = await this.ssmClient.send(
                new GetParameterCommand({ Name: parameterName })
            );
            return Number.parseInt(response.Parameter?.Value || '0', 10);
        } catch (error: any) {
            if (error.name === SSM_ERROR_NAMES.PARAMETER_NOT_FOUND) {
                return null;
            }
            throw error;
        }
    }

    async setCompletionCheckAttempts(attempts: number): Promise<void> {
        await this.ssmClient.send(
            new PutParameterCommand({
                Name: this.checkParameter,
                Value: attempts.toString(),
                Type: ParameterType.STRING,
                Overwrite: true,
            })
        );
        this.logger.info(LOG.SET_COMPLETION_CHECK_ATTEMPTS, { attempts });
    }

    // INFO: This method has risk of race condition and currently
    //       mitigated by setting lambda concurrency to 1.
    async incrementCompletionCheckAttempts(): Promise<number> {
        const current = await this.getCompletionCheckAttempts();
        const incremented = current + 1;
        await this.setCompletionCheckAttempts(incremented);
        return incremented;
    }

    async resetCompletionCheckAttempts(): Promise<void> {
        await this.setCompletionCheckAttempts(0);
        this.logger.info(LOG.RESET_COMPLETION_CHECK_ATTEMPTS);
    }
}

