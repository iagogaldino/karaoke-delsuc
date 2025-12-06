# 🚀 Guia Rápido - Karaokê Player

## 📋 Pré-requisitos

Certifique-se de ter os seguintes arquivos no projeto:
- `just-voice/output/AlceuValenca_vocals.wav`
- `voice-remove/output/AlceuValenca_no_vocals.wav`
- `waveform-generator/wave_json/AlceuValenca.json`
- `lrc-generator/AlceuValenca.lrc`

## 🏃 Como Executar

### Opção 1: Modo Desenvolvimento Completo (Recomendado)

**Windows PowerShell:**
```powershell
.\start-dev.ps1
```

**Windows CMD:**
```cmd
start-dev.bat
```

Este script inicia automaticamente:
- ✅ Backend na porta 3001
- ✅ Frontend na porta 3000
- ✅ Abre janelas separadas para cada servidor
- ✅ Verifica se já estão rodando antes de iniciar

**Para parar os servidores:**
```powershell
.\stop-dev.ps1
```

ou

```cmd
stop-dev.bat
```

### Opção 2: Usando Scripts Individuais

**Windows PowerShell:**
```powershell
# Terminal 1 - Backend
.\start-backend.ps1

# Terminal 2 - Frontend
.\start-frontend.ps1
```

**Windows CMD:**
```cmd
# Terminal 1 - Backend
start-backend.bat

# Terminal 2 - Frontend
start-frontend.bat
```

### Opção 2: Manual

### 1. Instalar Dependências do Backend

```bash
cd backend
npm install
```

### 2. Instalar Dependências do Frontend

```bash
cd ../interface
npm install
```

### 3. Iniciar o Backend

Em um terminal:

```bash
cd backend
npm run dev
```

O backend estará rodando em `http://localhost:3001`

### 4. Iniciar o Frontend

Em outro terminal:

```bash
cd interface
npm run dev
```

O frontend estará rodando em `http://localhost:3000`

## 🎯 Funcionalidades

- ✅ **Streaming de Áudio**: Dois áudios (vocals + instrumental) sincronizados
- ✅ **Waveform Visual**: Visualização completa da waveform em tempo real
- ✅ **Letras Sincronizadas**: Exibição de letras LRC sincronizadas com o áudio
- ✅ **Controles**: Play, Pause, Seek
- ✅ **Sincronização**: WebSocket para sincronização perfeita entre componentes

## 📡 Endpoints do Backend

### Áudio
- `GET /api/audio/vocals` - Stream de vocais (Range Request support)
- `GET /api/audio/instrumental` - Stream instrumental (Range Request support)
- `GET /api/audio/info` - Informações dos arquivos

### Waveform
- `GET /api/waveform/metadata` - Metadados
- `GET /api/waveform/stream` - SSE stream completo
- `GET /api/waveform/chunk?start=X&end=Y` - Chunk específico

### Letras
- `GET /api/lyrics` - LRC completo
- `GET /api/lyrics/json` - LRC parseado em JSON

### WebSocket
- `WS /ws/sync` - Sincronização (play/pause/seek)

## 🔧 Tecnologias

**Backend:**
- Node.js + Express
- TypeScript
- WebSocket (ws)

**Frontend:**
- React
- TypeScript
- Vite
- Web Audio API
- Canvas API

## 📝 Notas

- O buffer inicial é de 3-5 segundos para garantir que a pessoa possa cantar
- A waveform completa (299MB) é carregada via Server-Sent Events progressivamente
- A sincronização é feita via WebSocket com latência <50ms
- Os áudios suportam Range Requests para seek eficiente

## 🐛 Solução de Problemas

### Backend não inicia
- Verifique se os arquivos de áudio e waveform existem nos caminhos corretos
- Verifique se a porta 3001 está livre

### Frontend não conecta
- Certifique-se de que o backend está rodando
- Verifique o console do navegador para erros

### Waveform não carrega
- Verifique se o arquivo JSON existe e é válido
- O carregamento pode levar alguns minutos para arquivos grandes (299MB)

