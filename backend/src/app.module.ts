// backend/src/app.module.ts
import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
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
import { GeoModule } from './geo/geo.module';
import { CompetitorFiltersModule } from './filters/competitor-filters.module';
import { CatalogModule } from './catalog/catalog.module';
import { NausysExportController } from './nausys-export.controller';

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
    GeoModule,
    CompetitorFiltersModule,
    CatalogModule,
  ],
  controllers: [AppController, YachtsController, NausysExportController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: RolesGuard }, // @Public учитывается
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    const mode = (process.env.AUTH_MODE ?? 'fake').toLowerCase();

    // health остаётся публичным и без всех мидлварей
    const PUBLIC_HEALTH = [
      { path: 'health', method: RequestMethod.ALL },
      { path: 'api/health', method: RequestMethod.ALL },
    ];

    if (mode === 'clerk') {
      // ❌ раньше исключался whoami — из-за этого req.user был пуст
      // ✅ НЕ исключаем whoami: пусть middleware заполняет req.user,
      //    а доступ контролируется через @Public() на самом хендлере
      consumer
        .apply(ClerkAuthMiddleware)
        .exclude(...PUBLIC_HEALTH)
        .forRoutes({ path: '*', method: RequestMethod.ALL });

      consumer
        .apply(OrgScopeMiddleware)
        .exclude(...PUBLIC_HEALTH)
        .forRoutes({ path: '*', method: RequestMethod.ALL });
    } else {
      // В fake-режиме HeaderAuth читает X-User-Email и кладёт req.user.
      consumer
        .apply(HeaderAuthMiddleware)
        .exclude(...PUBLIC_HEALTH)
        .forRoutes({ path: '*', method: RequestMethod.ALL });

      consumer
        .apply(OrgScopeMiddleware)
        .exclude(...PUBLIC_HEALTH)
        .forRoutes({ path: '*', method: RequestMethod.ALL });
    }
  }
}
