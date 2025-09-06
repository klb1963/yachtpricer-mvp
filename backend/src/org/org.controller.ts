import {
  Controller,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { OrgService } from './org.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrgAdminGuard } from '../auth/org-admin.guard';

@Controller('org')
export class OrgController {
  constructor(private readonly service: OrgService) {}

  @Get()
  async get(@Req() req: Request) {
    const orgId = req.orgId;
    if (!orgId) throw new BadRequestException('orgId is missing in request');
    return this.service.get(orgId);
  }

  @Patch()
  @UseGuards(OrgAdminGuard)
  async patch(@Req() req: Request, @Body() dto: UpdateOrganizationDto) {
    const orgId = req.orgId;
    if (!orgId) throw new BadRequestException('orgId is missing in request');
    return this.service.update(orgId, dto);
  }
}
