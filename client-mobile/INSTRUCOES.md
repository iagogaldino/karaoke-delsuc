# Instruções de Uso

## Configuração Inicial

1. Instalar dependências:
```bash
cd client-mobile
npm install
```

2. Configurar variável de ambiente no backend (opcional):
```bash
# No arquivo .env do backend ou variável de ambiente
CLIENT_MOBILE_URL=http://localhost:4200
```

## Executar em Desenvolvimento

1. Iniciar o backend (na pasta raiz do projeto):
```bash
cd backend
npm run dev
```

2. Iniciar o app Angular (em outro terminal):
```bash
cd client-mobile
npm start
```

O app estará disponível em `http://localhost:4200`

## Como Funciona

1. Quando um usuário acessa `/qrcode/:qrId` no backend, ele é redirecionado para o app Angular
2. O app Angular verifica o status do QR code e redireciona para a página apropriada:
   - `/register/:qrId` - Se ainda não se cadastrou
   - `/songs/:qrId` - Se já se cadastrou mas não selecionou música
   - `/player/:qrId` - Se já selecionou música

## Estrutura de Rotas

- `/qrcode/:qrId` - Página inicial que verifica e redireciona
- `/register/:qrId` - Formulário de cadastro
- `/songs/:qrId` - Lista de músicas disponíveis
- `/player/:qrId` - Controles do player (play/pause)
- `/error` - Página de erro

## Proxy de Desenvolvimento

O arquivo `proxy.conf.json` está configurado para redirecionar requisições `/api` e `/ws` para o backend em `http://localhost:3001`.

## Build para Produção

```bash
npm run build
```

Os arquivos compilados estarão em `dist/karaoke-client-mobile`.

Para produção, configure a variável `CLIENT_MOBILE_URL` no backend para apontar para a URL do app Angular em produção.

