// backend/src/auth/auth.controller.ts
import {
  Controller,
  Get,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CurrentUser } from './current-user.decorator';
import type { User } from '@prisma/client';
import { AccessCtxService } from './access-ctx.service';
import { IsOptional, IsString } from 'class-validator';

class WhoamiQueryDto {
  @IsOptional()
  @IsString()
  yachtId?: string;
}

@Controller('auth')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AuthController {
  constructor(private readonly accessCtx: AccessCtxService) {}

  @Get('whoami')
  async whoami(@CurrentUser() user: User | null, @Query() q: WhoamiQueryDto) {
    // не аутентифицирован
    if (!user) {
      return {
        authenticated: false as const,
        mode: 'clerk' as const, // или 'fake' если включён FAKE_AUTH
      };
    }

    // если передали yachtId — подтянем ownerMode из связки OwnerYacht
    let ownerMode: import('@prisma/client').OwnerMode | null = null;
    if (q.yachtId) {
      const ctx = await this.accessCtx.build(
        { id: user.id, role: user.role, orgId: user.orgId },
        q.yachtId,
      );
      ownerMode = ctx.ownerMode ?? null;
    }

    return {
      authenticated: true as const,
      userId: user.id,
      email: user.email,
      orgId: user.orgId ?? null,
      role: user.role,
      ownerMode, // строго типизировано, без any
      mode: 'clerk' as const, // или вычисляй реальный режим
    };
  }
}
