import { Router } from 'express';
import * as songsController from '../controllers/songsController.js';

const router = Router();

router.get('/', songsController.getAll);
router.get('/:id', songsController.getById);
router.post('/', songsController.create);
router.put('/:id', songsController.update);
router.delete('/:id', songsController.remove);
router.post('/refresh', songsController.refresh);

export { router as songsRoutes };
