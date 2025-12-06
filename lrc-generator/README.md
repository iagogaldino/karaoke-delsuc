# 🎤 Gerador de Arquivos LRC

Sistema automático para gerar arquivos LRC (Lyrics) de músicas usando a API de Speech da OpenAI.

## 📋 Características

- ✅ Suporte para múltiplos formatos de áudio (MP3, WAV, MP4, M4A, FLAC, OGG)
- ✅ Transcrição automática com timestamps precisos usando OpenAI Whisper
- ✅ Geração automática de arquivos LRC sincronizados
- ✅ Formatação correta de tempo [mm:ss.xx]
- ✅ Limpeza automática de letras
- ✅ Código TypeScript limpo e organizado

## 🚀 Instalação

1. Clone ou baixe este repositório

2. Instale as dependências:
```bash
npm install
```

3. Configure sua chave da OpenAI:
   - Copie o arquivo `.env.example` para `.env`
   - Edite o arquivo `.env` e adicione sua chave da API:
   ```
   OPENAI_API_KEY=sua-chave-aqui
   ```
   - Obtenha sua chave em: https://platform.openai.com/api-keys

4. Compile o projeto (opcional, se quiser usar a versão compilada):
```bash
npm run build
```

## 💻 Uso

### Modo Básico

```bash
npm run generate musica.mp3
```

### Com Opções

```bash
# Especificar idioma
npm run generate -- musica.mp3 --language pt

# Especificar caminho de saída
npm run generate -- musica.mp3 --output custom.lrc

# Especificar pasta de saída
npm run generate -- musica.mp3 --output-dir "./lrc-files"

# Adicionar prompt contextual
npm run generate -- musica.mp3 --prompt "Esta é uma música de rock dos anos 80"

# Combinar opções
npm run generate -- musica.mp3 --language pt --output-dir "./lrc-output"
```

**Nota:** Use `--` após `npm run generate` para passar argumentos corretamente ao script.

### Usando o Código Diretamente

```typescript
import { LRCGenerator } from './src/LRCGenerator.js';
import * as dotenv from 'dotenv';

dotenv.config();

const generator = new LRCGenerator(process.env.OPENAI_API_KEY!);

// Gerar LRC
await generator.generateLRC('musica.mp3');

// Ou com opções
await generator.generateLRC('musica.mp3', 'saida.lrc', {
  language: 'pt',
  prompt: 'Música brasileira'
});
```

## 📁 Estrutura do Projeto

```
lrc-generator/
├── src/
│   ├── LRCGenerator.ts    # Classe principal
│   └── index.ts            # Ponto de entrada CLI
├── dist/                   # Código compilado (gerado)
├── .env                    # Variáveis de ambiente (criar)
├── .env.example            # Exemplo de variáveis
├── package.json
├── tsconfig.json
└── README.md
```

## 🎯 Formato LRC

O arquivo gerado segue o formato padrão LRC:

```
[00:12.50] Primeira linha da letra
[00:15.30] Segunda linha da letra
[00:18.10] Terceira linha da letra
```

## ⚙️ Requisitos

- Node.js 18+ 
- TypeScript 5+
- Conta OpenAI com créditos disponíveis
- Chave da API OpenAI

## 📝 Notas

- A API da OpenAI cobra por uso. Verifique os preços em: https://openai.com/pricing
- Arquivos de áudio maiores podem levar mais tempo para processar
- A qualidade da transcrição depende da qualidade do áudio e clareza da voz
- O sistema remove automaticamente espaços extras e formata a letra corretamente

## 🔧 Desenvolvimento

```bash
# Modo desenvolvimento (com tsx)
npm run dev musica.mp3

# Compilar
npm run build

# Executar versão compilada
npm start musica.mp3
```

## 📄 Licença

MIT

## 🤝 Contribuições

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou pull requests.

