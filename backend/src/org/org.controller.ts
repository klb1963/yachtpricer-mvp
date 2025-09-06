// backend/src/org/org.controller.ts
import { Controller, Get, Patch, Body, BadRequestException } from '@nestjs/common';
import { OrgService } from './org.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Controller('org')
export class OrgController {
  constructor(private readonly service: OrgService) {}

  @Get()
  async get() {
    const orgId = await this.service.findIdBySlug('aquatoria');
    if (!orgId) throw new BadRequestException('Organization "aquatoria" not found (run seed)');
    return this.service.get(orgId);
  }

  @Patch()
  async patch(@Body() dto: UpdateOrganizationDto) {
    const orgId = await this.service.findIdBySlug('aquatoria');
    if (!orgId) throw new BadRequestException('Organization "aquatoria" not found (run seed)');
    return this.service.update(orgId, dto);
  }
}