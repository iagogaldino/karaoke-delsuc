import { Router } from 'express';
import * as usersController from '../controllers/usersController.js';
import multer from 'multer';

// Configure multer for photo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas'));
    }
  }
});

const router = Router();

router.get('/', usersController.getAllUsersHandler);
router.get('/by-phone/:phone', usersController.getUserByPhoneHandler);
router.post('/upload-photo/:qrId', upload.single('photo'), usersController.uploadPhoto);

export { router as usersRoutes };

