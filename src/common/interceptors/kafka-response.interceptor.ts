import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ResponseProducerHelper } from '../helpers/response-producer.helper';
import { KafkaContext } from '@nestjs/microservices';

@Injectable()
export class KafkaResponseInterceptor implements NestInterceptor {
  private readonly logger = new Logger(KafkaResponseInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const rpcContext = context.switchToRpc();
    const data = rpcContext.getData();
    const kafkaContext = rpcContext.getContext<KafkaContext>();
    
    const topic = kafkaContext.getTopic ? kafkaContext.getTopic() : 'Unknown_Topic';

    this.logger.log(`Event Received: [${topic}]`);
    this.logger.log(data, topic);

    const now = Date.now();

    return next.handle().pipe(
      map((responseData) => {
        if (responseData && typeof responseData === 'object' && 'data' in responseData && 'meta' in responseData) {
          const { data, meta } = responseData;
          return ResponseProducerHelper.success(data, meta);
        }
        const finalData = responseData === undefined ? true : responseData;
        return ResponseProducerHelper.success(finalData);
      }),
      
      catchError((error) => {
        this.logger.error(`Failed: [${topic}] - Failed in ${Date.now() - now}ms`);
        
        const errorResponse = ResponseProducerHelper.handleError(
          topic,
          error,
          this.logger,
        );
        return of(errorResponse);
      }),
    );
  }
}