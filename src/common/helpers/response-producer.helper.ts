import { HttpStatus } from '@nestjs/common';

export interface KafkaResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: number;
    details?: Record<string, any>;
  };
  meta?: {
    timestamp: string;
    pagination?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
    [key: string]: any;
  };
}

export class ResponseProducerHelper {
  static success<T>(data: T, meta?: Record<string, any>): KafkaResponse<T> {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    };
  }

  static error(
    message: string,
    code: number = HttpStatus.INTERNAL_SERVER_ERROR,
  ): KafkaResponse {
    return {
      success: false,
      error: { message, code },
      meta: { timestamp: new Date().toISOString() },
    };
  }

  static errorWithDetails(
    message: string,
    code: number,
    details: Record<string, any>,
  ): KafkaResponse {
    return {
      success: false,
      error: { message, code, details },
      meta: { timestamp: new Date().toISOString() },
    };
  }

  static paginated<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): KafkaResponse<T[]> {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  }

  static handleError(topic: string, error: any, logger?: any): KafkaResponse {
    if (logger) {
      logger.error(`[${topic}] Failed: ${error.message}`, error.stack);
    }

    const statusMap: Record<string, number> = {
      UnauthorizedException: HttpStatus.UNAUTHORIZED,
      NotFoundException: HttpStatus.NOT_FOUND,
      ConflictException: HttpStatus.CONFLICT,
      BadRequestException: HttpStatus.BAD_REQUEST,
      ForbiddenException: HttpStatus.FORBIDDEN,
    };

    const code =
      (typeof error?.getStatus === 'function' ? error.getStatus() : null) ||
      error?.status ||
      error?.statusCode ||
      statusMap[error?.constructor?.name] ||
      HttpStatus.INTERNAL_SERVER_ERROR;


    let message = error.message || 'Internal server error';
    let details: Record<string, any> | undefined;

    if (error.response && typeof error.response === 'object') {
      // Prefer response.message when present
      const respMsg = error.response.message ?? message;

      // Normalize message to always be a string. class-validator returns an array of messages.
      if (Array.isArray(respMsg)) {
        message = respMsg.join('; ');
      } else if (typeof respMsg === 'object') {
        message = JSON.stringify(respMsg);
      } else {
        message = String(respMsg);
      }

      // Destructure message, statusCode and error to avoid redundancy in details
      const { message: _, statusCode: __, error: ___, ...rest } = error.response;
      if (Object.keys(rest).length > 0) {
        details = rest;
      }
    } else {
      // Ensure message is string even when not using error.response
      if (Array.isArray(message)) {
        message = message.join('; ');
      } else if (typeof message === 'object') {
        message = JSON.stringify(message);
      } else {
        message = String(message);
      }
    }

    return {
      success: false,
      error: { message, code, details },
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
