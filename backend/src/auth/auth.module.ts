import { Module } from '@nestjs/common';
import { AccessCtxService } from './access-ctx.service';

@Module({
  providers: [AccessCtxService],
  exports: [AccessCtxService],
})
export class AuthModule {}