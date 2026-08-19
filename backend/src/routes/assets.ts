import { Router } from 'express';
import { z } from 'zod';

import prisma from '../lib/prisma';
import { AssetService } from '../services/asset.service';
import { asyncHandler, getPagination } from '../utils/http';

const assetRouter = Router();
const assetService = new AssetService(prisma);

const baseAssetSchema = z.object({
  companyId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  costCenterId: z.string().uuid().optional(),
  assetCode: z.string().min(1).max(50),
  description: z.string().min(3).max(255),
  categoryId: z.string().uuid(),
  acquisitionDate: z.coerce.date(),
  inServiceDate: z.coerce.date(),
  acquisitionValue: z.coerce.number().positive(),
  residualValue: z.coerce.number().min(0).optional(),
  depreciableBase: z.coerce.number().min(0).optional(),
  usefulLifeMonths: z.coerce.number().int().positive().optional(),
  depreciationMethod: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  disposalDate: z.coerce.date().optional(),
  disposalValue: z.coerce.number().min(0).optional(),
});

const assetUpdateSchema = baseAssetSchema.partial();

assetRouter.get(
  '/',
  asyncHandler(async (request, response) => {
    const pagination = getPagination(request.query);
    const filters = {
      status: typeof request.query.status === 'string' ? request.query.status : undefined,
      categoryId:
        typeof request.query.categoryId === 'string' ? request.query.categoryId : undefined,
      branchId: typeof request.query.branchId === 'string' ? request.query.branchId : undefined,
      costCenterId:
        typeof request.query.costCenterId === 'string' ? request.query.costCenterId : undefined,
      search: typeof request.query.search === 'string' ? request.query.search : undefined,
    };

    const result = await assetService.listAssets(filters, pagination);
    response.json(result);
  }),
);

assetRouter.post(
  '/',
  asyncHandler(async (request, response) => {
    const payload = baseAssetSchema.parse(request.body);
    const asset = await assetService.createAsset(payload);
    response.status(201).json(asset);
  }),
);

assetRouter.get(
  '/:id',
  asyncHandler(async (request, response) => {
    const asset = await assetService.getAssetById(request.params.id);
    response.json(asset);
  }),
);

assetRouter.patch(
  '/:id',
  asyncHandler(async (request, response) => {
    const payload = assetUpdateSchema.parse(request.body);
    const asset = await assetService.updateAsset(request.params.id, payload);
    response.json(asset);
  }),
);

export default assetRouter;
