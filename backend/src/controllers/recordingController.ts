import { Request, Response } from 'express';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { getSongById } from '../utils/database.js';
import multer from 'multer';
import { PROJECT_ROOT, PATHS } from '../config/index.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { execPython } from '../services/processingService.js';

// Configure multer for recording uploads
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max for recordings
});

/**
 * POST /api/recording/upload
 * Upload recording file
 */
export const uploadRecording = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }

  const { songId, startTime } = req.body;

  if (!songId) {
    return res.status(400).json({ error: 'songId é obrigatório' });
  }

  // Verificar se a música existe (ou se é uma gravação de teste)
  const isTestRecording = songId === 'test-recording';
  let song;
  
  if (!isTestRecording) {
    song = getSongById(songId);
    if (!song) {
      return res.status(404).json({ error: 'Música não encontrada' });
    }
  } else {
    // Criar objeto de música fictício para teste
    song = {
      id: 'test-recording',
      name: 'Teste de Gravação',
      displayName: 'Teste de Gravação',
      artist: 'Teste',
      duration: 0,
      status: { ready: true, vocals: false, instrumental: false, waveform: false, lyrics: false },
    };
  }

  // Criar diretório de gravações para esta música
  const musicDir = join(PATHS.MUSIC_DIR, songId);
  const recordingsDir = join(musicDir, 'recordings');
  
  if (!existsSync(recordingsDir)) {
    mkdirSync(recordingsDir, { recursive: true });
  }

  // Gerar nome único para a gravação
  const timestamp = Date.now();
  const recordingId = `recording-${timestamp}`;
  const recordingPath = join(recordingsDir, `${recordingId}.webm`);

  // Salvar arquivo
  writeFileSync(recordingPath, req.file.buffer);

  // Salvar metadados (startTime)
  const metadataPath = join(recordingsDir, `${recordingId}.json`);
  const metadata = {
    recordingId,
    songId,
    startTime: parseFloat(startTime || '0'),
    timestamp,
    filename: `${recordingId}.webm`,
  };
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  console.log(`📼 Gravação salva: ${recordingPath}`);
  console.log(`   Música: ${song.name}`);
  console.log(`   Tamanho: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);

  res.json({
    success: true,
    recordingId,
    filePath: recordingPath,
    message: 'Gravação salva com sucesso',
  });
});

/**
 * POST /api/recording/generate-lrc/:songId
 * Generate LRC from recording
 */
export const generateLRC = asyncHandler(async (req: Request, res: Response) => {
  const { songId } = req.params;
  const { recordingId } = req.query;
  
  console.log(`🔄 Gerando LRC para songId: ${songId}, recordingId: ${recordingId || 'mais recente'}`);

  if (!songId) {
    return res.status(400).json({ error: 'songId é obrigatório' });
  }

  // Verificar se a música existe (ou se é uma gravação de teste)
  const isTestRecording = songId === 'test-recording';
  let song;
  
  if (!isTestRecording) {
    song = getSongById(songId);
    if (!song) {
      return res.status(404).json({ error: 'Música não encontrada' });
    }
  } else {
    // Criar objeto de música fictício para teste
    song = {
      id: 'test-recording',
      name: 'Teste de Gravação',
      displayName: 'Teste de Gravação',
      artist: 'Teste',
      duration: 0,
      files: {
        vocals: '',
        instrumental: '',
        waveform: '',
        lyrics: '',
      },
      metadata: {
        sampleRate: 0,
        format: '',
        createdAt: new Date().toISOString(),
      },
      status: { ready: true, vocals: false, instrumental: false, waveform: false, lyrics: false },
    } as any;
  }

  const musicDir = join(PATHS.MUSIC_DIR, songId);
  const recordingsDir = join(musicDir, 'recordings');

  if (!existsSync(recordingsDir)) {
    return res.status(404).json({ error: 'Nenhuma gravação encontrada para esta música' });
  }

  // Encontrar a gravação mais recente ou a especificada
  let recordingFile: string;
  let metadataFile: string;

  if (recordingId) {
    recordingFile = join(recordingsDir, `${recordingId}.webm`);
    metadataFile = join(recordingsDir, `${recordingId}.json`);
  } else {
    // Buscar a gravação mais recente
    const fs = await import('fs/promises');
    const files = await fs.readdir(recordingsDir);
    const webmFiles = files.filter(f => f.endsWith('.webm'));
    
    if (webmFiles.length === 0) {
      return res.status(404).json({ error: 'Nenhuma gravação encontrada' });
    }

    // Ordenar por timestamp (mais recente primeiro)
    webmFiles.sort((a, b) => {
      const timestampA = parseInt(a.replace('recording-', '').replace('.webm', ''));
      const timestampB = parseInt(b.replace('recording-', '').replace('.webm', ''));
      return timestampB - timestampA;
    });

    const latestRecording = webmFiles[0];
    recordingFile = join(recordingsDir, latestRecording);
    metadataFile = join(recordingsDir, latestRecording.replace('.webm', '.json'));
  }

  if (!existsSync(recordingFile)) {
    return res.status(404).json({ error: 'Arquivo de gravação não encontrado' });
  }

  // Validar integridade do arquivo
  const fs = await import('fs');
  const fileStats = fs.statSync(recordingFile);
  if (fileStats.size === 0) {
    return res.status(400).json({ 
      success: false,
      error: 'Arquivo de gravação está vazio ou corrompido' 
    });
  }
  
  // Verificar se o arquivo é muito pequeno (menos de 5KB pode indicar problema)
  if (fileStats.size < 5 * 1024) {
    console.warn(`⚠️ Arquivo de gravação muito pequeno: ${(fileStats.size / 1024).toFixed(2)} KB`);
    console.warn(`⚠️ Isso pode indicar que a gravação foi muito curta ou teve problemas`);
  }
  
  console.log(`📊 Arquivo de gravação: ${(fileStats.size / 1024).toFixed(2)} KB`);

  // Ler metadados se existirem
  let startTime = 0;
  if (existsSync(metadataFile)) {
    try {
      const metadata = JSON.parse(readFileSync(metadataFile, 'utf-8'));
      startTime = metadata.startTime || 0;
    } catch (err) {
      console.warn('Erro ao ler metadados da gravação:', err);
    }
  }

  // Converter WebM para MP3 (sempre converter para garantir compatibilidade)
  // O arquivo WebM pode estar corrompido ou em formato que a API não aceita bem
  const convertedPath = join(recordingsDir, 'converted-for-lrc.mp3');
  
  console.log(`🔄 Convertendo gravação para MP3...`);
  console.log(`   Arquivo original: ${recordingFile}`);
  console.log(`   Tamanho: ${(fileStats.size / 1024).toFixed(2)} KB`);
  
  let audioForLRC = recordingFile;
  
  // Sempre converter WebM para MP3 (obrigatório para garantir compatibilidade)
  if (recordingFile.endsWith('.webm')) {
    let conversionSuccess = false;
    
    // Primeiro, tentar usar o script Python (se disponível)
    const convertScript = join(PROJECT_ROOT, 'youtube-downloader', 'convert_audio_to_mp3.py');
    if (existsSync(convertScript)) {
      try {
        console.log(`🔄 Tentando conversão com script Python...`);
        await execPython(
          `python "${convertScript}" "${recordingFile}" "${convertedPath}" "128k" "22050" "1"`,
          undefined,
          `[Convert Recording]`
        );
        
        // Verificar se o arquivo foi criado
        if (existsSync(convertedPath)) {
          const convertedStats = fs.statSync(convertedPath);
          if (convertedStats.size > 0) {
            console.log(`✅ Conversão com script Python concluída: ${(convertedStats.size / 1024).toFixed(2)} KB`);
            audioForLRC = convertedPath;
            conversionSuccess = true;
          }
        }
      } catch (convertError: any) {
        console.warn(`⚠️ Script Python falhou, tentando ffmpeg diretamente...`);
        console.warn(`   Erro: ${convertError.message}`);
      }
    }
    
    // Se o script Python falhou ou não existe, tentar ffmpeg diretamente
    if (!conversionSuccess) {
      try {
        const { spawn } = await import('child_process');
        
        // Verificar se ffmpeg está disponível
        await new Promise<void>((resolve, reject) => {
          const checkFfmpeg = spawn('ffmpeg', ['-version'], { shell: true, stdio: 'ignore' });
          checkFfmpeg.on('close', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error('ffmpeg não encontrado'));
            }
          });
          checkFfmpeg.on('error', () => reject(new Error('ffmpeg não encontrado')));
        });
        
        console.log(`🔄 Convertendo com ffmpeg diretamente...`);
        console.log(`   Tamanho do arquivo original: ${(fileStats.size / 1024).toFixed(2)} KB`);
        
        // Converter usando ffmpeg com opções mais robustas para WebM
        await new Promise<void>((resolve, reject) => {
          const ffmpeg = spawn('ffmpeg', [
            '-f', 'webm', // Forçar formato de entrada
            '-i', recordingFile,
            '-acodec', 'libmp3lame',
            '-ab', '128k',
            '-ar', '22050',
            '-ac', '1',
            '-f', 'mp3', // Forçar formato de saída
            '-y', // Sobrescrever se existir
            convertedPath
          ], { 
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe']
          });
          
          let ffmpegStderr = '';
          
          ffmpeg.stderr.on('data', (data) => {
            ffmpegStderr += data.toString();
          });
          
          ffmpeg.on('close', (code) => {
            if (existsSync(convertedPath)) {
              const convertedStats = fs.statSync(convertedPath);
              if (convertedStats.size > 0) {
                console.log(`✅ Conversão com ffmpeg concluída: ${(convertedStats.size / 1024).toFixed(2)} KB`);
                audioForLRC = convertedPath;
                resolve();
              } else {
                reject(new Error('Arquivo convertido está vazio'));
              }
            } else {
              reject(new Error(`Conversão falhou com código ${code}. ${ffmpegStderr.substring(0, 200)}`));
            }
          });
          
          ffmpeg.on('error', (err) => {
            reject(err);
          });
        });
        
        conversionSuccess = true;
      } catch (ffmpegError: any) {
        console.error(`❌ Conversão com ffmpeg falhou: ${ffmpegError.message}`);
        return res.status(500).json({
          success: false,
          error: `Não foi possível converter a gravação para MP3. O arquivo pode estar corrompido. Erro: ${ffmpegError.message}`
        });
      }
    }
  } else {
    // Se não for WebM, usar o arquivo original
    audioForLRC = recordingFile;
  }
  
  console.log(`📝 Arquivo de áudio a ser usado: ${audioForLRC}`);
  console.log(`   Existe: ${existsSync(audioForLRC)}`);

  // Verificar se o arquivo de áudio existe antes de continuar
  if (!existsSync(audioForLRC)) {
    console.error(`❌ Arquivo de áudio não encontrado: ${audioForLRC}`);
    return res.status(404).json({ 
      success: false,
      error: `Arquivo de áudio não encontrado: ${audioForLRC}` 
    });
  }

  // Verificar tamanho do arquivo de áudio final
  const audioStats = fs.statSync(audioForLRC);
  console.log(`📊 Arquivo de áudio final: ${(audioStats.size / 1024).toFixed(2)} KB`);
  
  if (audioStats.size < 1024) { // Menos de 1KB
    console.warn(`⚠️ Arquivo de áudio muito pequeno (${(audioStats.size / 1024).toFixed(2)} KB). A gravação pode ser muito curta.`);
    console.warn(`⚠️ Tentando gerar LRC mesmo assim...`);
  }

  // Verificar se o LRC Generator existe
  const lrcScript = join(PROJECT_ROOT, 'lrc-generator', 'src', 'index.ts');
  const lrcGeneratorDir = join(PROJECT_ROOT, 'lrc-generator');
  const lrcGeneratorEnv = join(lrcGeneratorDir, '.env');
  
  if (!existsSync(lrcScript)) {
    console.error(`❌ Script do LRC Generator não encontrado: ${lrcScript}`);
    return res.status(500).json({ 
      success: false,
      error: 'LRC Generator não encontrado. Verifique a instalação.' 
    });
  }
  
  if (!existsSync(lrcGeneratorEnv)) {
    console.warn(`⚠️ Arquivo .env do LRC Generator não encontrado: ${lrcGeneratorEnv}`);
    console.warn(`⚠️ Certifique-se de que OPENAI_API_KEY está configurada`);
  }
  
  const outputLrcPath = join(recordingsDir, 'recording-lyrics.lrc');
  
  console.log(`📝 Preparando para gerar LRC:`);
  console.log(`   Script: ${lrcScript}`);
  console.log(`   Diretório: ${lrcGeneratorDir}`);
  console.log(`   Áudio: ${audioForLRC}`);
  console.log(`   Saída: ${outputLrcPath}`);

  try {
    // Usar o mesmo padrão do processingController
    const isWindows = process.platform === 'win32';
    
    // Garantir que o output-dir termina com separador para que o LRCGenerator entenda como diretório
    // Normalizar caminho para evitar problemas com barras
    const normalizedRecordingsDir = recordingsDir.replace(/\\/g, '/');
    const outputDirWithSeparator = normalizedRecordingsDir.endsWith('/') 
      ? normalizedRecordingsDir 
      : normalizedRecordingsDir + '/';
    
    // Construir comando de forma mais segura
    // No Windows, usar caminhos com barras normais e garantir espaços entre argumentos
    // Evitar problemas de parsing usando caminhos sem espaços extras
    let command: string;
    if (isWindows) {
      // No Windows, usar formato que funcione melhor com cmd
      // Separar claramente cada argumento
      command = `cd /d "${lrcGeneratorDir}" && npx tsx "${lrcScript}" "${audioForLRC}" --output-dir "${outputDirWithSeparator}" --language pt`;
    } else {
      command = `cd "${lrcGeneratorDir}" && npx tsx "${lrcScript}" "${audioForLRC}" --output-dir "${outputDirWithSeparator}" --language pt`;
    }

    console.log(`📝 Executando comando: ${command}`);
    console.log(`📝 Diretório de trabalho: ${lrcGeneratorDir}`);
    console.log(`📝 Arquivo de áudio: ${audioForLRC}`);
    console.log(`📝 Diretório de saída: ${outputDirWithSeparator}`);
    
    let result;
    try {
      result = await execPython(
        command,
        lrcGeneratorDir,
        `[LRC Generator]`
      );
      console.log(`📝 STDOUT do LRC Generator:`, result.stdout);
      if (result.stderr) {
        console.log(`📝 STDERR do LRC Generator:`, result.stderr);
      }
    } catch (execError: any) {
      console.error(`❌ Erro ao executar LRC Generator:`, execError);
      console.error(`❌ STDOUT:`, execError.stdout || 'N/A');
      console.error(`❌ STDERR:`, execError.stderr || 'N/A');
      throw execError;
    }

    // Aguardar um pouco para garantir que o arquivo foi escrito
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Procurar arquivo LRC gerado
    const fs = await import('fs/promises');
    let files: string[];
    try {
      files = await fs.readdir(recordingsDir);
      console.log(`📁 Todos os arquivos no diretório de gravações:`, files);
    } catch (dirError: any) {
      console.error(`❌ Erro ao listar arquivos do diretório:`, dirError);
      throw new Error(`Não foi possível acessar o diretório de gravações: ${recordingsDir}`);
    }
    
    // Procurar qualquer arquivo .lrc
    const allLrcFiles = files.filter(f => f.toLowerCase().endsWith('.lrc'));
    console.log(`📝 Arquivos .lrc encontrados:`, allLrcFiles);
    
    // O LRCGenerator pode gerar com diferentes nomes dependendo do nome do áudio
    // Procurar por: recording-lyrics.lrc, lyrics.lrc, ou qualquer outro .lrc
    let lrcFile = allLrcFiles.find(f => f === 'recording-lyrics.lrc');
    if (!lrcFile) {
      lrcFile = allLrcFiles.find(f => f === 'lyrics.lrc');
    }
    if (!lrcFile) {
      // Pegar qualquer arquivo .lrc que não seja o que estamos procurando
      lrcFile = allLrcFiles.find(f => f !== 'recording-lyrics.lrc');
    }

    if (lrcFile && lrcFile !== 'recording-lyrics.lrc') {
      console.log(`📝 Arquivo LRC encontrado: ${lrcFile}, renomeando para recording-lyrics.lrc`);
      const generatedLrcPath = join(recordingsDir, lrcFile);
      // Verificar se o arquivo existe antes de renomear
      if (existsSync(generatedLrcPath)) {
        // Se o arquivo de destino já existe, removê-lo primeiro
        if (existsSync(outputLrcPath)) {
          await fs.unlink(outputLrcPath);
        }
        await fs.rename(generatedLrcPath, outputLrcPath);
        console.log(`✅ Arquivo renomeado com sucesso de ${lrcFile} para recording-lyrics.lrc`);
      } else {
        console.warn(`⚠️ Arquivo ${lrcFile} não existe mais`);
      }
    } else if (allLrcFiles.includes('recording-lyrics.lrc')) {
      console.log(`✅ Arquivo recording-lyrics.lrc já existe`);
    } else if (allLrcFiles.length > 0) {
      // Se encontrou algum arquivo LRC mas não é o esperado, usar o primeiro
      const firstLrc = allLrcFiles[0];
      console.log(`📝 Usando arquivo LRC encontrado: ${firstLrc}`);
      const firstLrcPath = join(recordingsDir, firstLrc);
      if (existsSync(firstLrcPath) && firstLrc !== 'recording-lyrics.lrc') {
        if (existsSync(outputLrcPath)) {
          await fs.unlink(outputLrcPath);
        }
        await fs.rename(firstLrcPath, outputLrcPath);
        console.log(`✅ Arquivo renomeado para recording-lyrics.lrc`);
      }
    } else {
      console.warn(`⚠️ Nenhum arquivo LRC encontrado no diretório`);
      console.warn(`⚠️ Verifique se o LRC Generator foi executado corretamente`);
      console.warn(`⚠️ Verifique se a OPENAI_API_KEY está configurada no arquivo .env do lrc-generator`);
      console.warn(`⚠️ Verifique os logs do LRC Generator acima para mais detalhes`);
    }

    // Verificar se o arquivo final existe
    if (!existsSync(outputLrcPath)) {
      console.error(`❌ Arquivo LRC não encontrado em: ${outputLrcPath}`);
      console.error(`❌ Arquivos no diretório:`, files);
      throw new Error(`Arquivo LRC não foi gerado. Verifique os logs acima e certifique-se de que a OPENAI_API_KEY está configurada no arquivo .env do lrc-generator.`);
    }
    
    // Verificar se o arquivo não está vazio
    const fileStats = await fs.stat(outputLrcPath);
    if (fileStats.size === 0) {
      console.warn(`⚠️ Arquivo LRC está vazio`);
    }
    
    console.log(`✅ LRC gerado com sucesso: ${outputLrcPath} (${fileStats.size} bytes)`);

    res.json({
      success: true,
      lrcPath: outputLrcPath,
      message: 'LRC gerado com sucesso',
    });
  } catch (error: any) {
    console.error('Erro ao gerar LRC:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao gerar LRC',
    });
  }
});

/**
 * GET /api/recording/lrc/:songId
 * Get recording LRC content
 */
export const getRecordingLRC = asyncHandler(async (req: Request, res: Response) => {
  const { songId } = req.params;
  const { recordingId } = req.query;

  if (!songId) {
    return res.status(400).json({ error: 'songId é obrigatório' });
  }

  const musicDir = join(PATHS.MUSIC_DIR, songId);
  const recordingsDir = join(musicDir, 'recordings');

  if (!existsSync(recordingsDir)) {
    return res.status(404).json({ error: 'Nenhuma gravação encontrada' });
  }

  // Tentar encontrar o LRC
  let lrcPath: string;

  if (recordingId) {
    lrcPath = join(recordingsDir, `${recordingId}-lyrics.lrc`);
  } else {
    // Buscar o LRC mais recente
    lrcPath = join(recordingsDir, 'recording-lyrics.lrc');
  }

  if (!existsSync(lrcPath)) {
    return res.status(404).json({ error: 'LRC da gravação não encontrado' });
  }

  const lrcContent = readFileSync(lrcPath, 'utf-8');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(lrcContent);
});
