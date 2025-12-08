import { Router } from 'express';
import * as scoresController from '../controllers/scoresController.js';

const router = Router();

// Rotas específicas DEVEM vir ANTES das rotas com parâmetros dinâmicos
router.get('/ranking', scoresController.getRanking);
router.get('/:songId/all', scoresController.getAllScores);
router.post('/:songId/add-result', scoresController.addResult);

// Rotas com parâmetros (devem vir por último)
router.get('/:songId', scoresController.getScore);
router.post('/:songId', scoresController.saveScore);
router.delete('/:songId', scoresController.deleteScores);

export { router as scoresRoutes };
