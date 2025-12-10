import { Router } from 'express';
import * as bandsController from '../controllers/bandsController.js';

const router = Router();

router.get('/', bandsController.getAll);
router.get('/:id', bandsController.getById);
router.post('/', bandsController.create);
router.put('/:id', bandsController.update);
router.delete('/:id', bandsController.remove);
router.post('/move-song', bandsController.moveSong);

export { router as bandsRoutes };

