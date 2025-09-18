// /backend/src/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { RolesGuard } from '../org/roles.guard';
import { AccessCtxService } from './access-ctx.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AccessCtxService, RolesGuard],
  exports: [AccessCtxService],
})
export class AuthModule {}
