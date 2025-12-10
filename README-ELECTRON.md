# Karaoke - Electron App

Este projeto agora roda como uma aplicação Electron desktop.

## Estrutura

- `electron/main.js` - Processo principal do Electron
- `backend/` - Servidor Express.js (API e WebSocket)
- `interface/` - Frontend React com Vite

## Como executar

### Desenvolvimento

Para executar em modo desenvolvimento (com hot-reload):

```bash
npm run dev
```

Este comando irá:
1. Iniciar o backend na porta 3001
2. Iniciar o servidor Vite na porta 3000
3. Aguardar o Vite estar pronto
4. Abrir a aplicação Electron

### Produção

Para build e executar:

```bash
# Build do backend e interface
npm run build:all

# Executar a aplicação
npm start
```

### Build para distribuição

Para criar um executável:

```bash
npm run electron:build
```

O executável será gerado na pasta `dist-electron/`.

## Scripts disponíveis

- `npm run dev` - Modo desenvolvimento (backend + interface + Electron)
- `npm run electron:dev` - Apenas Electron em modo dev
- `npm run build:all` - Build completo (backend + interface)
- `npm run build:backend` - Build apenas do backend
- `npm run build:interface` - Build apenas da interface
- `npm run electron:build` - Build executável para distribuição
- `npm start` - Executar aplicação compilada

## Requisitos

- Node.js 18+ 
- npm ou yarn

## Configuração

O Electron detecta automaticamente se está em modo desenvolvimento ou produção:
- **Desenvolvimento**: Carrega do servidor Vite (`http://localhost:3000`)
- **Produção**: Carrega do build estático (`interface/dist/index.html`)

O backend sempre roda localmente na porta 3001.

