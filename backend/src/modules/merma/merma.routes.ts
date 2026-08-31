// =============================================================================
// MERMA ROUTES — ERP-MARKET
// Rutas de mermas/spoilage
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { validate } from '../../core/middlewares/validate.middleware';
import { idParamSchema } from '../../core/validations/common.zod';
import { createMermaSchema, mermaFiltersSchema, mermaSummarySchema, mermaReportSchema } from '../../core/validations/merma.zod';
import * as ctrl from './merma.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', validate(mermaFiltersSchema, { source: 'query' }), ctrl.getMermas);

router.get('/summary', validate(mermaSummarySchema, { source: 'query' }), ctrl.getMermaSummary);

router.get('/report', validate(mermaReportSchema, { source: 'query' }), ctrl.getMermaReport);

router.get('/:id', validate(idParamSchema, { source: 'params' }), ctrl.getMermaById);

router.post('/', roleGuard('SELLER'), validate(createMermaSchema), ctrl.createMerma);

export default router;