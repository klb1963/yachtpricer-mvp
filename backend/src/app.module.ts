// backend/src/app.module.ts

import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import type { FactoryProvider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

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
import { UsersModule } from './users/users.module';

import { OrgScopeMiddleware } from './org/org-scope.middleware';
import { HeaderAuthMiddleware } from './auth/header-auth.middleware';
import { RolesGuard } from './auth/roles.guard';
import { ClerkAuthMiddleware } from './auth/clerk-auth.middleware';

// ✅ Явно типизируем провайдер
const APP_ROLES_GUARD = {
  provide: APP_GUARD,
  useFactory: (g: RolesGuard): RolesGuard => g,
  inject: [RolesGuard],
} satisfies FactoryProvider<RolesGuard>;

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
  providers: [AppService, RolesGuard, APP_ROLES_GUARD],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    const mode = (process.env.AUTH_MODE ?? 'fake').toLowerCase();

    if (mode === 'clerk') {
      consumer
        .apply(ClerkAuthMiddleware, OrgScopeMiddleware)
        .forRoutes({ path: '*', method: RequestMethod.ALL });
    } else {
      consumer
        .apply(HeaderAuthMiddleware, OrgScopeMiddleware)
        .forRoutes({ path: '*', method: RequestMethod.ALL });
    }
  }
}
