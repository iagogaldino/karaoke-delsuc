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
   * Converte palavras com timestamps para formato LRC palavra por palavra
   * Formato: [mm:ss.xx]<mm:ss.xx>palavra <mm:ss.xx>palavra
   * Detecta pausas >0.5s e cria nova linha
   */
  private convertToLRC(words: Array<{ start: number; end: number; word: string }>): string {
    if (!words || words.length === 0) {
      throw new Error('Nenhuma palavra encontrada na transcrição');
    }

    const lrcLines: string[] = [];
    const PAUSE_THRESHOLD = 0.5; // 0.5 segundos

    // Agrupar palavras em linhas baseado em pausas
    let currentLine: Array<{ start: number; end: number; word: string }> = [];
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      // Ignorar palavras vazias
      if (!word.word || !word.word.trim()) {
        continue;
      }

      // Verificar se há pausa antes desta palavra
      if (currentLine.length > 0) {
        const previousWord = currentLine[currentLine.length - 1];
        const pauseDuration = word.start - previousWord.end;
        
        // Se houver pausa >0.5s, finalizar linha atual e começar nova
        if (pauseDuration > PAUSE_THRESHOLD) {
          // Formatar e adicionar linha atual
          const lineContent = this.formatWordLine(currentLine);
          if (lineContent) {
            lrcLines.push(lineContent);
          }
          // Iniciar nova linha
          currentLine = [word];
        } else {
          // Adicionar palavra à linha atual
          currentLine.push(word);
        }
      } else {
        // Primeira palavra - iniciar nova linha
        currentLine.push(word);
      }
    }

    // Adicionar última linha se houver palavras
    if (currentLine.length > 0) {
      const lineContent = this.formatWordLine(currentLine);
      if (lineContent) {
        lrcLines.push(lineContent);
      }
    }

    return lrcLines.join('\n');
  }

  /**
   * Formata uma linha de palavras no formato LRC palavra por palavra
   * Primeira palavra: [mm:ss.xx]<mm:ss.xx>palavra
   * Palavras seguintes: <mm:ss.xx>palavra
   */
  private formatWordLine(words: Array<{ start: number; end: number; word: string }>): string {
    if (words.length === 0) {
      return '';
    }

    const firstWord = words[0];
    const firstWordStart = this.formatTime(firstWord.start);
    const firstWordStartTag = this.formatTimeTag(firstWord.start);
    
    // Primeira palavra: [mm:ss.xx]<mm:ss.xx>palavra
    let line = `${firstWordStart}${firstWordStartTag}${firstWord.word}`;

    // Palavras seguintes: <mm:ss.xx>palavra
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const wordStartTag = this.formatTimeTag(word.start);
      line += ` ${wordStartTag}${word.word}`;
    }

    return line;
  }

  /**
   * Formata tempo para tag <mm:ss.xx> (sem colchetes externos)
   */
  private formatTimeTag(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const secsInt = Math.floor(secs);
    const centiseconds = Math.floor((secs - secsInt) * 100);

    return `<${String(minutes).padStart(2, '0')}:${String(secsInt).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}>`;
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
    // Se o usuário forneceu um prompt, usa ele
    if (userPrompt && userPrompt.trim()) {
      return userPrompt.trim();
    }
    
    // Prompt padrão quando não há prompt do usuário
    // Em inglês para não influenciar a detecção de idioma
    return 'This is a song. Transcribe the lyrics exactly as they are being sung, preserving the original language.';
  }

  /**
   * Faz upload e transcreve o áudio usando OpenAI Whisper API
   * Retorna palavras individuais com timestamps precisos
   */
  async transcribeAudio(
    audioFilePath: string,
    options?: {
      language?: string;
      prompt?: string;
      responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
    }
  ): Promise<Array<{ start: number; end: number; word: string }>> {
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

      // Log do prompt para debug
      if (finalPrompt) {
        console.log(`📝 Usando prompt: ${finalPrompt.substring(0, 150)}...`);
      } else {
        console.log(`⚠️ Nenhum prompt fornecido`);
      }

      // Log do tamanho do arquivo
      console.log(`📊 Tamanho do arquivo de áudio: ${audioFile.size} bytes`);

      // Usa a API de transcrição com timestamps por palavra
      // Adicionar temperature=0 para tornar a transcrição mais determinística e precisa
      // Não especificar language para que o Whisper detecte automaticamente o idioma original
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: options?.language || undefined, // Deixar undefined para detecção automática
        prompt: finalPrompt || undefined,
        temperature: 0, // Tornar a transcrição mais determinística
        response_format: 'verbose_json', // Retorna timestamps detalhados
        timestamp_granularities: ['word'], // Timestamps por palavra
      });

      console.log('✅ Transcrição concluída');

      // Processar palavras retornadas pela API
      if ('words' in transcription && Array.isArray(transcription.words)) {
        // Filtrar palavras vazias e retornar array de palavras com timestamps
        return transcription.words
          .filter((word: any) => word.word && word.word.trim())
          .map((word: any) => ({
            start: word.start,
            end: word.end,
            word: word.word.trim(),
          }));
      }

      // Fallback: se não tiver words, tentar usar segments (compatibilidade)
      if ('segments' in transcription && Array.isArray(transcription.segments)) {
        console.warn('⚠️ API não retornou palavras, usando segmentos como fallback');
        const words: Array<{ start: number; end: number; word: string }> = [];
        
        for (const seg of transcription.segments) {
          // Dividir texto do segmento em palavras aproximadas
          const text = seg.text.trim();
          if (!text) continue;
          
          const segmentDuration = seg.end - seg.start;
          const wordsInText = text.split(/\s+/).filter(w => w.trim());
          const wordDuration = segmentDuration / wordsInText.length;
          
          wordsInText.forEach((word, index) => {
            words.push({
              start: seg.start + (index * wordDuration),
              end: seg.start + ((index + 1) * wordDuration),
              word: word.trim(),
            });
          });
        }
        
        return words;
      }

      // Fallback final: se não tiver words nem segments, cria uma palavra única
      const text = 'text' in transcription ? transcription.text : '';
      if (!text) {
        throw new Error('Transcrição retornou vazia');
      }

      return [
        {
          start: 0,
          end: 0, // Será ajustado se necessário
          word: text.trim(),
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

    // Transcreve o áudio (retorna palavras individuais)
    const words = await this.transcribeAudio(audioFilePath, {
      ...options,
      responseFormat: 'verbose_json',
    });

    // Converte para formato LRC palavra por palavra
    const lrcContent = this.convertToLRC(words);

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
        // Se for um diretório de música (contém 'music' no caminho)
        // Verificar se é o diretório scoring/ para usar recording-lyrics.lrc
        const isMusicDir = outputPath.toLowerCase().includes('music');
        const isScoringDir = outputPath.toLowerCase().includes('scoring');
        // Se for diretório de scoring, usar recording-lyrics.lrc
        // Se for diretório de música normal, usar lyrics.lrc
        // Caso contrário, usa o nome do áudio
        const fileName = isScoringDir ? 'recording-lyrics.lrc' : (isMusicDir ? 'lyrics.lrc' : `${audioName}.lrc`);
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
    console.log(`📊 Total de palavras: ${words.length}`);

    return finalOutputPath;
  }

  /**
   * Gera LRC a partir de palavras já transcritas (útil para testes)
   */
  generateLRCFromWords(
    words: Array<{ start: number; end: number; word: string }>,
    outputPath: string
  ): string {
    const lrcContent = this.convertToLRC(words);
    fs.writeFileSync(outputPath, lrcContent, 'utf-8');
    console.log(`✅ Arquivo LRC gerado: ${outputPath}`);
    return outputPath;
  }
}

