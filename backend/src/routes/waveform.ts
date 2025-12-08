import { Router } from 'express';
import * as waveformController from '../controllers/waveformController.js';
import { validateWaveformChunk, validatePreviewRate } from '../middlewares/validation.js';

const router = Router();

router.get('/metadata', waveformController.getMetadata);
router.get('/chunk', validateWaveformChunk, waveformController.getChunk);
router.get('/stream', waveformController.stream);
router.get('/preview', validatePreviewRate, waveformController.getPreview);

export { router as waveformRoutes };
