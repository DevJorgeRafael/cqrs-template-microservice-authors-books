import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggerService } from './common/services/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  
  const logger = await app.resolve(LoggerService);
  app.useLogger(logger);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
