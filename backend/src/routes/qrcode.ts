import { Router } from 'express';
import * as qrcodeController from '../controllers/qrcodeController.js';

const router = Router();

router.get('/generate', qrcodeController.generate);
router.post('/validate', qrcodeController.validate);
router.get('/:qrId/status', qrcodeController.getStatus);
router.post('/:qrId/name', qrcodeController.submitName);
router.post('/:qrId/song', qrcodeController.selectSong);
router.post('/:qrId/giveup', qrcodeController.giveUp);

export { router as qrcodeRoutes };
