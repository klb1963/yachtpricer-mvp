import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrgService {
  constructor(private prisma: PrismaService) {}

  get(orgId: string) {
    return this.prisma.organization
      .findUnique({ where: { id: orgId } })
      .then(
        (o) =>
          o ?? Promise.reject(new NotFoundException('Organization not found')),
      );
  }

  update(orgId: string, dto: UpdateOrganizationDto) {
    return this.prisma.organization.update({ where: { id: orgId }, data: dto });
  }
}
