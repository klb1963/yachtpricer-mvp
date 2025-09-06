// backend/src/org/org.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrgService {
  constructor(private prisma: PrismaService) {}

  // Получить организацию по id (404 если нет)
  async get(orgId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  // НУЖНЫЙ МЕТОД: вернуть id по slug (или null)
  async findIdBySlug(slug: string): Promise<string | null> {
    const org = await this.prisma.organization.findUnique({ where: { slug } });
    return org?.id ?? null;
  }

  // Обновление организации
  async update(orgId: string, dto: UpdateOrganizationDto) {
    return this.prisma.organization.update({
      where: { id: orgId },
      data: dto,
    });
  }
}
