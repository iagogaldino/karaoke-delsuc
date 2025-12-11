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

  // Primeiro argumento é sempre o arquivo de áudio
  // Limpar aspas se existirem
  let audioFilePath = args[0];
  if (audioFilePath.startsWith('"') && audioFilePath.endsWith('"')) {
    audioFilePath = audioFilePath.slice(1, -1);
  } else if (audioFilePath.startsWith("'") && audioFilePath.endsWith("'")) {
    audioFilePath = audioFilePath.slice(1, -1);
  }

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
  
  // Debug: mostrar todos os argumentos recebidos
  console.log('📝 Argumentos recebidos:', JSON.stringify(args));
  
  for (let i = 1; i < args.length; i++) {
    const currentArg = args[i];
    const nextArg = args[i + 1];
    
    if (currentArg === '--language' && nextArg) {
      // Limpar aspas do valor
      let langValue = nextArg.trim();
      if ((langValue.startsWith('"') && langValue.endsWith('"')) || 
          (langValue.startsWith("'") && langValue.endsWith("'"))) {
        langValue = langValue.slice(1, -1);
      }
      options.language = langValue;
      i++;
    } else if (currentArg === '--prompt' && nextArg) {
      let promptValue = nextArg.trim();
      if ((promptValue.startsWith('"') && promptValue.endsWith('"')) || 
          (promptValue.startsWith("'") && promptValue.endsWith("'"))) {
        promptValue = promptValue.slice(1, -1);
      }
      options.prompt = promptValue;
      i++;
    } else if (currentArg === '--output' && nextArg) {
      let outputValue = nextArg.trim();
      if ((outputValue.startsWith('"') && outputValue.endsWith('"')) || 
          (outputValue.startsWith("'") && outputValue.endsWith("'"))) {
        outputValue = outputValue.slice(1, -1);
      }
      options.output = outputValue;
      i++;
    } else if (currentArg === '--output-dir' && nextArg) {
      // Remover aspas e espaços extras do caminho
      let outputDir = nextArg.trim();
      
      // Remover aspas se existirem (pode ter aspas no início e fim, ou apenas no final)
      if (outputDir.startsWith('"')) {
        outputDir = outputDir.slice(1);
      }
      if (outputDir.endsWith('"')) {
        outputDir = outputDir.slice(0, -1);
      }
      if (outputDir.startsWith("'")) {
        outputDir = outputDir.slice(1);
      }
      if (outputDir.endsWith("'")) {
        outputDir = outputDir.slice(0, -1);
      }
      
      // Remover qualquer coisa após o separador de diretório que não seja parte do caminho
      // (como --language que pode ter sido concatenado devido a problemas de parsing)
      // Procurar por padrões como " --" ou " --language" no final
      const flagIndex = outputDir.indexOf(' --');
      if (flagIndex > -1) {
        outputDir = outputDir.substring(0, flagIndex);
      }
      // Também procurar por " --language" especificamente
      const languageIndex = outputDir.indexOf(' --language');
      if (languageIndex > -1) {
        outputDir = outputDir.substring(0, languageIndex);
      }
      // Procurar por qualquer flag que possa ter sido concatenado
      const anyFlagMatch = outputDir.match(/^(.+?)(?:\s+--\w+.*)?$/);
      if (anyFlagMatch && anyFlagMatch[1] !== outputDir) {
        outputDir = anyFlagMatch[1];
      }
      
      // Limpar espaços finais
      outputDir = outputDir.trim();
      // Remover aspas finais que possam ter sobrado
      while (outputDir.endsWith('"') || outputDir.endsWith("'")) {
        outputDir = outputDir.slice(0, -1).trim();
      }
      
      console.log(`📝 output-dir parseado: "${outputDir}"`);
      options.outputDir = outputDir;
      i++;
    }
  }
  
  console.log('📝 Opções parseadas:', JSON.stringify(options, null, 2));

  // Se outputDir foi especificado, usa ele (tem prioridade sobre output)
  if (options.outputDir) {
    // Limpar o caminho novamente para garantir que não há flags concatenados
    let cleanOutputDir = options.outputDir.trim();
    // Remover qualquer flag que possa ter sido concatenado
    const flagMatch = cleanOutputDir.match(/^(.+?)(?:\s+--\w+.*)?$/);
    if (flagMatch) {
      cleanOutputDir = flagMatch[1].trim();
    }
    // Remover aspas finais
    while (cleanOutputDir.endsWith('"') || cleanOutputDir.endsWith("'")) {
      cleanOutputDir = cleanOutputDir.slice(0, -1).trim();
    }
    // Garante que termina com separador de pasta
    const outputDir = cleanOutputDir.endsWith(path.sep) 
      ? cleanOutputDir 
      : cleanOutputDir + path.sep;
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

