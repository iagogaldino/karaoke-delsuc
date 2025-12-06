import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const DATABASE_PATH = join(PROJECT_ROOT, 'music', 'database.json');

export interface SongFile {
  original?: string;
  vocals: string;
  instrumental: string;
  waveform: string;
  lyrics: string;
  video?: string;
}

export interface SongMetadata {
  sampleRate: number;
  format: string;
  createdAt: string;
  lastProcessed?: string;
}

export interface SongStatus {
  vocals: boolean;
  instrumental: boolean;
  waveform: boolean;
  lyrics: boolean;
  ready: boolean;
}

export interface VideoInfo {
  id?: string;
  title?: string;
  url?: string;
  thumbnail?: string;
  duration?: number;
  file?: string;
  uploader?: string;
  view_count?: number;
  file_size?: number;
}

export interface Song {
  id: string;
  name: string;
  displayName: string;
  artist: string;
  duration: number;
  files: SongFile;
  metadata: SongMetadata;
  status: SongStatus;
  video?: VideoInfo;
}

export interface Database {
  version: string;
  lastUpdated: string;
  songs: Song[];
}

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
        songs: []
      };
      saveDatabase(emptyDb);
      return emptyDb;
    }

    const content = readFileSync(DATABASE_PATH, 'utf-8');
    return JSON.parse(content) as Database;
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
  const songDir = join(PROJECT_ROOT, 'music', songId);
  
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

