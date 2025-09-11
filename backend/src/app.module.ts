// backend/src/app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { YachtsController } from './yachts.controller';

import { PrismaModule } from './prisma/prisma.module';
import { PricingModule } from './pricing/pricing.module';
import { ScraperModule } from './scraper/scraper.module';
import { NausysModule } from './integrations/nausys/nausys.module';
import { PricingDecisionsModule } from './pricing-decisions/pricing-decisions.module';
import { AuthModule } from './auth/auth.module';
import { OrgModule } from './org/org.module';

import { OrgScopeMiddleware } from './org/org-scope.middleware';
import { HeaderAuthMiddleware } from './auth/header-auth.middleware';

import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule,
    ScraperModule,
    PricingModule,
    NausysModule,
    PricingDecisionsModule,
    OrgModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [AppController, YachtsController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HeaderAuthMiddleware, OrgScopeMiddleware).forRoutes('*');
  }
}
