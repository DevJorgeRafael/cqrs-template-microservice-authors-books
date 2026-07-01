import {
  Injectable,
  LoggerService as NestLoggerService,
  Scope,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pino, { Logger as PinoLogger } from 'pino';

export type LogLevel = 'error' | 'warn' | 'log' | 'debug' | 'verbose';

const PINO_LEVELS: Record<LogLevel, string> = {
  error: 'error',
  warn: 'warn',
  log: 'info',
  debug: 'debug',
  verbose: 'trace',
};

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  log: 2,
  debug: 3,
  verbose: 4,
};

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private context?: string;
  private static pinoInstance: PinoLogger;
  private readonly logLevel: number;
  private readonly pinoLogger: PinoLogger;

  // Inyectamos ConfigService aquí
  constructor(private readonly configService: ConfigService) {
    const level = (this.configService.get<string>('LOG_LEVEL') || 'log') as LogLevel;
    this.logLevel = LOG_LEVELS[level] ?? LOG_LEVELS.log;

    if (!LoggerService.pinoInstance) {
      // Leemos la nueva variable de entorno
      const usePrettyLogs = this.configService.get<string>('LOG_FORMAT') === 'pretty';

      const baseConfig: pino.LoggerOptions = {
        level: PINO_LEVELS[level] || 'info',
        redact: {
          paths: [
            // Oculto por Rendimiento
            'buffer', '*.buffer', '**.*.buffer', 
            'image', 'base64', 'file', 

            'imageBase64', '*.imageBase64', '**.*.imageBase64',

            // Oculto por Seguridad
            'password', '*.password', '**.*.password',
            'token', '*.token', '**.*.token',
            'req.headers.authorization'
          ],
          censor: '[REDACTED]',
        },
      };

      if (!usePrettyLogs) {
        LoggerService.pinoInstance = pino({
          ...baseConfig,
          timestamp: pino.stdTimeFunctions.isoTime,
          formatters: {
            level: (label) => ({ level: label.toUpperCase() }),
          },
        });
      } else {
        LoggerService.pinoInstance = pino({
          ...baseConfig,
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname,context',
              messageFormat: '[{context}] {msg}',
            },
          },
        });
      }
    }

    this.pinoLogger = LoggerService.pinoInstance;
  }

  setContext(context: string): this {
    this.context = context;
    return this;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] <= this.logLevel;
  }

  private processMessage(message: any, contextStr: string, logMethod: pino.LogFn) {
    if (typeof message === 'object' && message !== null) {
      logMethod.call(this.pinoLogger, { context: contextStr, ...message }, 'Object payload');
    } else {
      logMethod.call(this.pinoLogger, { context: contextStr }, String(message));
    }
  }

  error(message: any, trace?: string, context?: string): void {
    if (!this.shouldLog('error')) return;
    const ctx = context || this.context || 'Application';
    if (typeof message === 'object') {
      this.pinoLogger.error({ context: ctx, trace, ...message }, 'Error payload');
    } else {
      this.pinoLogger.error({ context: ctx, trace }, String(message));
    }
  }

  warn(message: any, context?: string): void {
    if (!this.shouldLog('warn')) return;
    this.processMessage(message, context || this.context || 'Application', this.pinoLogger.warn);
  }

  log(message: any, context?: string): void {
    if (!this.shouldLog('log')) return;
    this.processMessage(message, context || this.context || 'Application', this.pinoLogger.info);
  }

  debug(message: any, context?: string): void {
    if (!this.shouldLog('debug')) return;
    this.processMessage(message, context || this.context || 'Application', this.pinoLogger.debug);
  }

  verbose(message: any, context?: string): void {
    if (!this.shouldLog('verbose')) return;
    this.processMessage(message, context || this.context || 'Application', this.pinoLogger.trace);
  }
}