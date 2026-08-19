import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import prisma from '../lib/prisma';
import { calculateScheduleForPeriod, parsePeriod } from '../services/depreciation.service';
import { asyncHandler } from '../utils/http';

const reportsRouter = Router();

const positionQuerySchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  companyId: z.string().uuid(),
});

const depreciationMapQuerySchema = positionQuerySchema.extend({
  groupBy: z.enum(['costCenter', 'category', 'branch']),
});

const toNumber = (value: Prisma.Decimal) => Number(value.toFixed(2));

reportsRouter.get(
  '/position',
  asyncHandler(async (request, response) => {
    const { period, companyId } = positionQuerySchema.parse(request.query);
    const { end } = parsePeriod(period);

    const assets = await prisma.asset.findMany({
      where: {
        companyId,
        inServiceDate: {
          lte: end,
        },
      },
      include: {
        branch: true,
        costCenter: true,
        category: true,
      },
      orderBy: {
        assetCode: 'asc',
      },
    });

    const data = assets.map((asset) => {
      const schedule = calculateScheduleForPeriod(asset, period);

      return {
        id: asset.id,
        code: asset.assetCode,
        description: asset.description,
        category: asset.category.name,
        branch: asset.branch?.name ?? null,
        costCenter: asset.costCenter?.name ?? null,
        grossValue: toNumber(schedule.openingGrossValue),
        accumDepr: toNumber(schedule.closingAccumDepr),
        netValue: toNumber(schedule.closingNetValue),
      };
    });

    response.json({
      period,
      companyId,
      data,
    });
  }),
);

reportsRouter.get(
  '/depreciation-map',
  asyncHandler(async (request, response) => {
    const { period, companyId, groupBy } = depreciationMapQuerySchema.parse(request.query);
    const { end } = parsePeriod(period);

    const assets = await prisma.asset.findMany({
      where: {
        companyId,
        inServiceDate: {
          lte: end,
        },
      },
      include: {
        branch: true,
        costCenter: true,
        category: true,
      },
    });

    const grouped = assets.reduce<Record<string, { group: string; assetCount: number; depreciationAmount: number; grossValue: number; netValue: number }>>(
      (accumulator, asset) => {
        const schedule = calculateScheduleForPeriod(asset, period);
        const group =
          groupBy === 'branch'
            ? asset.branch?.name ?? 'Sem filial'
            : groupBy === 'costCenter'
              ? asset.costCenter?.name ?? 'Sem centro de custo'
              : asset.category.name;

        if (!accumulator[group]) {
          accumulator[group] = {
            group,
            assetCount: 0,
            depreciationAmount: 0,
            grossValue: 0,
            netValue: 0,
          };
        }

        accumulator[group].assetCount += 1;
        accumulator[group].depreciationAmount += toNumber(schedule.deprAmount);
        accumulator[group].grossValue += toNumber(schedule.openingGrossValue);
        accumulator[group].netValue += toNumber(schedule.closingNetValue);
        return accumulator;
      },
      {},
    );

    response.json({
      period,
      companyId,
      groupBy,
      data: Object.values(grouped).sort((left, right) => left.group.localeCompare(right.group)),
    });
  }),
);

export default reportsRouter;
