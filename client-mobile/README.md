# Karaokê Mobile Client

Aplicativo Angular para clientes móveis do sistema de karaokê.

## Instalação

```bash
npm install
```

## Desenvolvimento

```bash
npm start
```

O app estará disponível em `http://localhost:4200`

## Build

```bash
npm run build
```

## Estrutura

- `/src/app/pages` - Páginas principais
  - `qrcode-page` - Verificação inicial do QR code
  - `register-page` - Formulário de cadastro
  - `songs-page` - Lista de músicas
  - `player-page` - Controles do player
  - `error-page` - Página de erro

- `/src/app/services` - Serviços
  - `api.service.ts` - Comunicação com API REST
  - `websocket.service.ts` - Comunicação WebSocket

## Rotas

- `/qrcode/:qrId` - Verificação do QR code
- `/register/:qrId` - Cadastro de usuário
- `/songs/:qrId` - Lista de músicas
- `/player/:qrId` - Player de controle
- `/error` - Página de erro

