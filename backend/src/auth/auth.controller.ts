// backend/src/auth/auth.controller.ts

import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { WhoAmIResponse } from './whoami.dto';

@Controller('/api/auth')
export class AuthController {
  @Get('whoami')
  whoami(@Req() req: Request): WhoAmIResponse {
    const user = req.user ?? null;
    return {
      authenticated: !!user,
      user: user
        ? {
            id: user.id,
            email: user.email,
            role: user.role,
            orgId: user.orgId,
            ownerMode: user.ownerMode ?? null,
            name: user.name ?? null,
          }
        : null,
      orgId: req.orgId ?? null,
    };
  }
}
