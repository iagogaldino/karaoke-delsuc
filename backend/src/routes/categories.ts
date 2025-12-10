import { Router } from 'express';
import * as categoriesController from '../controllers/categoriesController.js';

const router = Router();

router.get('/', categoriesController.getAll);
router.get('/:id', categoriesController.getById);
router.post('/', categoriesController.create);
router.put('/:id', categoriesController.update);
router.delete('/:id', categoriesController.remove);
router.post('/move-song', categoriesController.moveSong);

export { router as categoriesRoutes };

