import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { LoggerService } from './common/services/logger.service';

async function bootstrap() {
  const brokers = (process.env.URL_BROKER || 'localhost:9092')
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);

  const kfUsername = process.env.KFUSERNAME;
  const kfPassword = process.env.KFPASSWORD;

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: process.env.CLIENT_ID_KAFKA || 'books-authors',
        brokers,
        connectionTimeout: Number(process.env.KAFKA_CONNECTION_TIMEOUT || 5000),
        requestTimeout: Number(process.env.KAFKA_REQUEST_TIMEOUT || 30000),
        ...(kfUsername && kfPassword
          ? {
              ssl: false,
              sasl: {
                mechanism: 'plain',
                username: kfUsername,
                password: kfPassword,
              },
            }
          : { ssl: false }),
      },
      consumer: {
        groupId: process.env.GROUP_ID_KAFKA || 'ms-template-consumer',
      },
    },
  });

  const logger = await app.resolve(LoggerService);
  app.useLogger(logger);

  await app.listen();
}
bootstrap();
