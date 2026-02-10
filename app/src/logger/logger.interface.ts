export interface ILogger {
    info(message: string, meta?: any): void;
    error(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
}

export interface ILogEntry {
    timestamp: string;
    level: string;
    message: string;
    requestId?: string;
    [key: string]: any;
}

