import { Context } from 'aws-lambda';
import { ILogger, ILogEntry } from './logger.interface';

export class LoggerService implements ILogger {
    private readonly requestId?: string;

    constructor(context?: Context) {
        this.requestId = context?.awsRequestId;
    }

    private log(level: string, message: string, meta?: any): void {
        const logEntry: ILogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            requestId: this.requestId,
            ...meta,
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
}

