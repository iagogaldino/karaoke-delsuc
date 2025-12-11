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

O app estará disponível em:
- `http://localhost:4200` (na máquina local)
- `http://[SEU_IP_LOCAL]:4200` (na rede local, acessível pelo celular)

**Importante:** O app está configurado para aceitar conexões da rede local (`--host 0.0.0.0`), permitindo que dispositivos móveis na mesma rede Wi-Fi acessem o app.

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

## Configuração de Rede

O backend detecta automaticamente o IP da rede local e configura o `CLIENT_MOBILE_URL` para apontar para o app Angular usando esse IP. Isso permite que o QR code funcione corretamente quando escaneado pelo celular.

Para forçar um IP específico, defina a variável de ambiente:
```bash
CLIENT_MOBILE_URL=http://192.168.1.100:4200
```
