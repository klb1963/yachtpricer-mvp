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

  // первая “короткая” неделя: 01.01 .. ПТ перед первой субботой
  // (иначе firstSat попадает в ДВА периода)
  const firstShortTo = new Date(firstSat);
  firstShortTo.setUTCDate(firstShortTo.getUTCDate() - 1);
  periods.push({ from: jan1, to: firstShortTo });

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
  async exportPrices(@Query('year') yearStr: string, @Res() res: Response) {
    const year = Number(yearStr) || new Date().getFullYear();

    const from = new Date(Date.UTC(year, 0, 1));
    const to = new Date(Date.UTC(year + 1, 0, 1));

    // 1) базовый прайс-лист
    // ✅ Экспортируем прайс-лист из PriceListNode (то, что правит Виктория),
    // а не weekSlot / price_history.
    const nodes = await this.prisma.priceListNode.findMany({
      where: {
        weekStart: { gte: from, lt: to },
        yacht: { nausysId: { not: null } },
      },
      orderBy: [{ weekStart: 'asc' }, { updatedAt: 'asc' }],
      include: {
        yacht: {
          select: {
            nausysId: true,
            name: true,
          },
        },
      },
    });

    // 2) оверрайды по согласованным скидкам (APPROVED finalPrice)
    // Если на конкретную неделю скидка согласована — в CSV должна уйти цена со скидкой.
    const approvedDecisions = await this.prisma.pricingDecision.findMany({
      where: {
        weekStart: { gte: from, lt: to },
        status: 'APPROVED',
        finalPrice: { not: null },
        yacht: { nausysId: { not: null } },
      },
      orderBy: [{ weekStart: 'asc' }],
      select: {
        weekStart: true,
        finalPrice: true,
        yacht: {
          select: {
            nausysId: true,
            name: true,
          },
        },
      },
    });

    const periods = makeNausysPeriods(year);

    // helper: найти индекс периода, в который попадает дата старта
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

    for (const n of nodes) {
      const nausysId = n.yacht?.nausysId ?? null;
      if (!nausysId) continue;

      const yachtName = n.yacht?.name ?? null;

      // находим индекс периода по дате старта слота
      const colIndex = findPeriodIndex(new Date(n.weekStart));
      if (colIndex == null) continue;

      let row = rows.get(nausysId);
      if (!row) {
        row = {
          nausysId,
          name: yachtName ?? '',
          prices: Array<string | null>(periods.length).fill(null),
        };
        rows.set(nausysId, row);
      }

      // Цена прайса из PriceListNode
      // Prisma.Decimal -> String ок.
      const price: string = String(n.price);

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
      // 3) применяем оверрайды (approved finalPrice) поверх прайс-листа
      // ВАЖНО: после оверрайдов НЕ делаем fill-forward, чтобы скидка не "растекалась" на следующие недели
      for (const d of approvedDecisions) {
        const nausysId = d.yacht?.nausysId ?? null;
        if (!nausysId) continue;

        const colIndex = findPeriodIndex(new Date(d.weekStart));
        if (colIndex == null) continue;

        let row = rows.get(nausysId);
        if (!row) {
          row = {
            nausysId,
            name: d.yacht?.name ?? '',
            prices: Array<string | null>(periods.length).fill(null),
          };
          rows.set(nausysId, row);
        } else if (!row.name) {
          row.name = d.yacht?.name ?? row.name;
        }

        row.prices[colIndex] = String(d.finalPrice);
      }
    }

    const header = [
      'Yacht',
      'ID',
      ...periods.map((p) => `${formatDM(p.from)} - ${formatDM(p.to)}`),
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
