import { SSMClient, GetParameterCommand, PutParameterCommand, ParameterType } from '@aws-sdk/client-ssm';
import { EnvironmentState } from './state-manager.interface';
import { LoggerService } from '../logger/logger.service';
import { ConfigService } from '../config/config.service';

const COMPLETION_CHECK_ATTEMPTS_PARAMETER = '/cryo/completion-check-attempts';

export class StateManagerService {
    private readonly ssmClient: SSMClient;
    private readonly stateParameter: string;

    constructor(
        private readonly logger: LoggerService,
        private readonly configService: ConfigService
    ) {
        const appEnv = this.configService.getConfig().appEnv;
        this.ssmClient = new SSMClient({});
        this.stateParameter = `/cryo/${appEnv}/state`;
    }

    async getState(): Promise<EnvironmentState> {
        try {
            const response = await this.ssmClient.send(
                new GetParameterCommand({ Name: this.stateParameter })
            );
            
            const state = response.Parameter?.Value as EnvironmentState;
            this.logger.info('[StateManagerService] Retrieved environment state', { state });
            return state;
        } catch (error: any) {
            if (error.name === 'ParameterNotFound') {
                this.logger.info('[StateManagerService] State parameter not found, initializing as disabled');
                await this.setState('disabled');
                return 'disabled';
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
        this.logger.info('[StateManagerService] Updated environment state', { state });
    }

    async getEcsDesiredCount(cluster: string, service: string): Promise<number | null> {
        const parameterName = `/cryo/ecs/${cluster}/${service}/desired_count`;
        try {
            const response = await this.ssmClient.send(
                new GetParameterCommand({ Name: parameterName })
            );
            const count = parseInt(response.Parameter?.Value || '0', 10);
            this.logger.info('[StateManagerService] Retrieved ECS desired count', { cluster, service, count });
            return count;
        } catch (error: any) {
            if (error.name === 'ParameterNotFound') {
                this.logger.warn('[StateManagerService] ECS desired count parameter not found', { cluster, service });
                return null;
            }
            throw error;
        }
    }

    async setEcsDesiredCount(cluster: string, service: string, count: number): Promise<void> {
        const parameterName = `/cryo/ecs/${cluster}/${service}/desired_count`;
        await this.ssmClient.send(
            new PutParameterCommand({
                Name: parameterName,
                Value: count.toString(),
                Type: ParameterType.STRING,
                Overwrite: true,
            })
        );
        this.logger.info('[StateManagerService] Saved ECS desired count', { cluster, service, count });
    }

    async getCompletionCheckAttempts(): Promise<number> {
        try {
            const response = await this.ssmClient.send(
                new GetParameterCommand({ Name: COMPLETION_CHECK_ATTEMPTS_PARAMETER })
            );
            const attempts = parseInt(response.Parameter?.Value || '0', 10);
            this.logger.info('[StateManagerService] Retrieved completion check attempts', { attempts });
            return attempts;
        } catch (error: any) {
            if (error.name === 'ParameterNotFound') {
                this.logger.info('[StateManagerService] Completion check attempts not found, initializing to 0');
                await this.setCompletionCheckAttempts(0);
                return 0;
            }
            throw error;
        }
    }

    async setCompletionCheckAttempts(attempts: number): Promise<void> {
        await this.ssmClient.send(
            new PutParameterCommand({
                Name: COMPLETION_CHECK_ATTEMPTS_PARAMETER,
                Value: attempts.toString(),
                Type: ParameterType.STRING,
                Overwrite: true,
            })
        );
        this.logger.info('[StateManagerService] Set completion check attempts', { attempts });
    }

    async incrementCompletionCheckAttempts(): Promise<number> {
        const current = await this.getCompletionCheckAttempts();
        const incremented = current + 1;
        await this.setCompletionCheckAttempts(incremented);
        return incremented;
    }

    async resetCompletionCheckAttempts(): Promise<void> {
        await this.setCompletionCheckAttempts(0);
        this.logger.info('[StateManagerService] Reset completion check attempts');
    }
}

