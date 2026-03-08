import { Context } from 'aws-lambda';
import { ILogger, ILogEntry } from './logger.interface';

export class LoggerService implements ILogger {
    private readonly requestId?: string;
    private readonly prefix?: string;

    constructor(context?: Context, serviceName?: string) {
        this.requestId = context?.awsRequestId;
        this.prefix = serviceName ? `[${serviceName}]` : undefined;
    }

    private log(level: string, message: string, meta?: any): void {
        const formattedMessage = this.formatMessage(message);
        const logEntry: ILogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message: formattedMessage,
            requestId: this.requestId,
            ...(meta != null ? { meta } : {}),
        };
        console.log(JSON.stringify(logEntry));
    }

    info(message: string, meta?: any): void {
        this.log('INFO', message, meta);
    }

    error(message: string, meta?: any): void {
        this.log('ERROR', message, meta);
    }

    warn(message: string, meta?: any): void {
        this.log('WARN', message, meta);
    }

    private formatMessage(message: string): string {
        return this.prefix ? `${this.prefix} ${message}` : message;
    }
}

