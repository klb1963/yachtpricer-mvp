// backend/src/geo/geo.service.ts
import { Injectable } from '@nestjs/common';
import { Prisma, LocationSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GeoService {
  constructor(private prisma: PrismaService) {}

  getCountries() {
    return this.prisma.country.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true, // ← НУЖНО для react-select (value)
        code2: true,
        name: true,
        nausysId: true,
        code3: true,
      },
    });
  }

  async getLocations(params: {
    q?: string;
    countryCode?: string;
    orderBy?: 'name' | 'countryCode';
    take?: number;
    skip?: number;
  }) {
    const { q, countryCode, orderBy = 'name', take = 50, skip = 0 } = params;

    // базовый where строго типизирован
    const where: Prisma.LocationWhereInput = {
      source: LocationSource.NAUSYS,
    };

    if (countryCode) {
      where.countryCode = countryCode.toUpperCase();
    }

    if (q && q.trim()) {
      const query = q.trim();
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        {
          aliases: {
            some: { alias: { contains: query, mode: 'insensitive' } },
          },
        },
        {
          aliases: {
            some: {
              normalized: { contains: query.toLowerCase() },
            },
          },
        },
      ] as Prisma.LocationWhereInput['OR'];
    }

    const order: Prisma.LocationOrderByWithRelationInput = {
      [orderBy]: 'asc',
    } as Prisma.LocationOrderByWithRelationInput;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.location.findMany({
        where,
        orderBy: order,
        skip,
        take,
        select: {
          id: true,
          externalId: true,
          name: true,
          countryCode: true,
          lat: true,
          lon: true,
          aliases: {
            select: { alias: true },
            orderBy: { alias: 'asc' }, // 👈 обязательно при take/skip
            take: 5,
          },
        },
      }),
      this.prisma.location.count({ where }),
    ]);

    return { items, total, skip, take };
  }
}
