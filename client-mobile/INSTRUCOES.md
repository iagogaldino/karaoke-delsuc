# Instruções de Uso - Teste com Celular

## Configuração para Teste com Celular

### 1. Iniciar o Backend

```bash
cd backend
npm run dev
```

O backend estará rodando em `http://[SEU_IP]:3001`

### 2. Iniciar o App Angular

```bash
cd client-mobile
npm start
```

O app estará disponível em:
- `http://localhost:4200` (na máquina local)
- `http://[SEU_IP]:4200` (na rede local, acessível pelo celular)

**Importante:** O app está configurado com `--host 0.0.0.0`, permitindo acesso da rede local.

### 3. Descobrir seu IP Local

**Windows:**
```bash
ipconfig
```
Procure por "IPv4 Address" na sua interface de rede Wi-Fi/Ethernet (geralmente começa com 192.168.x.x)

**Linux/Mac:**
```bash
ifconfig
# ou
ip addr
```

### 4. Testar o QR Code

1. Na interface do karaokê, gere um QR code
2. O QR code já estará configurado com o IP da rede local automaticamente
3. Escaneie o QR code com seu celular
4. O celular será redirecionado para o app Angular no IP correto
5. O app Angular fará requisições para o backend no mesmo IP

## Como Funciona

1. **Detecção Automática de IP:**
   - O backend detecta automaticamente o IP da rede local usando `getLocalIP()`
   - O QR code é gerado com esse IP: `http://[IP]:3001/qrcode/:qrId`

2. **Redirecionamento:**
   - Quando o celular acessa o QR code, o backend redireciona para o app Angular
   - O backend usa o mesmo IP detectado: `http://[IP]:4200`

3. **Requisições da API:**
   - Quando o app Angular é acessado pelo IP (não localhost), ele detecta automaticamente
   - As requisições `/api` são redirecionadas para `http://[IP]:3001/api`
   - O WebSocket também usa o IP correto: `ws://[IP]:3001/ws/sync`

## Troubleshooting

### Celular não consegue acessar

1. **Verifique se estão na mesma rede Wi-Fi:**
   - Celular e computador devem estar na mesma rede

2. **Verifique o firewall:**
   - Windows: Permitir conexões na porta 4200 e 3001
   - Linux: `sudo ufw allow 4200` e `sudo ufw allow 3001`

3. **Verifique o IP:**
   - Use `ipconfig` (Windows) ou `ifconfig` (Linux/Mac)
   - Confirme que o IP está correto no QR code

### Requisições falhando

- O app Angular detecta automaticamente quando está sendo acessado por IP
- Se ainda assim não funcionar, verifique se o backend está acessível em `http://[IP]:3001/api`

## Configuração Manual (Opcional)

Se quiser forçar um IP específico, defina variáveis de ambiente:

```bash
# No backend
CLIENT_MOBILE_URL=http://192.168.1.100:4200

# No Angular (no package.json ou angular.json)
# Já está configurado para aceitar conexões da rede local
```
