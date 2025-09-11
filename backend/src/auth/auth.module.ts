// /backend/src/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AccessCtxService } from './access-ctx.service';
import { RolesGuard } from '../org/roles.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AccessCtxService, RolesGuard],
  exports: [AccessCtxService],
})
export class AuthModule {}
