/**
 * Exemplo de uso da classe LRCGenerator
 * 
 * Este arquivo demonstra como usar o gerador de LRC programaticamente
 * 
 * Para executar: npm run dev src/example.ts
 */

import { LRCGenerator } from './LRCGenerator.js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Carrega variáveis de ambiente
dotenv.config();

async function exemplo() {
  // Verifica se a API key está configurada
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY não configurada no arquivo .env');
    return;
  }

  // Cria instância do gerador
  const generator = new LRCGenerator(apiKey);

  try {
    // Exemplo 1: Geração básica
    console.log('📝 Exemplo 1: Geração básica de LRC');
    // await generator.generateLRC('exemplo.mp3');

    // Exemplo 2: Com idioma específico
    console.log('\n📝 Exemplo 2: Com idioma português');
    // await generator.generateLRC('musica.mp3', undefined, {
    //   language: 'pt',
    // });

    // Exemplo 3: Com prompt contextual
    console.log('\n📝 Exemplo 3: Com prompt contextual');
    // await generator.generateLRC('rock.mp3', 'rock_letra.lrc', {
    //   language: 'en',
    //   prompt: 'This is a rock song from the 80s',
    // });

    // Exemplo 4: Usando apenas a transcrição
    console.log('\n📝 Exemplo 4: Apenas transcrição');
    // const segments = await generator.transcribeAudio('audio.wav', {
    //   language: 'pt',
    // });
    // console.log(`Transcrito ${segments.length} segmentos`);

    // Exemplo 5: Gerar LRC a partir de segmentos
    console.log('\n📝 Exemplo 5: Gerar LRC de segmentos');
    // generator.generateLRCFromSegments(segments, 'custom.lrc');

    console.log('\n💡 Descomente os exemplos acima e forneça arquivos de áudio válidos para testar!');

  } catch (error: any) {
    console.error('❌ Erro:', error.message);
  }
}

// Executa o exemplo
exemplo().catch(console.error);

