import { Router } from 'express';

import prisma from '../lib/prisma';
import { asyncHandler } from '../utils/http';

const lookupsRouter = Router();

lookupsRouter.get(
  '/',
  asyncHandler(async (_request, response) => {
    const [companies, branches, costCenters, categories] = await Promise.all([
      prisma.company.findMany({
        orderBy: {
          name: 'asc',
        },
      }),
      prisma.branch.findMany({
        orderBy: {
          name: 'asc',
        },
      }),
      prisma.costCenter.findMany({
        orderBy: {
          name: 'asc',
        },
      }),
      prisma.assetCategory.findMany({
        orderBy: {
          name: 'asc',
        },
      }),
    ]);

    response.json({
      companies,
      branches,
      costCenters,
      categories,
    });
  }),
);

export default lookupsRouter;
