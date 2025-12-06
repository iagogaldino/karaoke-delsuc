import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { audioRoutes } from './routes/audio.js';
import { waveformRoutes } from './routes/waveform.js';
import { lyricsRoutes } from './routes/lyrics.js';
import { songsRoutes } from './routes/songs.js';
import { processingRoutes } from './routes/processing.js';
import { videoRoutes } from './routes/video.js';
import { setupWebSocket } from './websocket/sync.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/audio', audioRoutes);
app.use('/api/waveform', waveformRoutes);
app.use('/api/lyrics', lyricsRoutes);
app.use('/api/songs', songsRoutes);
app.use('/api/processing', processingRoutes);
app.use('/api/video', videoRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create HTTP server
const server = createServer(app);

// Setup WebSocket
setupWebSocket(server);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready on ws://localhost:${PORT}`);
});

