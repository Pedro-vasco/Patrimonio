import { Router } from 'express';
import { z } from 'zod';

import prisma from '../lib/prisma';
import { DepreciationService } from '../services/depreciation.service';
import { asyncHandler, getPagination } from '../utils/http';

const depreciationRouter = Router();
const depreciationService = new DepreciationService(prisma);

const runSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  bookType: z.string().min(1).optional(),
  companyId: z.string().uuid(),
});

depreciationRouter.post(
  '/run',
  asyncHandler(async (request, response) => {
    const payload = runSchema.parse(request.body);
    const run = await depreciationService.runDepreciation(payload);
    response.status(201).json(run);
  }),
);

depreciationRouter.get(
  '/runs',
  asyncHandler(async (request, response) => {
    const pagination = getPagination(request.query);
    const runs = await depreciationService.listRuns(pagination.page, pagination.pageSize);
    response.json(runs);
  }),
);

export default depreciationRouter;
