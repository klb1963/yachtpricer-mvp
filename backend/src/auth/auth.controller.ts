// backend/src/auth/auth.controller.ts
import {
  Controller,
  Get,
  Query,
  UsePipes,
  ValidationPipe,
  Req,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { CurrentUser } from './current-user.decorator';
import { AccessCtxService } from './access-ctx.service';
import { IsOptional, IsString } from 'class-validator';
import { Public } from './public.decorator';

class WhoamiQueryDto {
  @IsOptional()
  @IsString()
  yachtId?: string;
}

@Controller('auth')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AuthController {
  private readonly log = new Logger(AuthController.name);

  constructor(private readonly accessCtx: AccessCtxService) {}

  @Get('whoami')
  @Public()
  async whoami(
    @CurrentUser() user: User | null,
    @Query() q: WhoamiQueryDto,
    @Req() req: Request & { user?: User | null },
  ) {
    const mode =
      (process.env.AUTH_MODE ?? 'fake').toLowerCase() === 'clerk'
        ? ('clerk' as const)
        : ('fake' as const);

    // Диагностика входа
    this.log.debug(
      `whoami(): authHeader=${req.headers.authorization ? 'present' : 'absent'}; mode=${mode}`,
    );
    this.log.debug(
      `whoami(): CurrentUser=${user ? `${user.email}/${user.role}` : 'null'}`,
    );
    this.log.debug(
      `whoami(): req.user=${req.user ? `${req.user.email}/${req.user.role}` : 'null'}`,
    );

    // Берём пользователя из декоратора или из req.user, что есть
    const u: User | null = user ?? req.user ?? null;

    if (!u) {
      this.log.debug('whoami(): no user → authenticated=false');
      return {
        authenticated: false as const,
        mode,
      };
    }

    // Если передали yachtId — попробуем подтянуть ownerMode
    let ownerMode: import('@prisma/client').OwnerMode | null = null;
    if (q.yachtId) {
      try {
        const ctx = await this.accessCtx.build(
          { id: u.id, role: u.role, orgId: u.orgId },
          q.yachtId,
        );
        ownerMode = ctx.ownerMode ?? null;
      } catch (e) {
        this.log.warn(
          `whoami(): accessCtx.build failed for yachtId=${q.yachtId}: ${(e as Error)?.message ?? e}`,
        );
      }
    }

    this.log.debug(
      `whoami(): OK user=${u.email} role=${u.role} org=${u.orgId ?? 'null'} ownerMode=${ownerMode ?? 'null'}`,
    );

    return {
      authenticated: true as const,
      userId: u.id,
      email: u.email,
      orgId: u.orgId ?? null,
      role: u.role,
      ownerMode,
      mode,
    };
  }
}
