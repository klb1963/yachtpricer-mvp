// backend/src/integrations/nausys/nausys.module.ts

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NausysService } from './nausys.service';
import { NausysController } from './nausys.controller';

@Module({
  imports: [HttpModule],
  providers: [NausysService],
  controllers: [NausysController],
  exports: [NausysService],
})
export class NausysModule {}
