// backend/src/main.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // самый широкий уровень логов
  app.useLogger(['log', 'error', 'warn', 'debug', 'verbose']);

  // 👇 читаем CORS_ORIGINS из env, по умолчанию localhost и sandbox
  const corsOrigins = (
    process.env.CORS_ORIGINS ??
    'http://localhost:3000,https://sandbox.leonidk.de')
    .split(',')
    .map((s) => s.trim());

  app.enableCors({
    origin: corsOrigins,
    credentials: true, // нужно для Clerk и авторизации
  });

  // 👇 включаем Prisma shutdown hooks
  const prismaService = app.get(PrismaService);
  prismaService.enableShutdownHooks(app);

  await app.listen(8000);
  Logger.log('HTTP server listening on http://localhost:8000', 'Bootstrap');
}
bootstrap();
