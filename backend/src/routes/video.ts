import { Router } from 'express';
import * as videoController from '../controllers/videoController.js';

const router = Router();

router.get('/', videoController.getVideo);

export { router as videoRoutes };
