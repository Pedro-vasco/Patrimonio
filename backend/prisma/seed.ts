import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const currency = (value: number) => new Prisma.Decimal(value.toFixed(2));

const monthDiffInclusive = (from: Date, to: Date) =>
  Math.max(
    0,
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
      (to.getUTCMonth() - from.getUTCMonth()) +
      1,
  );

const buildAssetValues = (
  acquisitionValue: number,
  residualPercent: number,
  usefulLifeMonths: number,
  inServiceDate: Date,
) => {
  const residualValue = currency(acquisitionValue * (residualPercent / 100));
  const depreciableBase = currency(acquisitionValue - residualValue.toNumber());
  const monthlyDepreciation = depreciableBase.div(usefulLifeMonths);
  const monthsElapsed = Math.min(
    usefulLifeMonths,
    monthDiffInclusive(inServiceDate, new Date()),
  );
  const accumulatedDepreciation = currency(
    Math.min(
      depreciableBase.toNumber(),
      monthlyDepreciation.mul(monthsElapsed).toNumber(),
    ),
  );
  const netBookValue = currency(
    Math.max(
      residualValue.toNumber(),
      acquisitionValue - accumulatedDepreciation.toNumber(),
    ),
  );

  return {
    residualValue,
    depreciableBase,
    accumulatedDepreciation,
    netBookValue,
    status:
      netBookValue.lte(residualValue) || monthsElapsed >= usefulLifeMonths
        ? 'FULLY_DEPRECIATED'
        : 'ACTIVE',
  };
};

async function main() {
  await prisma.depreciationEntry.deleteMany();
  await prisma.depreciationRun.deleteMany();
  await prisma.assetEvent.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.depreciationRule.deleteMany();
  await prisma.assetCategory.deleteMany();
  await prisma.costCenter.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  const company = await prisma.company.create({
    data: {
      name: 'Empresa Exemplo Ltda',
      cnpj: '12.345.678/0001-99',
    },
  });

  const [matriz, filialSp] = await Promise.all([
    prisma.branch.create({
      data: {
        companyId: company.id,
        name: 'Matriz',
        code: 'MTZ',
      },
    }),
    prisma.branch.create({
      data: {
        companyId: company.id,
        name: 'Filial SP',
        code: 'SP',
      },
    }),
  ]);

  const [ti, administrativo, operacoes] = await Promise.all([
    prisma.costCenter.create({
      data: {
        companyId: company.id,
        code: 'CC-TI',
        name: 'TI',
      },
    }),
    prisma.costCenter.create({
      data: {
        companyId: company.id,
        code: 'CC-ADM',
        name: 'Administrativo',
      },
    }),
    prisma.costCenter.create({
      data: {
        companyId: company.id,
        code: 'CC-OPE',
        name: 'Operações',
      },
    }),
  ]);

  const categoryDefinitions = [
    {
      name: 'Móveis e Utensílios',
      code: 'MOVEIS',
      usefulLifeMonths: 60,
      residualPercent: 10,
    },
    {
      name: 'Máquinas e Equipamentos',
      code: 'MAQ',
      usefulLifeMonths: 60,
      residualPercent: 10,
    },
    {
      name: 'Veículos',
      code: 'VEIC',
      usefulLifeMonths: 60,
      residualPercent: 10,
    },
    {
      name: 'Equipamentos de TI',
      code: 'TI',
      usefulLifeMonths: 48,
      residualPercent: 10,
    },
  ];

  const categories = await Promise.all(
    categoryDefinitions.map((category) =>
      prisma.assetCategory.create({
        data: {
          companyId: company.id,
          name: category.name,
          code: category.code,
          usefulLifeMonths: category.usefulLifeMonths,
          residualPercent: currency(category.residualPercent),
        },
      }),
    ),
  );

  await Promise.all(
    categories.map((category) =>
      prisma.depreciationRule.create({
        data: {
          categoryId: category.id,
          bookType: 'CONTABIL',
          method: 'LINEAR',
          usefulLifeMonths: category.usefulLifeMonths,
          residualPercent: category.residualPercent,
          activeFrom: new Date('2020-01-01T00:00:00.000Z'),
        },
      }),
    ),
  );

  const categoryMap = Object.fromEntries(categories.map((category) => [category.code, category]));

  const assets = [
    {
      assetCode: 'TI-0001',
      description: 'Notebook Dell Latitude 5440',
      category: categoryMap.TI,
      branchId: matriz.id,
      costCenterId: ti.id,
      acquisitionDate: new Date('2023-02-15T00:00:00.000Z'),
      inServiceDate: new Date('2023-02-20T00:00:00.000Z'),
      acquisitionValue: 6500,
    },
    {
      assetCode: 'TI-0002',
      description: 'Servidor Rack PowerEdge',
      category: categoryMap.MAQ,
      branchId: matriz.id,
      costCenterId: ti.id,
      acquisitionDate: new Date('2022-08-03T00:00:00.000Z'),
      inServiceDate: new Date('2022-08-10T00:00:00.000Z'),
      acquisitionValue: 18000,
    },
    {
      assetCode: 'MOB-0001',
      description: 'Mesa de reunião 10 lugares',
      category: categoryMap.MOVEIS,
      branchId: matriz.id,
      costCenterId: administrativo.id,
      acquisitionDate: new Date('2021-06-10T00:00:00.000Z'),
      inServiceDate: new Date('2021-06-15T00:00:00.000Z'),
      acquisitionValue: 4200,
    },
    {
      assetCode: 'VEI-0001',
      description: 'Veículo utilitário Fiat Fiorino',
      category: categoryMap.VEIC,
      branchId: filialSp.id,
      costCenterId: operacoes.id,
      acquisitionDate: new Date('2020-03-18T00:00:00.000Z'),
      inServiceDate: new Date('2020-03-25T00:00:00.000Z'),
      acquisitionValue: 78000,
    },
    {
      assetCode: 'MOB-0002',
      description: 'Armário de aço arquivo',
      category: categoryMap.MOVEIS,
      branchId: filialSp.id,
      costCenterId: administrativo.id,
      acquisitionDate: new Date('2024-01-08T00:00:00.000Z'),
      inServiceDate: new Date('2024-01-12T00:00:00.000Z'),
      acquisitionValue: 2300,
    },
    {
      assetCode: 'TI-0003',
      description: 'Monitor LG 27 polegadas',
      category: categoryMap.TI,
      branchId: filialSp.id,
      costCenterId: ti.id,
      acquisitionDate: new Date('2024-11-01T00:00:00.000Z'),
      inServiceDate: new Date('2024-11-05T00:00:00.000Z'),
      acquisitionValue: 1450,
    },
  ];

  await Promise.all(
    assets.map((asset) => {
      const values = buildAssetValues(
        asset.acquisitionValue,
        asset.category.residualPercent.toNumber(),
        asset.category.usefulLifeMonths,
        asset.inServiceDate,
      );

      return prisma.asset.create({
        data: {
          companyId: company.id,
          branchId: asset.branchId,
          costCenterId: asset.costCenterId,
          assetCode: asset.assetCode,
          description: asset.description,
          categoryId: asset.category.id,
          acquisitionDate: asset.acquisitionDate,
          inServiceDate: asset.inServiceDate,
          acquisitionValue: currency(asset.acquisitionValue),
          residualValue: values.residualValue,
          depreciableBase: values.depreciableBase,
          usefulLifeMonths: asset.category.usefulLifeMonths,
          depreciationMethod: 'LINEAR',
          status: values.status,
          accumulatedDepreciation: values.accumulatedDepreciation,
          netBookValue: values.netBookValue,
        },
      });
    }),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
