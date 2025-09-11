// backend/src/users/users.controller.ts
import { Controller, Get, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrgAdminGuard } from '../auth/org-admin.guard';
import { Role, Prisma } from '@prisma/client';

class UpdateUserRoleDto {
  userId!: string;
  role!: Role;
}

@UseGuards(OrgAdminGuard)
@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(
    @Query('orgId') orgId?: string,
    @Query('q') q?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));

    // ✅ строгая типизация вместо any
    const where: Prisma.UserWhereInput = {};
    if (orgId) where.orgId = orgId;
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * l,
        take: l,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          orgId: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page: p, limit: l };
  }

  @Patch('role')
  async updateRole(@Body() dto: UpdateUserRoleDto) {
    return this.prisma.user.update({
      where: { id: dto.userId },
      data: { role: dto.role },
      select: { id: true, email: true, name: true, role: true, orgId: true },
    });
  }
}
