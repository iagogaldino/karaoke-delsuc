import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { audioRoutes } from './routes/audio.js';
import { waveformRoutes } from './routes/waveform.js';
import { lyricsRoutes } from './routes/lyrics.js';
import { songsRoutes } from './routes/songs.js';
import { categoriesRoutes } from './routes/categories.js';
import { bandsRoutes } from './routes/bands.js';
import { processingRoutes } from './routes/processing.js';
import { videoRoutes } from './routes/video.js';
import { scoresRoutes } from './routes/scores.js';
import { qrcodeRoutes } from './routes/qrcode.js';
import { usersRoutes } from './routes/users.js';
import * as qrcodeController from './controllers/qrcodeController.js';
import { setupWebSocket } from './websocket/sync.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { SERVER_CONFIG, PATHS } from './config/index.js';
import { getLocalIP } from './utils/networkUtils.js';
import { join } from 'path';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Servir fotos de usuários estaticamente
app.use('/music/users-photos', express.static(PATHS.USERS_PHOTOS_DIR));

// Routes
// Página HTML para QR code (deve vir antes das rotas de API)
app.get('/qrcode/:qrId', qrcodeController.getNamePage);

// API Routes
app.use('/api/audio', audioRoutes);
app.use('/api/waveform', waveformRoutes);
app.use('/api/lyrics', lyricsRoutes);
app.use('/api/songs', songsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/bands', bandsRoutes);
app.use('/api/processing', processingRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/scores', scoresRoutes);
app.use('/api/qrcode', qrcodeRoutes);
app.use('/api/users', usersRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Create HTTP server
const server = createServer(app);

// Setup WebSocket
setupWebSocket(server);

// Start server
server.listen(SERVER_CONFIG.PORT, () => {
  const localIP = getLocalIP();
  console.log(`🚀 Server running on http://localhost:${SERVER_CONFIG.PORT}`);
  console.log(`🌐 Server accessible on network: http://${localIP}:${SERVER_CONFIG.PORT}`);
  console.log(`📡 WebSocket server ready on ws://localhost:${SERVER_CONFIG.PORT}`);
  console.log(`📱 QR Codes will use: http://${localIP}:${SERVER_CONFIG.PORT}`);
});
