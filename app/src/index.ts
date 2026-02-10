import { Context } from 'aws-lambda';
import { CryoRequest } from './cryo-controller/cryo-controller.interface';
import { CryoControllerService } from './cryo-controller/cryo-controller.service';
import { ConfigService } from './config/config.service';
import { LoggerService } from './logger/logger.service';

export const handler = async (event: CryoRequest, context: Context) => {
    const logger = new LoggerService(context);
    logger.info('[CryoLambda] Invoked', { event });

    try {
        const config = new ConfigService();
        const controller = new CryoControllerService(config, logger);
        
        const result = await controller.handle(event);
        
        logger.info('[CryoLambda] Completed', { result });
        return result;
    } catch (error: any) {
        logger.error('[CryoLambda] Failed', {
            error: error.message,
            stack: error.stack,
        });
        return { success: false, message: error.message };
    }
};

