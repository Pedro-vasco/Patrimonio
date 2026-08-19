import { Prisma } from '@prisma/client';

import {
  calculateMonthlyDepreciation,
  DepreciationService,
} from '../src/services/depreciation.service';

const createAsset = (overrides: Record<string, unknown> = {}) => ({
  id: 'asset-1',
  companyId: 'company-1',
  branchId: null,
  costCenterId: null,
  assetCode: 'AST-001',
  description: 'Notebook',
  categoryId: 'category-1',
  acquisitionDate: new Date('2024-01-01T00:00:00.000Z'),
  inServiceDate: new Date('2024-01-01T00:00:00.000Z'),
  acquisitionValue: new Prisma.Decimal(1000),
  residualValue: new Prisma.Decimal(100),
  depreciableBase: new Prisma.Decimal(900),
  usefulLifeMonths: 9,
  depreciationMethod: 'LINEAR',
  status: 'ACTIVE',
  disposalDate: null,
  disposalValue: null,
  accumulatedDepreciation: new Prisma.Decimal(0),
  netBookValue: new Prisma.Decimal(1000),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockPrisma = (assets: ReturnType<typeof createAsset>[], duplicateEntries: unknown[] = []) => {
  const tx = {
    depreciationRun: {
      create: jest.fn().mockResolvedValue({ id: 'run-1' }),
      update: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        status: 'CLOSED',
        entries: [],
      })),
    },
    depreciationEntry: {
      create: jest.fn(),
    },
    asset: {
      update: jest.fn(),
    },
  };

  return {
    asset: {
      findMany: jest.fn().mockResolvedValue(assets),
    },
    depreciationEntry: {
      findMany: jest.fn().mockResolvedValue(duplicateEntries),
    },
    depreciationRun: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    __tx: tx,
  };
};

describe('DepreciationService', () => {
  it('calculates the monthly linear depreciation', () => {
    const monthly = calculateMonthlyDepreciation(1000, 100, 9);
    expect(monthly.toNumber()).toBe(100);
  });

  it('never depreciates below residual value', async () => {
    const asset = createAsset({
      accumulatedDepreciation: new Prisma.Decimal(850),
      netBookValue: new Prisma.Decimal(150),
    });
    const prisma = createMockPrisma([asset]);
    const service = new DepreciationService(prisma as never);

    await service.runDepreciation({
      companyId: 'company-1',
      period: '2024-03',
    });

    expect(prisma.__tx.depreciationEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deprAmount: expect.any(Prisma.Decimal),
          closingNetValue: new Prisma.Decimal(100),
        }),
      }),
    );
  });

  it('prevents duplicate entries for the same asset and period', async () => {
    const prisma = createMockPrisma([createAsset()], [{ assetId: 'asset-1', period: '2024-03' }]);
    const service = new DepreciationService(prisma as never);

    await expect(
      service.runDepreciation({
        companyId: 'company-1',
        period: '2024-03',
      }),
    ).rejects.toThrow('Depreciation has already been calculated for 2024-03.');
  });

  it('skips assets that are already fully depreciated', async () => {
    const prisma = createMockPrisma([
      createAsset({
        status: 'FULLY_DEPRECIATED',
        accumulatedDepreciation: new Prisma.Decimal(900),
        netBookValue: new Prisma.Decimal(100),
      }),
    ]);
    const service = new DepreciationService(prisma as never);

    const run = await service.runDepreciation({
      companyId: 'company-1',
      period: '2024-03',
    });

    expect(prisma.__tx.depreciationEntry.create).not.toHaveBeenCalled();
    expect(run.status).toBe('CLOSED');
  });
});
