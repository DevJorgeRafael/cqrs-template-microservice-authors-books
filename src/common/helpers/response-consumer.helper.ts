import { HttpException, HttpStatus } from '@nestjs/common';
import { LoggerService } from '../services/logger.service';

export interface KafkaResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: {
    message: string;
    code: number | string;
    details?: Record<string, any>;
  };
  meta?: any;
  message?: string | string[];
  statusCode?: number | string;
}

export class ResponseConsumerHelper {
  static handleResponse<T>(
    topic: string,
    result: KafkaResponse<T>,
    logger: LoggerService,
    defaultStatus: HttpStatus = HttpStatus.BAD_REQUEST,
  ): T {
    if (result.success === false) {
      // Look for message in result.error.message OR result.message
      const message = result.error?.message || result.message || 'Internal server error';
      const details = result.error?.details || {};
      let code = result.error?.code || result.statusCode || defaultStatus;

      // Ensure code is a number
      if (typeof code === 'string') {
        code = HttpStatus.BAD_REQUEST;
      }

      logger.error(`[${topic}] Failed: ${message}`, '');

      throw new HttpException(
        {
          message,
          ...details,
        },
        code,
      );
    }

    logger.log(`[${topic}] Success`);

    // If result.data is undefined but success is true, it means it's a flat response
    return (result.data !== undefined ? result.data : result) as T;
  }

  static handleError(topic: string, error: any, logger: LoggerService): never {
    logger.error(`[${topic}] Error: ${error.message}`, error.stack);
    if (error.name === 'TimeoutError') {
      throw new HttpException(
        'Service temporarily unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    throw error;
  }
}
