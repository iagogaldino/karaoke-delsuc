# 🚀 Guia Rápido de Início

## Instalação Rápida

1. **Instale as dependências:**
```bash
npm install
```

2. **Configure sua chave da OpenAI:**
   - Crie um arquivo `.env` na raiz do projeto
   - Adicione sua chave:
   ```
   OPENAI_API_KEY=sk-sua-chave-aqui
   ```
   - Obtenha sua chave em: https://platform.openai.com/api-keys

3. **Use o gerador:**
```bash
npm run generate musica.mp3
```

## Exemplos de Uso

### Básico
```bash
npm run generate musica.mp3
```

### Com idioma específico
```bash
npm run generate -- musica.mp3 --language pt
```

### Com caminho de saída personalizado
```bash
npm run generate -- musica.mp3 --output letra.lrc
```

### Com pasta de saída
```bash
npm run generate -- musica.mp3 --output-dir "./lrc-output"
```

### Com prompt contextual (melhora a transcrição)
```bash
npm run generate -- musica.mp3 --prompt "Esta é uma música brasileira de samba"
```

**Nota:** Use `--` após `npm run generate` para passar argumentos corretamente ao script.

## Requisitos

- Node.js 18 ou superior (para suporte nativo ao File API)
- Conta OpenAI com créditos disponíveis
- Arquivos de áudio nos formatos: MP3, WAV, MP4, M4A, FLAC, OGG

## Notas Importantes

- A API da OpenAI cobra por uso (aproximadamente $0.006 por minuto)
- Arquivos maiores levam mais tempo para processar
- A qualidade da transcrição depende da qualidade do áudio
- O sistema gera automaticamente o arquivo `.lrc` no mesmo diretório do áudio

## Solução de Problemas

### Erro: "File is not defined"
- Certifique-se de estar usando Node.js 18 ou superior
- O File API está disponível globalmente no Node.js 18+

### Erro: "API key inválida"
- Verifique se o arquivo `.env` está na raiz do projeto
- Confirme que a chave está correta e ativa

### Erro: "Limite de requisições excedido"
- Você atingiu o limite de rate da API
- Aguarde alguns minutos e tente novamente

