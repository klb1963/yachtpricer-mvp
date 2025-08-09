import { Controller, Get, Param } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Controller('yachts')
export class YachtsController {
  @Get()
  async list() {
    // простая выдача без пагинации (добавим позже)
    return prisma.yacht.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Get(':id')
  async byId(@Param('id') id: string) {
    return prisma.yacht.findUnique({ where: { id } });
  }
}