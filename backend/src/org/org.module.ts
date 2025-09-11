// /backend/src/org/org.module.ts

import { Module } from '@nestjs/common';
import { OrgController } from './org.controller';
import { OrgService } from './org.service';

@Module({
  controllers: [OrgController],
  providers: [OrgService],
  exports: [OrgService], // 👈 обязательно, чтобы использовать в других модулях
})
export class OrgModule {}
