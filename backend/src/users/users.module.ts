// /backend/src/users/users.module.ts

import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [],
  exports: [],
})
export class UsersModule {
  constructor() {
    console.log('✅ UsersModule loaded');
  }
}
