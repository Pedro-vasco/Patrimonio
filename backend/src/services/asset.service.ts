import { Prisma, PrismaClient } from '@prisma/client';

import { ApiError } from '../utils/http';

type PrismaLike = Pick<
  PrismaClient,
  'asset' | 'assetCategory' | 'branch' | 'costCenter'
>;

type DecimalInput = string | number | Prisma.Decimal;

export interface AssetFilters {
  status?: string;
  categoryId?: string;
  branchId?: string;
  costCenterId?: string;
  search?: string;
}

export interface AssetListParams {
  page: number;
  pageSize: number;
}

export interface CreateAssetInput {
  companyId: string;
  branchId?: string;
  costCenterId?: string;
  assetCode: string;
  description: string;
  categoryId: string;
  acquisitionDate: Date;
  inServiceDate: Date;
  acquisitionValue: DecimalInput;
  residualValue?: DecimalInput;
  depreciableBase?: DecimalInput;
  usefulLifeMonths?: number;
  depreciationMethod?: string;
  status?: string;
  disposalDate?: Date;
  disposalValue?: DecimalInput;
}

export type UpdateAssetInput = Partial<CreateAssetInput>;

const toDecimal = (value: DecimalInput) =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);

const roundCurrency = (value: Prisma.Decimal) => new Prisma.Decimal(value.toFixed(2));

const maxDecimal = (left: Prisma.Decimal, right: Prisma.Decimal) =>
  left.greaterThan(right) ? left : right;

export class AssetService {
  constructor(private readonly prisma: PrismaLike) {}

  async listAssets(filters: AssetFilters, pagination: AssetListParams) {
    const where: Prisma.AssetWhereInput = {
      status: filters.status || undefined,
      categoryId: filters.categoryId || undefined,
      branchId: filters.branchId || undefined,
      costCenterId: filters.costCenterId || undefined,
      OR: filters.search
        ? [
            {
              assetCode: {
                contains: filters.search,
                mode: 'insensitive',
              },
            },
            {
              description: {
                contains: filters.search,
                mode: 'insensitive',
              },
            },
          ]
        : undefined,
    };

    const [total, data] = await Promise.all([
      this.prisma.asset.count({ where }),
      this.prisma.asset.findMany({
        where,
        include: {
          company: true,
          branch: true,
          costCenter: true,
          category: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
    ]);

    return {
      data,
      meta: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages: Math.ceil(total / pagination.pageSize) || 1,
      },
    };
  }

  async getAssetById(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        company: true,
        branch: true,
        costCenter: true,
        category: true,
        events: true,
        depreciationEntries: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!asset) {
      throw new ApiError(404, 'Asset not found.');
    }

    return asset;
  }

  async createAsset(input: CreateAssetInput) {
    const category = await this.prisma.assetCategory.findFirst({
      where: {
        id: input.categoryId,
        companyId: input.companyId,
      },
    });

    if (!category) {
      throw new ApiError(400, 'Invalid asset category for the selected company.');
    }

    await this.assertBelongsToCompany(input.companyId, input.branchId, input.costCenterId);

    const acquisitionValue = roundCurrency(toDecimal(input.acquisitionValue));
    const residualValue = roundCurrency(
      input.residualValue !== undefined
        ? toDecimal(input.residualValue)
        : acquisitionValue.mul(category.residualPercent).div(100),
    );

    if (residualValue.greaterThan(acquisitionValue)) {
      throw new ApiError(400, 'Residual value cannot exceed acquisition value.');
    }

    const usefulLifeMonths = input.usefulLifeMonths ?? category.usefulLifeMonths;
    const depreciableBase = roundCurrency(
      input.depreciableBase !== undefined
        ? toDecimal(input.depreciableBase)
        : acquisitionValue.minus(residualValue),
    );
    const netBookValue = roundCurrency(acquisitionValue);
    const status =
      input.status ?? (netBookValue.lte(residualValue) ? 'FULLY_DEPRECIATED' : 'ACTIVE');

    return this.prisma.asset.create({
      data: {
        companyId: input.companyId,
        branchId: input.branchId,
        costCenterId: input.costCenterId,
        assetCode: input.assetCode,
        description: input.description,
        categoryId: input.categoryId,
        acquisitionDate: input.acquisitionDate,
        inServiceDate: input.inServiceDate,
        acquisitionValue,
        residualValue,
        depreciableBase,
        usefulLifeMonths,
        depreciationMethod: input.depreciationMethod ?? 'LINEAR',
        status,
        disposalDate: input.disposalDate,
        disposalValue:
          input.disposalValue !== undefined ? roundCurrency(toDecimal(input.disposalValue)) : undefined,
        accumulatedDepreciation: new Prisma.Decimal(0),
        netBookValue,
      },
      include: {
        company: true,
        branch: true,
        costCenter: true,
        category: true,
      },
    });
  }

  async updateAsset(id: string, input: UpdateAssetInput) {
    const existing = await this.prisma.asset.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new ApiError(404, 'Asset not found.');
    }

    const companyId = input.companyId ?? existing.companyId;
    const categoryId = input.categoryId ?? existing.categoryId;
    const category = await this.prisma.assetCategory.findFirst({
      where: {
        id: categoryId,
        companyId,
      },
    });

    if (!category) {
      throw new ApiError(400, 'Invalid asset category for the selected company.');
    }

    await this.assertBelongsToCompany(
      companyId,
      input.branchId ?? existing.branchId ?? undefined,
      input.costCenterId ?? existing.costCenterId ?? undefined,
    );

    const acquisitionValue = roundCurrency(
      input.acquisitionValue !== undefined
        ? toDecimal(input.acquisitionValue)
        : existing.acquisitionValue,
    );
    const residualValue = roundCurrency(
      input.residualValue !== undefined ? toDecimal(input.residualValue) : existing.residualValue,
    );

    if (residualValue.greaterThan(acquisitionValue)) {
      throw new ApiError(400, 'Residual value cannot exceed acquisition value.');
    }

    const accumulatedDepreciation = existing.accumulatedDepreciation;
    const netBookValue = roundCurrency(
      maxDecimal(residualValue, acquisitionValue.minus(accumulatedDepreciation)),
    );
    const derivedStatus =
      netBookValue.lte(residualValue) || existing.status === 'FULLY_DEPRECIATED'
        ? 'FULLY_DEPRECIATED'
        : input.status ?? existing.status;

    return this.prisma.asset.update({
      where: { id },
      data: {
        companyId,
        branchId: input.branchId ?? existing.branchId,
        costCenterId: input.costCenterId ?? existing.costCenterId,
        assetCode: input.assetCode ?? existing.assetCode,
        description: input.description ?? existing.description,
        categoryId,
        acquisitionDate: input.acquisitionDate ?? existing.acquisitionDate,
        inServiceDate: input.inServiceDate ?? existing.inServiceDate,
        acquisitionValue,
        residualValue,
        depreciableBase:
          input.depreciableBase !== undefined
            ? roundCurrency(toDecimal(input.depreciableBase))
            : roundCurrency(acquisitionValue.minus(residualValue)),
        usefulLifeMonths: input.usefulLifeMonths ?? existing.usefulLifeMonths,
        depreciationMethod: input.depreciationMethod ?? existing.depreciationMethod,
        status: derivedStatus,
        disposalDate: input.disposalDate ?? existing.disposalDate,
        disposalValue:
          input.disposalValue !== undefined
            ? roundCurrency(toDecimal(input.disposalValue))
            : existing.disposalValue,
        netBookValue,
      },
      include: {
        company: true,
        branch: true,
        costCenter: true,
        category: true,
      },
    });
  }

  private async assertBelongsToCompany(
    companyId: string,
    branchId?: string,
    costCenterId?: string,
  ) {
    if (branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          id: branchId,
          companyId,
        },
      });

      if (!branch) {
        throw new ApiError(400, 'Invalid branch for the selected company.');
      }
    }

    if (costCenterId) {
      const costCenter = await this.prisma.costCenter.findFirst({
        where: {
          id: costCenterId,
          companyId,
        },
      });

      if (!costCenter) {
        throw new ApiError(400, 'Invalid cost center for the selected company.');
      }
    }
  }
}
