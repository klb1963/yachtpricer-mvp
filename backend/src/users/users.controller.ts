// backend/src/users/users.controller.ts
import { Controller, Get, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrgAdminGuard } from '../auth/org-admin.guard';
import { IsEnum, IsString, IsBoolean } from 'class-validator';
import { Roles } from '../auth/roles.decorator';

class UpdateUserRoleDto {
  @IsString() userId!: string;
  @IsEnum(Role) role!: Role;
}

class UpdateUserActiveDto {
  @IsString() userId!: string;
  @IsBoolean() isActive!: boolean;
}

@UseGuards(OrgAdminGuard)
// контроллер доступен ADMIN и FLEET_MANAGER (org-level)
@Controller('users')
@Roles('ADMIN', 'FLEET_MANAGER')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {
    console.log('✅ UsersController mounted at /users');
  }

  // GET /api/users?orgId=&q=&page=1&limit=20
  @Get()
  async list(
    @Query('orgId') orgId?: string,
    @Query('q') q?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));

    const where: Prisma.UserWhereInput = {};
    if (orgId) where.orgId = orgId;
    if (q?.trim()) {
      const s = q.trim();
      where.OR = [
        { email: { contains: s, mode: 'insensitive' } },
        { name: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * l,
        take: l,
        // ⚠️ ВАЖНО: используем ТОЛЬКО select, без include
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          orgId: true,
          isActive: true,
          createdAt: true,
          org: { select: { slug: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page: p, limit: l };
  }

  // PATCH /api/users/role
  @Patch('role')
  async updateRole(@Body() dto: UpdateUserRoleDto) {
    return this.prisma.user.update({
      where: { id: dto.userId },
      data: { role: dto.role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        orgId: true,
        isActive: true,
      },
    });
  }

  // PATCH /api/users/active
  @Patch('active')
  async updateActive(@Body() dto: UpdateUserActiveDto) {
    return this.prisma.user.update({
      where: { id: dto.userId },
      data: { isActive: dto.isActive },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        orgId: true,
        isActive: true,
      },
    });
  }
}
