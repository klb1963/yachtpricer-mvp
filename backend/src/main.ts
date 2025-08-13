// backend/src/main.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // самый широкий уровень логов
  app.useLogger(['log', 'error', 'warn', 'debug', 'verbose']);

  app.enableCors({ origin: 'http://localhost:3000' });

  await app.listen(8000);
  Logger.log('HTTP server listening on http://localhost:8000', 'Bootstrap');
}
bootstrap();
