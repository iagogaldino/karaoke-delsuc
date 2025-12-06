# 🎤 Interface Karaokê

Frontend React para player de karaokê com sincronização de áudio, waveform e letras.

## 🚀 Instalação

```bash
npm install
```

## 🏃 Executar

### Desenvolvimento
```bash
npm run dev
```

A aplicação estará rodando em `http://localhost:3000`

### Build para Produção
```bash
npm run build
npm run preview
```

## 🎯 Funcionalidades

- ✅ Player de áudio sincronizado (vocals + instrumental)
- ✅ Visualização de waveform em tempo real
- ✅ Exibição de letras sincronizadas (LRC)
- ✅ Controle de play/pause/seek
- ✅ Streaming progressivo de dados
- ✅ Sincronização via WebSocket

## 🔧 Tecnologias

- React
- TypeScript
- Vite
- Web Audio API
- Canvas API
- WebSocket

## 📁 Estrutura

```
src/
├── components/
│   ├── AudioPlayer.tsx      # Player de áudio sincronizado
│   ├── WaveformVisualizer.tsx # Visualização da waveform
│   └── LyricsDisplay.tsx     # Exibição de letras
├── hooks/
│   └── useSyncWebSocket.ts   # Hook para WebSocket
├── App.tsx                   # Componente principal
└── main.tsx                  # Entry point
```

