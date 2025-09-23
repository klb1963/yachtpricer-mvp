// backend/src/prisma/prisma.module.ts

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // чтобы можно было инжектить без явного импорта в каждом модуле
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
