import { Catch, RpcExceptionFilter, ArgumentsHost, Logger } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { ResponseProducerHelper } from '../helpers/response-producer.helper';

@Catch()
export class GlobalRpcExceptionFilter implements RpcExceptionFilter<any> {
  private readonly logger = new Logger(GlobalRpcExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost): Observable<any> {
    const context = host.switchToRpc().getContext();
    const topic = context?.getTopic?.() || 'unknown-topic';

    const status = exception.status || 500;
    const message = exception.response?.message || exception.message || 'Internal server error';

    this.logger.error(
      `[${topic}] Error ${status}: ${typeof message === 'object' ? JSON.stringify(message) : message}`
    );

    // Use the existing helper to format the error response
    const errorResponse = ResponseProducerHelper.handleError(topic, exception);

    return of(errorResponse);
  }
}
