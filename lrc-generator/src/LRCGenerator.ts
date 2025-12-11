import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Classe responsável por gerar arquivos LRC a partir de arquivos de áudio
 * usando a API de Speech da OpenAI
 */
export class LRCGenerator {
  private openai: OpenAI;
  private supportedFormats = ['.mp3', '.wav', '.mp4', '.m4a', '.flac', '.ogg', '.webm'];

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('OpenAI API key é obrigatória');
    }
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Verifica se o formato do arquivo é suportado
   */
  private isSupportedFormat(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedFormats.includes(ext);
  }

  /**
   * Valida se o arquivo existe e é suportado
   */
  private validateAudioFile(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }

    if (!this.isSupportedFormat(filePath)) {
      throw new Error(
        `Formato não suportado. Formatos aceitos: ${this.supportedFormats.join(', ')}`
      );
    }
  }

  /**
   * Converte segundos para formato LRC [mm:ss.xx]
   */
  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const secsInt = Math.floor(secs);
    const centiseconds = Math.floor((secs - secsInt) * 100);

    return `[${String(minutes).padStart(2, '0')}:${String(secsInt).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}]`;
  }

  /**
   * Limpa e formata o texto da letra
   */
  private cleanLyrics(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Remove espaços múltiplos
      .replace(/\n{3,}/g, '\n\n'); // Remove múltiplas quebras de linha
  }

  /**
   * Converte a transcrição com timestamps para formato LRC
   */
  private convertToLRC(segments: Array<{ start: number; end: number; text: string }>): string {
    if (!segments || segments.length === 0) {
      throw new Error('Nenhum segmento de transcrição encontrado');
    }

    const lrcLines: string[] = [];

    for (const segment of segments) {
      const startTime = this.formatTime(segment.start);
      const text = this.cleanLyrics(segment.text);

      // Ignora segmentos vazios
      if (!text) {
        continue;
      }

      lrcLines.push(`${startTime}${text}`);
    }

    // Garante que não há saltos de tempo incorretos
    // Ordena por tempo de início (caso não esteja ordenado)
    const sortedLines = lrcLines.sort((a, b) => {
      const timeA = this.parseLrcTime(a.match(/\[(\d{2}:\d{2}\.\d{2})\]/)?.[1] || '00:00.00');
      const timeB = this.parseLrcTime(b.match(/\[(\d{2}:\d{2}\.\d{2})\]/)?.[1] || '00:00.00');
      return timeA - timeB;
    });

    return sortedLines.join('\n');
  }

  /**
   * Converte tempo LRC [mm:ss.xx] para segundos
   */
  private parseLrcTime(timeStr: string): number {
    const [minutes, rest] = timeStr.split(':');
    const [seconds, centiseconds] = rest.split('.');
    return (
      parseInt(minutes, 10) * 60 +
      parseInt(seconds, 10) +
      parseInt(centiseconds, 10) / 100
    );
  }

  /**
   * Gera o prompt padrão com instruções para símbolos sonoros e palavras arrastadas
   */
  private getDefaultPrompt(userPrompt?: string): string {
    // Prompt muito curto e direto - apenas contexto, sem instruções explícitas
    // O Whisper pode transcrever partes do prompt se for muito detalhado
    const defaultInstructions = userPrompt || '';

    // Retorna apenas o contexto do usuário, sem instruções que possam ser transcritas
    // As instruções sobre símbolos e hífens serão aplicadas pós-processamento se necessário
    return defaultInstructions;
  }

  /**
   * Faz upload e transcreve o áudio usando OpenAI Whisper API
   */
  async transcribeAudio(
    audioFilePath: string,
    options?: {
      language?: string;
      prompt?: string;
      responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
    }
  ): Promise<Array<{ start: number; end: number; text: string }>> {
    this.validateAudioFile(audioFilePath);

    console.log(`📤 Fazendo upload do arquivo: ${audioFilePath}`);

    try {
      const filename = path.basename(audioFilePath);
      
      // Lê o arquivo como buffer
      const audioBuffer = fs.readFileSync(audioFilePath);
      
      // Cria um File object compatível com a OpenAI SDK
      // No Node.js 18+, File está disponível globalmente
      // Para versões anteriores, cria um objeto File-like
      let audioFile: File | any;
      
      if (typeof File !== 'undefined') {
        // Node.js 18+ - usa File nativo
        audioFile = new File([audioBuffer], filename, {
          type: this.getMimeType(audioFilePath),
        });
      } else {
        // Fallback para versões anteriores do Node.js
        // A OpenAI SDK aceita objetos com stream() method
        const stream = fs.createReadStream(audioFilePath);
        audioFile = {
          name: filename,
          stream: () => stream,
          arrayBuffer: async () => audioBuffer.buffer,
          size: audioBuffer.length,
          type: this.getMimeType(audioFilePath),
        };
      }

      // Combina o prompt padrão com o prompt do usuário (se fornecido)
      const finalPrompt = this.getDefaultPrompt(options?.prompt);

      // Usa a API de transcrição com timestamps detalhados
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: options?.language,
        prompt: finalPrompt,
        response_format: 'verbose_json', // Retorna timestamps detalhados
        timestamp_granularities: ['segment'], // Timestamps por segmento
      });

      console.log('✅ Transcrição concluída');

      // Se for verbose_json, já temos os segments
      if ('segments' in transcription && Array.isArray(transcription.segments)) {
        return transcription.segments.map((seg: any) => ({
          start: seg.start,
          end: seg.end,
          text: seg.text.trim(),
        }));
      }

      // Fallback: se não tiver segments, cria um segmento único
      const text = 'text' in transcription ? transcription.text : '';
      if (!text) {
        throw new Error('Transcrição retornou vazia');
      }

      // Tenta obter duração do arquivo para criar um segmento único
      // Nota: Isso é um fallback, o ideal é sempre usar verbose_json
      return [
        {
          start: 0,
          end: 0, // Será ajustado se necessário
          text: text,
        },
      ];
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Arquivo não encontrado: ${audioFilePath}`);
      }
      if (error.status === 401) {
        throw new Error('API key inválida. Verifique sua chave da OpenAI.');
      }
      if (error.status === 429) {
        throw new Error('Limite de requisições excedido. Tente novamente mais tarde.');
      }
      throw new Error(`Erro na transcrição: ${error.message}`);
    }
  }

  /**
   * Obtém o MIME type do arquivo de áudio
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.mp4': 'audio/mp4',
      '.m4a': 'audio/mp4',
      '.flac': 'audio/flac',
      '.ogg': 'audio/ogg',
      '.webm': 'audio/webm',
    };
    return mimeTypes[ext] || 'audio/mpeg';
  }

  /**
   * Gera o arquivo LRC a partir de um arquivo de áudio
   */
  async generateLRC(
    audioFilePath: string,
    outputPath?: string,
    options?: {
      language?: string;
      prompt?: string;
    }
  ): Promise<string> {
    console.log(`🎵 Iniciando geração de LRC para: ${audioFilePath}`);

    // Transcreve o áudio
    const segments = await this.transcribeAudio(audioFilePath, {
      ...options,
      responseFormat: 'verbose_json',
    });

    // Converte para formato LRC
    const lrcContent = this.convertToLRC(segments);

    // Define o caminho de saída
    const audioName = path.basename(audioFilePath, path.extname(audioFilePath));
    let finalOutputPath: string;

    if (outputPath) {
      // Se outputPath for uma pasta (termina com / ou \), coloca o arquivo lá
      if (outputPath.endsWith(path.sep) || outputPath.endsWith('/') || outputPath.endsWith('\\')) {
        // É uma pasta - cria se não existir
        if (!fs.existsSync(outputPath)) {
          fs.mkdirSync(outputPath, { recursive: true });
        }
        // Se for um diretório de música (contém 'music' no caminho), usa 'lyrics.lrc'
        // Caso contrário, usa o nome do áudio
        const isMusicDir = outputPath.toLowerCase().includes('music');
        const fileName = isMusicDir ? 'lyrics.lrc' : `${audioName}.lrc`;
        finalOutputPath = path.join(outputPath, fileName);
      } else {
        // É um caminho completo de arquivo
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        finalOutputPath = outputPath;
      }
    } else {
      // Se outputPath não foi fornecido, tentar usar nova estrutura: music/[nome]/
      const audioDir = path.dirname(audioFilePath);
      let projectRoot = audioDir;
      
      // Tentar encontrar a raiz do projeto
      if (audioDir.includes('lrc-generator')) {
        projectRoot = path.dirname(audioDir);
      } else {
        // Procurar pela pasta music/ subindo diretórios
        let testPath = audioDir;
        for (let i = 0; i < 3; i++) {
          if (fs.existsSync(path.join(testPath, 'music'))) {
            projectRoot = testPath;
            break;
          }
          testPath = path.dirname(testPath);
        }
      }
      
      const musicDir = path.join(projectRoot, 'music', audioName);
      finalOutputPath = path.join(musicDir, 'lyrics.lrc');
    }

    // Se o arquivo já existe, remove-o para garantir substituição
    if (fs.existsSync(finalOutputPath)) {
      console.log(`📝 Substituindo arquivo LRC existente: ${finalOutputPath}`);
      fs.unlinkSync(finalOutputPath);
    }

    // Se for um diretório de música, também remove arquivos LRC antigos com nomes diferentes
    const outputDir = path.dirname(finalOutputPath);
    if (outputDir.toLowerCase().includes('music')) {
      try {
        const files = fs.readdirSync(outputDir);
        const oldLrcFiles = files.filter((f: string) => 
          f.toLowerCase().endsWith('.lrc') && 
          f.toLowerCase() !== 'lyrics.lrc' &&
          path.basename(f, '.lrc') === audioName
        );
        oldLrcFiles.forEach((oldFile: string) => {
          const oldFilePath = path.join(outputDir, oldFile);
          console.log(`🗑️  Removendo arquivo LRC antigo: ${oldFile}`);
          fs.unlinkSync(oldFilePath);
        });
      } catch (err) {
        // Ignora erros ao listar/remover arquivos antigos
      }
    }

    // Salva o arquivo LRC
    fs.writeFileSync(finalOutputPath, lrcContent, 'utf-8');

    console.log(`✅ Arquivo LRC gerado com sucesso: ${finalOutputPath}`);
    console.log(`📊 Total de segmentos: ${segments.length}`);

    return finalOutputPath;
  }

  /**
   * Gera LRC a partir de uma transcrição já existente (útil para testes)
   */
  generateLRCFromSegments(
    segments: Array<{ start: number; end: number; text: string }>,
    outputPath: string
  ): string {
    const lrcContent = this.convertToLRC(segments);
    fs.writeFileSync(outputPath, lrcContent, 'utf-8');
    console.log(`✅ Arquivo LRC gerado: ${outputPath}`);
    return outputPath;
  }
}

