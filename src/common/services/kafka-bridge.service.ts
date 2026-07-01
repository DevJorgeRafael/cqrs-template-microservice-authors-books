import { Injectable, HttpStatus } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { LoggerService } from '../services/logger.service';
import {
  KafkaResponse,
  ResponseConsumerHelper,
} from '../helpers/response-consumer.helper';

@Injectable()
export class KafkaBridgeService {
  constructor(private readonly logger: LoggerService) {}

  /**
   * Sends a request-response message to Kafka.
   */
  async send<T>(
    client: ClientKafka,
    topic: string,
    payload: any,
    options: { timeout?: number; defaultStatus?: HttpStatus } = {},
  ): Promise<T> {
    const { timeout: ms = 10000, defaultStatus = HttpStatus.BAD_REQUEST } =
      options;

    this.logger.log(`[${topic}] Request: ${JSON.stringify(payload)}`);

    try {
      const result = await firstValueFrom(
        client.send<KafkaResponse<T>>(topic, payload).pipe(timeout(ms)),
      );

      return ResponseConsumerHelper.handleResponse(
        topic,
        result,
        this.logger,
        defaultStatus,
      );
    } catch (error) {
      ResponseConsumerHelper.handleError(topic, error, this.logger);
    }
  }

  /**
   * Emits an event to Kafka (Fire-and-Forget).
   * Logs the emission.
   */
  emit(client: ClientKafka, topic: string, payload: any): void {
    this.logger.log(`[${topic}] Emit: ${JSON.stringify(payload)}`);
    client.emit(topic, payload);
  }
}
