// /backend/src/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { AccessCtxService } from './access-ctx.service';
import { AuthController } from './auth.controller';
import { RolesGuard } from '../org/roles.guard';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [RolesGuard],
  exports: [AccessCtxService, RolesGuard],
})
export class AuthModule {}
