# 🎤 Backend Karaokê

Backend Node.js/TypeScript para streaming de áudio e sincronização de karaokê.

## 🚀 Instalação

```bash
npm install
```

## 📝 Configuração

Certifique-se de que os seguintes arquivos existem:
- `../just-voice/output/AlceuValenca_vocals.wav`
- `../voice-remove/output/AlceuValenca_no_vocals.wav`
- `../waveform-generator/wave_json/AlceuValenca.json`
- `../lrc-generator/AlceuValenca.lrc`

## 🏃 Executar

### Desenvolvimento
```bash
npm run dev
```

### Produção
```bash
npm run build
npm start
```

O servidor estará rodando em `http://localhost:3001`

## 📡 Endpoints

### Áudio
- `GET /api/audio/vocals` - Stream de áudio de vocais (suporta Range Requests)
- `GET /api/audio/instrumental` - Stream de áudio instrumental (suporta Range Requests)
- `GET /api/audio/info` - Informações sobre os arquivos de áudio

### Waveform
- `GET /api/waveform/metadata` - Metadados da waveform
- `GET /api/waveform/chunk?start=X&end=Y` - Chunk específico da waveform
- `GET /api/waveform/stream` - Server-Sent Events (SSE) para streaming completo
- `GET /api/waveform/preview?rate=N` - Amostragem reduzida

### Letras
- `GET /api/lyrics` - Arquivo LRC completo
- `GET /api/lyrics/json` - Letras parseadas em JSON

### WebSocket
- `WS /ws/sync` - Sincronização de play/pause/seek

## 🔧 Tecnologias

- Node.js
- Express
- TypeScript
- WebSocket (ws)

