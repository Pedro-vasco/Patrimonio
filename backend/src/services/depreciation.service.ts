import { Asset, Prisma, PrismaClient } from '@prisma/client';

import { ApiError } from '../utils/http';

type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

type PrismaLike = Pick<
  PrismaClient,
  '$transaction' | 'asset' | 'depreciationEntry' | 'depreciationRun'
>;

type AssetWithRelations = Asset;

const PERIOD_PATTERN = /^\d{4}-\d{2}$/;

const roundCurrency = (value: Prisma.Decimal) => new Prisma.Decimal(value.toFixed(2));

const toDecimal = (value: Prisma.Decimal | string | number) =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);

const minDecimal = (left: Prisma.Decimal, right: Prisma.Decimal) =>
  left.lessThan(right) ? left : right;

const maxDecimal = (left: Prisma.Decimal, right: Prisma.Decimal) =>
  left.greaterThan(right) ? left : right;

export const parsePeriod = (period: string) => {
  if (!PERIOD_PATTERN.test(period)) {
    throw new ApiError(400, 'Period must be in YYYY-MM format.');
  }

  const [year, month] = period.split('-').map(Number);

  if (month < 1 || month > 12) {
    throw new ApiError(400, 'Invalid month in period.');
  }

  return {
    year,
    month,
    start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  };
};

const monthNumber = (date: Date) => date.getUTCFullYear() * 12 + date.getUTCMonth();

const getServiceMonthsUntilPeriod = (inServiceDate: Date, period: string) => {
  const { start } = parsePeriod(period);
  const months = monthNumber(start) - monthNumber(inServiceDate) + 1;

  return Math.max(0, months);
};

export const calculateMonthlyDepreciation = (
  acquisitionValue: Prisma.Decimal | number | string,
  residualValue: Prisma.Decimal | number | string,
  usefulLifeMonths: number,
) => {
  if (usefulLifeMonths <= 0) {
    throw new ApiError(400, 'Useful life months must be greater than zero.');
  }

  const gross = toDecimal(acquisitionValue);
  const residual = toDecimal(residualValue);
  return roundCurrency(gross.minus(residual).div(usefulLifeMonths));
};

export const calculateScheduleForPeriod = (asset: AssetWithRelations, period: string) => {
  const { start } = parsePeriod(period);

  if (asset.inServiceDate > start && monthNumber(asset.inServiceDate) > monthNumber(start)) {
    return {
      eligible: false,
      openingGrossValue: roundCurrency(asset.acquisitionValue),
      openingAccumDepr: new Prisma.Decimal(0),
      deprAmount: new Prisma.Decimal(0),
      closingAccumDepr: new Prisma.Decimal(0),
      closingNetValue: roundCurrency(asset.acquisitionValue),
    };
  }

  const gross = roundCurrency(asset.acquisitionValue);
  const residual = roundCurrency(asset.residualValue);
  const monthlyDepreciation = calculateMonthlyDepreciation(
    asset.acquisitionValue,
    asset.residualValue,
    asset.usefulLifeMonths,
  );
  const monthsInService = Math.min(
    asset.usefulLifeMonths,
    getServiceMonthsUntilPeriod(asset.inServiceDate, period),
  );

  if (monthsInService <= 0) {
    return {
      eligible: false,
      openingGrossValue: gross,
      openingAccumDepr: new Prisma.Decimal(0),
      deprAmount: new Prisma.Decimal(0),
      closingAccumDepr: new Prisma.Decimal(0),
      closingNetValue: gross,
    };
  }

  const openingMonths = Math.max(0, monthsInService - 1);
  const openingAccumDepr = roundCurrency(
    minDecimal(gross.minus(residual), monthlyDepreciation.mul(openingMonths)),
  );
  const remaining = gross.minus(residual).minus(openingAccumDepr);
  const deprAmount = roundCurrency(minDecimal(monthlyDepreciation, maxDecimal(remaining, new Prisma.Decimal(0))));
  const closingAccumDepr = roundCurrency(openingAccumDepr.plus(deprAmount));
  const closingNetValue = roundCurrency(maxDecimal(residual, gross.minus(closingAccumDepr)));

  return {
    eligible: deprAmount.greaterThan(0),
    openingGrossValue: gross,
    openingAccumDepr,
    deprAmount,
    closingAccumDepr,
    closingNetValue,
  };
};

export class DepreciationService {
  constructor(private readonly prisma: PrismaLike) {}

  async runDepreciation(input: { period: string; bookType?: string; companyId: string }) {
    const { end } = parsePeriod(input.period);

    const assets = await this.prisma.asset.findMany({
      where: {
        companyId: input.companyId,
        inServiceDate: {
          lte: end,
        },
      },
      orderBy: {
        assetCode: 'asc',
      },
    });

    const actionableAssets = assets.filter((asset) => {
      const residual = roundCurrency(asset.residualValue);
      const currentNet = roundCurrency(asset.netBookValue);
      return (
        asset.status !== 'DISPOSED' &&
        currentNet.greaterThan(residual) &&
        calculateScheduleForPeriod(asset, input.period).eligible
      );
    });

    if (actionableAssets.length > 0) {
      const duplicateEntries = await this.prisma.depreciationEntry.findMany({
        where: {
          assetId: {
            in: actionableAssets.map((asset) => asset.id),
          },
          period: input.period,
        },
        select: {
          assetId: true,
          period: true,
        },
      });

      if (duplicateEntries.length > 0) {
        throw new ApiError(
          409,
          `Depreciation has already been calculated for ${input.period}.`,
          duplicateEntries,
        );
      }
    }

    return this.prisma.$transaction(async (transaction) => {
      const tx = transaction as PrismaTransactionClient;
      const run = await tx.depreciationRun.create({
        data: {
          companyId: input.companyId,
          period: input.period,
          bookType: input.bookType ?? 'CONTABIL',
          status: 'DRAFT',
        },
      });

      for (const asset of actionableAssets) {
        const openingGrossValue = roundCurrency(asset.acquisitionValue);
        const openingAccumDepr = roundCurrency(asset.accumulatedDepreciation);
        const residualValue = roundCurrency(asset.residualValue);
        const monthlyDepr = calculateMonthlyDepreciation(
          asset.acquisitionValue,
          asset.residualValue,
          asset.usefulLifeMonths,
        );
        const remainingBase = openingGrossValue.minus(residualValue).minus(openingAccumDepr);

        if (remainingBase.lte(0)) {
          await tx.asset.update({
            where: { id: asset.id },
            data: {
              status: 'FULLY_DEPRECIATED',
              netBookValue: residualValue,
            },
          });
          continue;
        }

        const deprAmount = roundCurrency(minDecimal(monthlyDepr, remainingBase));
        const closingAccumDepr = roundCurrency(openingAccumDepr.plus(deprAmount));
        const closingNetValue = roundCurrency(
          maxDecimal(residualValue, openingGrossValue.minus(closingAccumDepr)),
        );

        if (deprAmount.lte(0)) {
          continue;
        }

        await tx.depreciationEntry.create({
          data: {
            runId: run.id,
            assetId: asset.id,
            period: input.period,
            openingGrossValue,
            openingAccumDepr,
            deprAmount,
            closingAccumDepr,
            closingNetValue,
          },
        });

        await tx.asset.update({
          where: { id: asset.id },
          data: {
            accumulatedDepreciation: closingAccumDepr,
            netBookValue: closingNetValue,
            status: closingNetValue.lte(residualValue) ? 'FULLY_DEPRECIATED' : 'ACTIVE',
          },
        });
      }

      return tx.depreciationRun.update({
        where: {
          id: run.id,
        },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
        },
        include: {
          company: true,
          entries: {
            include: {
              asset: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });
    });
  }

  async listRuns(page: number, pageSize: number) {
    const [total, data] = await Promise.all([
      this.prisma.depreciationRun.count(),
      this.prisma.depreciationRun.findMany({
        include: {
          company: true,
          _count: {
            select: {
              entries: true,
            },
          },
        },
        orderBy: {
          startedAt: 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }
}
