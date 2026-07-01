import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ResponseProducerHelper } from '../helpers/response-producer.helper';

@Injectable()
export class SuccessResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // Si ya es una respuesta formateada, retornarla como está
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }
        // Formatear respuesta exitosa
        return ResponseProducerHelper.success(data);
      }),
    );
  }
}
