import { Router } from 'express';
import * as audioController from '../controllers/audioController.js';

const router = Router();

router.get('/vocals', audioController.getVocals);
router.get('/instrumental', audioController.getInstrumental);
router.get('/info', audioController.getAudioInfo);
router.get('/segment', audioController.getAudioSegment);

export { router as audioRoutes };
