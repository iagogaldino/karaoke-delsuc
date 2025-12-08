import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { getUserByPhone, getAllUsers } from '../utils/usersDatabase.js';
import { writeFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { PATHS } from '../config/index.js';
import { ensureUsersPhotosDir } from '../utils/usersDatabase.js';

/**
 * GET /api/users/by-phone/:phone
 * Busca um usuário pelo telefone
 */
export const getUserByPhoneHandler = asyncHandler(async (req: Request, res: Response) => {
  const { phone } = req.params;

  if (!phone) {
    return res.status(400).json({ error: 'Telefone é obrigatório' });
  }

  // Normalizar telefone
  const normalizedPhone = phone.replace(/\D/g, '');
  
  if (normalizedPhone.length < 10) {
    return res.status(400).json({ error: 'Telefone inválido' });
  }

  const user = getUserByPhone(normalizedPhone);

  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  // Não retornar o ID interno, apenas nome e telefone
  res.json({
    name: user.name,
    phone: user.phone,
    photo: user.photo,
    createdAt: user.createdAt,
    lastPlayedAt: user.lastPlayedAt
  });
});

/**
 * POST /api/users/upload-photo/:qrId
 * Faz upload da foto do usuário
 */
export const uploadPhoto = asyncHandler(async (req: Request, res: Response) => {
  const { qrId } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'Nenhuma foto enviada' });
  }

  // Garantir que o diretório existe
  ensureUsersPhotosDir();

  // Gerar nome único para a foto
  const fileExtension = extname(req.file.originalname) || '.jpg';
  const fileName = `photo-${qrId}-${Date.now()}${fileExtension}`;
  const filePath = join(PATHS.USERS_PHOTOS_DIR, fileName);

  // Salvar arquivo
  writeFileSync(filePath, req.file.buffer);

  // Retornar caminho relativo
  const photoPath = `users-photos/${fileName}`;

  res.json({
    success: true,
    photo: photoPath,
    fileName
  });
});

/**
 * GET /api/users
 * Lista todos os usuários
 */
export const getAllUsersHandler = asyncHandler(async (req: Request, res: Response) => {
  const users = getAllUsers();
  
  // Retornar apenas dados públicos (sem ID interno)
  const publicUsers = users.map(user => ({
    name: user.name,
    phone: user.phone,
    photo: user.photo,
    createdAt: user.createdAt,
    lastPlayedAt: user.lastPlayedAt
  }));

  res.json({
    users: publicUsers,
    total: publicUsers.length
  });
});

