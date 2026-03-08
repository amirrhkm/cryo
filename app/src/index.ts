import { Context } from 'aws-lambda';
import { CryoRequest } from './cryo-controller/cryo-controller.interface';
import { CryoControllerService } from './cryo-controller/cryo-controller.service';
import { ConfigService } from './config/config.service';
import { LoggerService } from './logger/logger.service';

export const handler = async (event: CryoRequest, context: Context) => {
    const logger = new LoggerService(context, 'CryoLambda');
    const controllerLogger = new LoggerService(context, 'CryoControllerService');

    logger.info('Invoked', {
        type: event.type,
        action: (event as any).action,
        id: (event as any).id,
        correlationId: (event as any).correlationId,
    });

    try {
        const config = new ConfigService(logger);
        const controller = new CryoControllerService(config, controllerLogger, context);
        
        const result = await controller.handle(event);
        
        logger.info('Completed', {
            success: result.success,
            message: result.message?.slice(0, 100),
        });
        return result;
    } catch (error: any) {
        logger.error('Failed', {
            error: error.message,
            stack: error.stack,
        });
        return { success: false, message: error.message };
    }
};

