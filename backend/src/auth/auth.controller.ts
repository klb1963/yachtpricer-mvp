// backend/src/auth/auth.controller.ts

import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';

@Controller('auth')
export class AuthController {
  @Get('whoami')
  whoami(@Req() req: Request) {
    const user = req.user;

    if (!user) {
      return { user: null };
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      orgId: user.orgId,
      name: user.name,
    };
  }
}
