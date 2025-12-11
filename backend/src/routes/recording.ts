import { Router } from 'express';
import * as recordingController from '../controllers/recordingController.js';

const router = Router();

router.post('/upload', recordingController.upload.single('audio'), recordingController.uploadRecording);
router.post('/generate-lrc/:songId', recordingController.generateLRC);
router.get('/lrc/:songId', recordingController.getRecordingLRC);

export { router as recordingRoutes };
