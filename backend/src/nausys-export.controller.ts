// backend/src/nausys-export.controller.ts
import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from './prisma/prisma.service';

type Period = { from: Date; to: Date };

function formatDM(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.`;
}

function makeNausysPeriods(year: number): Period[] {
  const periods: Period[] = [];

  const jan1 = new Date(Date.UTC(year, 0, 1));

  const firstSat = new Date(jan1);
  while (firstSat.getUTCDay() !== 6) {
    firstSat.setUTCDate(firstSat.getUTCDate() + 1);
  }

  // первая “короткая” неделя 01.01 - первая суббота
  periods.push({ from: jan1, to: new Date(firstSat) });

  let curFrom = new Date(firstSat);
  while (curFrom.getUTCFullYear() === year) {
    const curTo = new Date(curFrom);
    curTo.setUTCDate(curTo.getUTCDate() + 6);
    periods.push({ from: new Date(curFrom), to: curTo });

    curFrom = new Date(curFrom);
    curFrom.setUTCDate(curFrom.getUTCDate() + 7);
  }

  return periods;
}

@Controller('nausys')
export class NausysExportController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('export-prices')
  async exportPrices(
    @Query('year') yearStr: string,
    @Res() res: Response,
  ) {
    const year = Number(yearStr) || new Date().getFullYear();

    const from = new Date(Date.UTC(year, 0, 1));
    const to   = new Date(Date.UTC(year + 1, 0, 1));

    const slots = await this.prisma.weekSlot.findMany({
      where: {
        startDate: { gte: from, lt: to },
        yacht: { nausysId: { not: null } },
      },
      orderBy: { startDate: 'asc' },
      include: {
        yacht: {
          select: {
            nausysId: true,
            name: true,
          },
        },
      },
    });

    const periods = makeNausysPeriods(year);

    // helper: найти индекс периода, в который попадает дата старта слота
    function findPeriodIndex(startDate: Date): number | undefined {
      const t = startDate.getTime();
      for (let i = 0; i < periods.length; i++) {
        const p = periods[i];
        if (t >= p.from.getTime() && t <= p.to.getTime()) {
          return i;
        }
      }
      return undefined;
    }

    type Row = {
      nausysId: string;
      name: string | null;
      prices: (string | null)[];
    };

    const rows = new Map<string, Row>();

    for (const s of slots) {
      const nausysId = (s as any).yacht?.nausysId as string | null;
      if (!nausysId) continue;

      const yachtName = (s as any).yacht?.name as string | null;

      // находим индекс периода по дате старта слота
      const colIndex = findPeriodIndex(new Date(s.startDate));
      if (colIndex == null) continue;

      let row = rows.get(nausysId);
      if (!row) {
        row = {
          nausysId,
          name: yachtName ?? '',
          prices: Array(periods.length).fill(null),
        };
        rows.set(nausysId, row);
      }

      // Берём basePrice, если есть, иначе currentPrice
      const priceSource = (s as any).basePrice ?? (s as any).currentPrice;
      if (priceSource == null) continue;

      const price =
        typeof priceSource.toString === 'function'
          ? priceSource.toString()
          : String(priceSource);

      row.prices[colIndex] = price;
    }

    // ─ пост-обработка: заполняем пустые недели последней известной ценой ─
    for (const row of rows.values()) {
      let lastPrice: string | null = null;

      for (let i = 0; i < row.prices.length; i++) {
        const val = row.prices[i];

        if (val != null && val !== '') {
          // новая явная цена — запоминаем
          lastPrice = val;
        } else if (val == null || val === '') {
          // цены нет, но если была предыдущая — протягиваем её
          if (lastPrice != null) {
            row.prices[i] = lastPrice;
          }
        }
      }
    }

    const header = [
      'Yacht',
      'ID',
      ...periods.map(
        (p) => `${formatDM(p.from)} - ${formatDM(p.to)}`,
      ),
    ];

    const lines: string[] = [];
    lines.push(header.join(';'));

    const sortedRows = Array.from(rows.values()).sort((a, b) =>
      a.nausysId.localeCompare(b.nausysId),
    );

    for (const r of sortedRows) {
      const row = [
        r.name ?? '',
        r.nausysId,
        ...r.prices.map((v) => (v == null ? '' : String(v))),
      ]
        .map((v) => String(v).replace(/;/g, ',')) // защита от ;
        .join(';');

      lines.push(row);
    }

    const csv = lines.join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nausys-prices-${year}.csv"`,
    );
    res.send(csv);
  }
}