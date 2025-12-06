import { LRCGenerator } from './LRCGenerator.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Carrega variáveis de ambiente
dotenv.config();

/**
 * Função principal para processar argumentos da linha de comando
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
🎤 Gerador de Arquivos LRC
==========================

Uso:
  npm run generate <caminho-do-audio> [opções]

Exemplos:
  npm run generate musica.mp3
  npm run generate "C:/Músicas/cancion.mp3"
  npm run generate audio.wav --language pt
  npm run generate song.mp3 --output custom.lrc
  npm run generate song.mp3 --output-dir "./lrc-files"
  npm run generate song.mp3 --output-dir "C:/LRC"

Opções:
  --language <idioma>    Idioma do áudio (ex: pt, en, es)
  --output <caminho>      Caminho personalizado para o arquivo LRC ou pasta de saída
  --output-dir <pasta>    Pasta onde salvar o arquivo LRC (cria automaticamente se não existir)
  --prompt <texto>        Prompt contextual para melhorar a transcrição

Variáveis de Ambiente:
  OPENAI_API_KEY          Chave da API da OpenAI (obrigatória)
    `);
    process.exit(1);
  }

  const audioFilePath = args[0];

  // Verifica se o arquivo existe
  if (!fs.existsSync(audioFilePath)) {
    console.error(`❌ Erro: Arquivo não encontrado: ${audioFilePath}`);
    process.exit(1);
  }

  // Verifica se a API key está configurada
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(`
❌ Erro: OPENAI_API_KEY não configurada!

Por favor, crie um arquivo .env na raiz do projeto com:
OPENAI_API_KEY=sua-chave-aqui

Ou defina a variável de ambiente diretamente.
    `);
    process.exit(1);
  }

  // Parse das opções
  const options: { language?: string; prompt?: string; output?: string; outputDir?: string } = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--language' && args[i + 1]) {
      options.language = args[i + 1];
      i++;
    } else if (args[i] === '--prompt' && args[i + 1]) {
      options.prompt = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      options.output = args[i + 1];
      i++;
    } else if (args[i] === '--output-dir' && args[i + 1]) {
      options.outputDir = args[i + 1];
      i++;
    }
  }

  // Se outputDir foi especificado, usa ele (tem prioridade sobre output)
  if (options.outputDir) {
    // Garante que termina com separador de pasta
    const outputDir = options.outputDir.endsWith(path.sep) 
      ? options.outputDir 
      : options.outputDir + path.sep;
    options.output = outputDir;
  } else if (!options.output) {
    // Se nenhum output foi especificado, usar nova estrutura: music/[nome]/
    const audioName = path.basename(audioFilePath, path.extname(audioFilePath));
    const audioDir = path.dirname(audioFilePath);
    // Tentar encontrar a raiz do projeto
    let projectRoot = audioDir;
    if (audioDir.includes('lrc-generator')) {
      projectRoot = path.dirname(audioDir);
    }
    const musicDir = path.join(projectRoot, 'music', audioName);
    options.output = musicDir + path.sep;
  }

  try {
    // Cria instância do gerador
    const generator = new LRCGenerator(apiKey);

    // Gera o arquivo LRC
    const outputPath = await generator.generateLRC(audioFilePath, options.output, {
      language: options.language,
      prompt: options.prompt,
    });

    console.log(`
✨ Processo concluído com sucesso!
📁 Arquivo LRC salvo em: ${path.resolve(outputPath)}
    `);
  } catch (error: any) {
    console.error(`\n❌ Erro ao gerar LRC: ${error.message}`);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Executa a função principal
main().catch((error) => {
  console.error('Erro fatal:', error);
  process.exit(1);
});

