import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from './current-user.decorator';
import type { User, $Enums } from '@prisma/client';

type UserLike = User & Partial<{ ownerMode: $Enums.OwnerMode | null }>;

type WhoAmI =
  | { authenticated: false; mode: string }
  | {
      authenticated: true;
      userId: string;
      email: string;
      orgId: string | null;
      role: $Enums.Role | null;
      ownerMode: $Enums.OwnerMode | null;
      mode: string;
    };

@Controller('auth')
export class AuthController {
  @Get('whoami')
  whoami(@CurrentUser() user: UserLike | null): WhoAmI {
    const mode = process.env.AUTH_MODE ?? 'fake';
    if (!user) return { authenticated: false, mode };

    return {
      authenticated: true,
      userId: user.id,
      email: user.email,
      orgId: user.orgId,
      role: user.role,
      ownerMode: user.ownerMode ?? null, // безопасно: поле опциональное
      mode,
    };
  }
}
