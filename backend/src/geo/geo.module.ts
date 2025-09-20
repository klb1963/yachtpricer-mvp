// backend/src/geo/geo.module.ts

import { Module } from '@nestjs/common';
import { GeoService } from './geo.service';
import { GeoController } from './geo.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [GeoController],
  providers: [GeoService, PrismaService],
})
export class GeoModule {}
