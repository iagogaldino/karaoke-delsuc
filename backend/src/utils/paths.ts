import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Obter __dirname equivalente em ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Caminho base do projeto (raiz do projeto, não da pasta backend)
// __dirname está em backend/src/utils, então subimos 3 níveis
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

// Nome da música (pode ser configurado via variável de ambiente)
const MUSIC_NAME = process.env.MUSIC_NAME || 'AlceuValenca';
const MUSIC_DIR = join(PROJECT_ROOT, 'music', MUSIC_NAME);

export const PATHS = {
  VOCALS: join(MUSIC_DIR, 'vocals.wav'),
  INSTRUMENTAL: join(MUSIC_DIR, 'instrumental.wav'),
  WAVEFORM: join(MUSIC_DIR, 'waveform.json'),
  LRC: join(MUSIC_DIR, 'lyrics.lrc'),
  MUSIC_DIR: MUSIC_DIR,
  MUSIC_NAME: MUSIC_NAME
};

