// backend/src/org/org-scope.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { OrgService } from './org.service';

/**
 * Ставит `req.orgId` на основании заголовков:
 *  - X-Org-Id:  прямой ID организации
 *  - X-Org-Slug: слаг организации (конвертируется в ID через OrgService)
 */
@Injectable()
export class OrgScopeMiddleware implements NestMiddleware {
  constructor(private readonly orgService: OrgService) {}

  private normalize(v: string | undefined): string | null {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t ? t : null;
  }

  async use(req: Request, _res: Response, next: NextFunction) {
    try {
      // Health-путь не требует orgId
      const path = req.path ?? req.url ?? '';
      if (path === '/health' || path === '/api/health') {
        req.orgId = null;
        return next();
      }

      const orgIdHeader = this.normalize(req.header('X-Org-Id'));
      const orgSlug = this.normalize(req.header('X-Org-Slug'));

      if (orgIdHeader) {
        req.orgId = orgIdHeader;
      } else if (orgSlug) {
        // если slug передан — пробуем получить id
        const id = await this.orgService.findIdBySlug(orgSlug);
        req.orgId = id ?? null;
      } else {
        req.orgId = null;
      }
    } catch {
      req.orgId = null;
    }
    next();
  }
}
