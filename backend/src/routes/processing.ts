import { Router } from 'express';
import * as processingController from '../controllers/processingController.js';

const router = Router();

router.post('/upload', processingController.upload.single('audio'), processingController.uploadFile);
router.post('/start', processingController.startProcessing);
router.post('/start-youtube', processingController.startYouTubeProcessing);
router.get('/status/:fileId', processingController.getStatus);
router.post('/download-video/:songId', processingController.downloadVideo);
router.post('/generate-lrc/:songId', processingController.generateLRC);

export { router as processingRoutes };
