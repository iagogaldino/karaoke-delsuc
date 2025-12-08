import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { PATHS } from '../config/index.js';
import { UserDatabase, User } from '../types/index.js';

const USERS_DATABASE_PATH = PATHS.USERS_DATABASE;

/**
 * Carrega o banco de dados de usuários
 */
export function loadUsersDatabase(): UserDatabase {
  try {
    if (!existsSync(USERS_DATABASE_PATH)) {
      // Criar banco de dados vazio se não existir
      const emptyDb: UserDatabase = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        users: []
      };
      saveUsersDatabase(emptyDb);
      return emptyDb;
    }

    const content = readFileSync(USERS_DATABASE_PATH, 'utf-8');
    return JSON.parse(content) as UserDatabase;
  } catch (error) {
    console.error('Error loading users database:', error);
    throw new Error('Failed to load users database');
  }
}

/**
 * Salva o banco de dados de usuários
 */
export function saveUsersDatabase(database: UserDatabase): void {
  try {
    database.lastUpdated = new Date().toISOString();
    writeFileSync(USERS_DATABASE_PATH, JSON.stringify(database, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving users database:', error);
    throw new Error('Failed to save users database');
  }
}

/**
 * Busca um usuário por telefone
 */
export function getUserByPhone(phone: string): User | null {
  const db = loadUsersDatabase();
  // Normalizar telefone (remover espaços, caracteres especiais)
  const normalizedPhone = phone.replace(/\D/g, '');
  return db.users.find(user => user.phone.replace(/\D/g, '') === normalizedPhone) || null;
}

/**
 * Busca um usuário por ID
 */
export function getUserById(id: string): User | null {
  const db = loadUsersDatabase();
  return db.users.find(user => user.id === id) || null;
}

/**
 * Lista todos os usuários
 */
export function getAllUsers(): User[] {
  const db = loadUsersDatabase();
  return db.users;
}

/**
 * Cria ou atualiza um usuário
 * Se o usuário já existir (por telefone), atualiza o nome e lastPlayedAt
 * Caso contrário, cria um novo usuário
 */
export function createOrUpdateUser(name: string, phone: string, photo?: string): User {
  const db = loadUsersDatabase();
  
  // Normalizar telefone
  const normalizedPhone = phone.replace(/\D/g, '');
  
  // Buscar usuário existente por telefone
  const existingUserIndex = db.users.findIndex(
    user => user.phone.replace(/\D/g, '') === normalizedPhone
  );

  const now = new Date().toISOString();

  if (existingUserIndex !== -1) {
    // Atualizar usuário existente
    const existingUser = db.users[existingUserIndex];
    existingUser.name = name.trim();
    existingUser.lastPlayedAt = now;
    if (photo) {
      existingUser.photo = photo;
    }
    saveUsersDatabase(db);
    return existingUser;
  } else {
    // Criar novo usuário
    const newUser: User = {
      id: generateUserId(),
      name: name.trim(),
      phone: normalizedPhone,
      createdAt: now,
      lastPlayedAt: now
    };
    
    if (photo) {
      newUser.photo = photo;
    }

    db.users.push(newUser);
    saveUsersDatabase(db);
    return newUser;
  }
}

/**
 * Garante que o diretório de fotos de usuários existe
 */
export function ensureUsersPhotosDir(): void {
  if (!existsSync(PATHS.USERS_PHOTOS_DIR)) {
    mkdirSync(PATHS.USERS_PHOTOS_DIR, { recursive: true });
  }
}

/**
 * Gera um ID único para usuário
 */
function generateUserId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `user-${timestamp}-${random}`;
}

