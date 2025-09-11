// backend/src/org/org-scope.middleware.ts

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { OrgService } from './org.service';

/**
 * Читает X-Org-Id или X-Org-Slug и выставляет req.orgId
 */
@Injectable()
export class OrgScopeMiddleware implements NestMiddleware {
  constructor(private readonly orgService: OrgService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const orgIdHeader = req.header('X-Org-Id')?.trim();
    const orgSlug = req.header('X-Org-Slug')?.trim();

    try {
      if (orgIdHeader) {
        req.orgId = orgIdHeader;
      } else if (orgSlug) {
        req.orgId = await this.orgService.findIdBySlug(orgSlug);
      } else {
        req.orgId = null;
      }
    } catch {
      req.orgId = null;
    }
    next();
  }
}
