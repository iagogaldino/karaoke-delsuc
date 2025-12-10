import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { PATHS } from '../config/index.js';
import { Database, Song, SongFile, SongStatus, Category, Band } from '../types/index.js';

const DATABASE_PATH = PATHS.DATABASE;

// Types are now imported from types/index.ts

/**
 * Carrega o banco de dados
 */
export function loadDatabase(): Database {
  try {
    if (!existsSync(DATABASE_PATH)) {
      // Criar banco de dados vazio se não existir
      const emptyDb: Database = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        songs: [],
        categories: [],
        bands: []
      };
      saveDatabase(emptyDb);
      return emptyDb;
    }

    const content = readFileSync(DATABASE_PATH, 'utf-8');
    const db = JSON.parse(content) as Database;
    
    // Migração: garantir que categories e bands existam
    if (!db.categories) {
      db.categories = [];
    }
    if (!db.bands) {
      db.bands = [];
      saveDatabase(db);
    }
    
    return db;
  } catch (error) {
    console.error('Error loading database:', error);
    throw new Error('Failed to load database');
  }
}

/**
 * Salva o banco de dados
 */
export function saveDatabase(database: Database): void {
  try {
    database.lastUpdated = new Date().toISOString();
    writeFileSync(DATABASE_PATH, JSON.stringify(database, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving database:', error);
    throw new Error('Failed to save database');
  }
}

/**
 * Busca uma música por ID
 */
export function getSongById(id: string): Song | null {
  const db = loadDatabase();
  return db.songs.find(song => song.id === id) || null;
}

/**
 * Lista todas as músicas
 */
export function getAllSongs(): Song[] {
  const db = loadDatabase();
  return db.songs;
}

/**
 * Adiciona uma nova música ao banco de dados
 */
export function addSong(song: Omit<Song, 'status'>): Song {
  const db = loadDatabase();
  
  // Verificar se já existe
  if (db.songs.find(s => s.id === song.id)) {
    throw new Error(`Song with id "${song.id}" already exists`);
  }

  // Verificar status dos arquivos
  const status = checkSongFiles(song.id, song.files);

  const newSong: Song = {
    ...song,
    status
  };

  db.songs.push(newSong);
  saveDatabase(db);
  return newSong;
}

/**
 * Atualiza uma música existente
 */
export function updateSong(id: string, updates: Partial<Song>): Song | null {
  const db = loadDatabase();
  const index = db.songs.findIndex(song => song.id === id);

  if (index === -1) {
    return null;
  }

  const updatedSong: Song = {
    ...db.songs[index],
    ...updates,
    id // Garantir que o ID não seja alterado
  };

  // Re-verificar status dos arquivos se os arquivos foram atualizados
  if (updates.files) {
    updatedSong.status = checkSongFiles(id, updatedSong.files);
  }

  db.songs[index] = updatedSong;
  saveDatabase(db);
  return updatedSong;
}

/**
 * Remove uma música do banco de dados
 */
export function removeSong(id: string): boolean {
  const db = loadDatabase();
  const index = db.songs.findIndex(song => song.id === id);

  if (index === -1) {
    return false;
  }

  db.songs.splice(index, 1);
  saveDatabase(db);
  return true;
}

/**
 * Verifica se os arquivos de uma música existem
 */
function checkSongFiles(songId: string, files: SongFile): SongStatus {
  const songDir = join(PATHS.MUSIC_DIR, songId);
  
  const vocalsExists = existsSync(join(songDir, files.vocals));
  const instrumentalExists = existsSync(join(songDir, files.instrumental));
  const waveformExists = existsSync(join(songDir, files.waveform));
  const lyricsExists = existsSync(join(songDir, files.lyrics));

  return {
    vocals: vocalsExists,
    instrumental: instrumentalExists,
    waveform: waveformExists,
    lyrics: lyricsExists,
    ready: vocalsExists && instrumentalExists && waveformExists && lyricsExists
  };
}

/**
 * Atualiza o status de todas as músicas
 */
export function refreshAllSongStatuses(): void {
  const db = loadDatabase();
  
  db.songs = db.songs.map(song => {
    const status = checkSongFiles(song.id, song.files);
    return {
      ...song,
      status
    };
  });

  saveDatabase(db);
}

/**
 * ========== Categorias ==========
 */

/**
 * Lista todas as categorias
 */
export function getAllCategories(): Category[] {
  const db = loadDatabase();
  return db.categories || [];
}

/**
 * Busca uma categoria por ID
 */
export function getCategoryById(id: string): Category | null {
  const db = loadDatabase();
  return (db.categories || []).find(cat => cat.id === id) || null;
}

/**
 * Cria uma nova categoria
 */
export function addCategory(name: string, description?: string): Category {
  const db = loadDatabase();
  
  if (!db.categories) {
    db.categories = [];
  }

  // Verificar se já existe uma categoria com o mesmo nome
  const existing = db.categories.find(cat => cat.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    throw new Error(`Category with name "${name}" already exists`);
  }

  const newCategory: Category = {
    id: `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: name.trim(),
    description: description?.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.categories.push(newCategory);
  saveDatabase(db);
  return newCategory;
}

/**
 * Atualiza uma categoria
 */
export function updateCategory(id: string, updates: Partial<Category>): Category | null {
  const db = loadDatabase();
  
  if (!db.categories) {
    return null;
  }

  const index = db.categories.findIndex(cat => cat.id === id);
  if (index === -1) {
    return null;
  }

  // Verificar se o novo nome já existe em outra categoria
  if (updates.name) {
    const existing = db.categories.find(cat => cat.id !== id && cat.name.toLowerCase() === updates.name!.toLowerCase());
    if (existing) {
      throw new Error(`Category with name "${updates.name}" already exists`);
    }
  }

  const updatedCategory: Category = {
    ...db.categories[index],
    ...updates,
    id, // Garantir que o ID não seja alterado
    updatedAt: new Date().toISOString()
  };

  db.categories[index] = updatedCategory;
  saveDatabase(db);
  return updatedCategory;
}

/**
 * Remove uma categoria (move músicas para "sem categoria")
 */
export function removeCategory(id: string): boolean {
  const db = loadDatabase();
  
  if (!db.categories) {
    return false;
  }

  const index = db.categories.findIndex(cat => cat.id === id);
  if (index === -1) {
    return false;
  }

  // Remover categoria de todas as músicas que a usam
  db.songs = db.songs.map(song => {
    if (song.category === id) {
      return {
        ...song,
        category: undefined
      };
    }
    return song;
  });

  db.categories.splice(index, 1);
  saveDatabase(db);
  return true;
}

/**
 * Move uma música para uma categoria
 */
export function moveSongToCategory(songId: string, categoryId: string | null): Song | null {
  const db = loadDatabase();
  const songIndex = db.songs.findIndex(song => song.id === songId);

  if (songIndex === -1) {
    return null;
  }

  // Verificar se a categoria existe (se não for null)
  if (categoryId !== null) {
    const categoryExists = (db.categories || []).some(cat => cat.id === categoryId);
    if (!categoryExists) {
      throw new Error(`Category with id "${categoryId}" not found`);
    }
  }

  const updatedSong: Song = {
    ...db.songs[songIndex],
    category: categoryId || undefined
  };

  db.songs[songIndex] = updatedSong;
  saveDatabase(db);
  return updatedSong;
}

/**
 * ========== Bandas ==========
 */

/**
 * Lista todas as bandas
 */
export function getAllBands(): Band[] {
  const db = loadDatabase();
  return db.bands || [];
}

/**
 * Busca uma banda por ID
 */
export function getBandById(id: string): Band | null {
  const db = loadDatabase();
  return (db.bands || []).find(band => band.id === id) || null;
}

/**
 * Cria uma nova banda
 */
export function addBand(name: string, description?: string): Band {
  const db = loadDatabase();
  
  if (!db.bands) {
    db.bands = [];
  }

  // Verificar se já existe uma banda com o mesmo nome
  const existing = db.bands.find(band => band.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    throw new Error(`Band with name "${name}" already exists`);
  }

  const newBand: Band = {
    id: `band-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: name.trim(),
    description: description?.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.bands.push(newBand);
  saveDatabase(db);
  return newBand;
}

/**
 * Atualiza uma banda
 */
export function updateBand(id: string, updates: Partial<Band>): Band | null {
  const db = loadDatabase();
  
  if (!db.bands) {
    return null;
  }

  const index = db.bands.findIndex(band => band.id === id);
  if (index === -1) {
    return null;
  }

  // Verificar se o novo nome já existe em outra banda
  if (updates.name) {
    const existing = db.bands.find(band => band.id !== id && band.name.toLowerCase() === updates.name!.toLowerCase());
    if (existing) {
      throw new Error(`Band with name "${updates.name}" already exists`);
    }
  }

  const updatedBand: Band = {
    ...db.bands[index],
    ...updates,
    id, // Garantir que o ID não seja alterado
    updatedAt: new Date().toISOString()
  };

  db.bands[index] = updatedBand;
  saveDatabase(db);
  return updatedBand;
}

/**
 * Remove uma banda (remove band das músicas)
 */
export function removeBand(id: string): boolean {
  const db = loadDatabase();
  
  if (!db.bands) {
    return false;
  }

  const index = db.bands.findIndex(band => band.id === id);
  if (index === -1) {
    return false;
  }

  // Remover banda de todas as músicas que a usam
  db.songs = db.songs.map(song => {
    if (song.band === id) {
      return {
        ...song,
        band: undefined
      };
    }
    return song;
  });

  db.bands.splice(index, 1);
  saveDatabase(db);
  return true;
}

/**
 * Move uma música para uma banda
 */
export function moveSongToBand(songId: string, bandId: string | null): Song | null {
  const db = loadDatabase();
  const songIndex = db.songs.findIndex(song => song.id === songId);

  if (songIndex === -1) {
    return null;
  }

  // Verificar se a banda existe (se não for null)
  if (bandId !== null) {
    const bandExists = (db.bands || []).some(band => band.id === bandId);
    if (!bandExists) {
      throw new Error(`Band with id "${bandId}" not found`);
    }
  }

  const updatedSong: Song = {
    ...db.songs[songIndex],
    band: bandId || undefined
  };

  db.songs[songIndex] = updatedSong;
  saveDatabase(db);
  return updatedSong;
}

