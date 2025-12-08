import { Router } from 'express';
import * as lyricsController from '../controllers/lyricsController.js';

const router = Router();

router.get('/', lyricsController.getLyrics);
router.get('/json', lyricsController.getLyricsJson);
router.put('/', lyricsController.updateLyrics);
router.post('/', lyricsController.addLyrics);
router.delete('/', lyricsController.deleteLyrics);

export { router as lyricsRoutes };
