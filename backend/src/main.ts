// backend/src/main.ts

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // самый широкий уровень логов
  app.useLogger(['log', 'error', 'warn', 'debug', 'verbose']);

  app.setGlobalPrefix('api');

  // 👇 читаем CORS_ORIGINS из env, по умолчанию localhost и sandbox
  const corsOrigins = (
    process.env.CORS_ORIGINS ??
    'http://localhost:3000,https://sandbox.leonidk.de'
  )
    .split(',')
    .map((s) => s.trim());

  app.enableCors({
    origin: corsOrigins,
    credentials: true, // нужно для Clerk и авторизации
  });

  // 👇 включаем Prisma shutdown hooks
  const prismaService = app.get(PrismaService);
  prismaService.enableShutdownHooks(app);

  // ✅ глобальный ValidationPipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // автоматический каст типов (строки -> числа и т.д.)
      whitelist: true, // игнорировать свойства, которых нет в DTO
      forbidNonWhitelisted: true, // выбрасывать 400, если пришли лишние свойства
    }),
  );

  await app.listen(8000);
  Logger.log('HTTP server listening on http://localhost:8000', 'Bootstrap');
}
bootstrap();
