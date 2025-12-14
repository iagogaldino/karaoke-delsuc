import { Request, Response } from 'express';
import { join, extname } from 'path';
import { existsSync, mkdirSync, renameSync, statSync } from 'fs';
import { getSongById, updateSong, getBandById } from '../utils/database.js';
import multer from 'multer';
import { PROJECT_ROOT, PATHS, PROCESSING_CONFIG, MEDIA_CONFIG } from '../config/index.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { processingStatus, processMusic, processYouTubeMusic, execPython } from '../services/processingService.js';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = PATHS.TEMP_DIR;
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.originalname);
  }
});

export const upload = multer({ 
  storage,
  limits: { fileSize: PROCESSING_CONFIG.MAX_FILE_SIZE }
});

/**
 * POST /api/processing/upload
 * Upload audio file
 */
export const uploadFile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    console.log('❌ Upload falhou: Nenhum arquivo enviado');
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }

  const fileId = Date.now().toString() + '-' + Math.round(Math.random() * 1E9);
  const tempPath = req.file.path;
  const originalName = req.file.originalname;
  const fileExtension = originalName.split('.').pop()?.toLowerCase();
  
  console.log(`\n📤 Upload recebido:`);
  console.log(`   📄 Nome: ${originalName}`);
  console.log(`   📏 Tamanho: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   🔖 ID: ${fileId}`);
  console.log(`   📂 Temporário: ${tempPath}`);
  
  // Validate extension
  if (!fileExtension || !MEDIA_CONFIG.ALLOWED_AUDIO_EXTENSIONS.includes(fileExtension)) {
    console.log(`❌ Formato não suportado: ${fileExtension}`);
    // Delete temporary file
    try {
      const fs = await import('fs/promises');
      await fs.unlink(tempPath);
    } catch (err) {
      console.error('Error deleting invalid file:', err);
    }
    return res.status(400).json({ 
      error: `Formato não suportado. Use: ${MEDIA_CONFIG.ALLOWED_AUDIO_EXTENSIONS.join(', ')}` 
    });
  }

  // Extract music name (without extension, clean special characters)
  const musicName = originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '');
  
  // Generate unique ID to avoid conflicts
  const uniqueId = Date.now().toString(36) + '-' + Math.round(Math.random() * 1E9).toString(36);
  const songId = uniqueId;
  
  console.log(`✅ Upload concluído. Nome da música: ${musicName}`);
  console.log(`   🆔 Song ID: ${songId}\n`);
  
  res.json({
    fileId,
    musicName,
    songId,
    fileName: originalName,
    fileSize: req.file.size,
    tempPath
  });
});

/**
 * POST /api/processing/start
 * Start processing a song
 */
export const startProcessing = asyncHandler(async (req: Request, res: Response) => {
  const { fileId, musicName, displayName, tempPath, songId, bandId } = req.body;

  if (!fileId || !musicName || !tempPath || !songId) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  if (!existsSync(tempPath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  }

  const musicDir = join(PROJECT_ROOT, 'music', songId);
  
  // Create music directory
  if (!existsSync(musicDir)) {
    mkdirSync(musicDir, { recursive: true });
  }

  // Initialize status
  processingStatus.set(fileId, {
    status: 'pending',
    step: 'Aguardando...',
    progress: 0
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📥 Nova solicitação de processamento recebida`);
  console.log(`📋 ID: ${fileId}`);
  console.log(`🎵 Música: ${musicName}`);
  console.log(`🎸 Banda: ${bandId || 'Não especificada'}`);
  console.log(`📁 Diretório: ${musicDir}`);
  console.log(`${'='.repeat(60)}\n`);

  // Start processing in background
  processMusic(fileId, tempPath, musicDir, songId, musicName, displayName || musicName, bandId).catch(err => {
    console.error(`[${fileId}] ❌ Erro fatal no processamento:`, err);
    const status = processingStatus.get(fileId);
    if (status) {
      status.status = 'error';
      status.error = err.message;
    }
  });

  res.json({
    fileId,
    message: 'Processamento iniciado',
    statusUrl: `/api/processing/status/${fileId}`
  });
});

/**
 * GET /api/processing/status/:fileId
 * Get processing status
 */
export const getStatus = asyncHandler(async (req: Request, res: Response) => {
  const { fileId } = req.params;
  const status = processingStatus.get(fileId);

  if (!status) {
    return res.status(404).json({ error: 'Status não encontrado' });
  }

  res.json(status);
});

/**
 * POST /api/processing/start-youtube
 * Start processing a song from YouTube URL
 */
export const startYouTubeProcessing = asyncHandler(async (req: Request, res: Response) => {
  const { youtubeUrl, musicName, displayName, bandId } = req.body;

  if (!youtubeUrl || !musicName) {
    return res.status(400).json({ error: 'URL do YouTube e nome da música são obrigatórios' });
  }

  // Validar URL do YouTube
  const youtubePattern = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+$/i;
  if (!youtubePattern.test(youtubeUrl)) {
    return res.status(400).json({ error: 'URL do YouTube inválida' });
  }

  // Gerar IDs únicos
  const fileId = Date.now().toString() + '-' + Math.round(Math.random() * 1E9);
  const uniqueId = Date.now().toString(36) + '-' + Math.round(Math.random() * 1E9).toString(36);
  const songId = uniqueId;

  const musicDir = join(PROJECT_ROOT, 'music', songId);
  
  // Criar diretório da música
  if (!existsSync(musicDir)) {
    mkdirSync(musicDir, { recursive: true });
  }

  // Inicializar status
  processingStatus.set(fileId, {
    status: 'pending',
    step: 'Aguardando...',
    progress: 0
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📥 Nova solicitação de processamento do YouTube`);
  console.log(`📋 ID: ${fileId}`);
  console.log(`🎵 Música: ${musicName}`);
  console.log(`🎸 Banda: ${bandId || 'Não especificada'}`);
  console.log(`🔗 URL: ${youtubeUrl}`);
  console.log(`📁 Diretório: ${musicDir}`);
  console.log(`${'='.repeat(60)}\n`);

  // Iniciar processamento em background
  processYouTubeMusic(fileId, youtubeUrl, musicDir, songId, musicName, displayName || musicName, bandId).catch(err => {
    console.error(`[${fileId}] ❌ Erro fatal no processamento do YouTube:`, err);
    const status = processingStatus.get(fileId);
    if (status) {
      status.status = 'error';
      status.error = err.message;
    }
  });

  res.json({
    fileId,
    message: 'Processamento do YouTube iniciado',
    statusUrl: `/api/processing/status/${fileId}`
  });
});

/**
 * POST /api/processing/download-video/:songId
 * Process video separately for a song
 */
export const downloadVideo = asyncHandler(async (req: Request, res: Response) => {
  const { songId } = req.params;
  const song = getSongById(songId);
  
  if (!song) {
    return res.status(404).json({ error: 'Música não encontrada' });
  }

  const musicDir = join(PROJECT_ROOT, 'music', songId);
  const processId = `video-${songId}-${Date.now()}`;

  // Create processing status
  processingStatus.set(processId, {
    status: 'processing',
    step: 'Iniciando download de vídeo...',
    progress: 0
  });

  // Start processing in background
  downloadVideoForSong(processId, song, musicDir).catch(err => {
    console.error(`[${processId}] ❌ Erro fatal no download de vídeo:`, err);
    const status = processingStatus.get(processId);
    if (status) {
      status.status = 'error';
      status.error = err.message;
    }
  });

  res.json({
    processId,
    message: 'Processamento de vídeo iniciado',
    statusUrl: `/api/processing/status/${processId}`
  });
});

/**
 * Download video for a specific song
 */
async function downloadVideoForSong(
  processId: string,
  song: any,
  musicDir: string
) {
  const status = processingStatus.get(processId);
  if (!status) return;

  try {
    status.step = 'Identificando música pelas letras...';
    status.progress = 10;

    // Check if song has lyrics to identify it
    if (!song.files?.lyrics) {
      throw new Error('Música precisa ter letras para identificar e buscar vídeo');
    }

    const lyricsPath = join(musicDir, song.files.lyrics);
    if (!existsSync(lyricsPath)) {
      throw new Error('Arquivo de letras não encontrado');
    }

    // Use song name with "Clip" to search for music videos
    const baseQuery = song.displayName || song.name;
    
    if (!baseQuery || baseQuery.trim().length === 0) {
      throw new Error('Não foi possível identificar a música para buscar o vídeo');
    }

    const searchQuery = `Clip ${baseQuery}`;

    console.log(`[${processId}] 🔍 Buscando vídeo para: "${searchQuery}"`);

    // Check if yt-dlp is available
    status.step = 'Verificando yt-dlp...';
    status.progress = 20;

    try {
      await execPython(
        'python -c "import yt_dlp; print(\'OK\')"',
        undefined,
        `${processId} [yt-dlp check]`
      );
    } catch (error: any) {
      throw new Error('yt-dlp não está instalado. Instale com: pip install yt-dlp');
    }

    // Use YouTube download script
    const downloadScript = join(PROJECT_ROOT, 'youtube-downloader', 'download_video.py');
    
    if (!existsSync(downloadScript)) {
      throw new Error('Script de download do YouTube não encontrado. Verifique se o arquivo youtube-downloader/download_video.py existe.');
    }

    status.step = 'Baixando vídeo do YouTube...';
    status.progress = 30;

    // Execute download
    const videoResult = await execPython(
      `python "${downloadScript}" "${searchQuery}" "${musicDir}"`,
      undefined,
      `${processId} [YouTube Download]`,
      (progress: number, message?: string) => {
        const stepProgress = 30 + (progress * 0.6);
        status.progress = Math.round(stepProgress);
        if (message) {
          status.step = `Baixando vídeo... ${progress}%`;
        }
      }
    );

    // Check if video was downloaded
    const videoPath = join(musicDir, 'video.mp4');
    if (!existsSync(videoPath)) {
      // Try other formats
      const possibleFormats = ['video.mkv', 'video.webm', 'video.avi'];
      let foundVideo = false;
      
      for (const format of possibleFormats) {
        const testPath = join(musicDir, format);
        if (existsSync(testPath)) {
          // Rename to mp4 if necessary
          if (format !== 'video.mp4') {
            renameSync(testPath, videoPath);
          }
          foundVideo = true;
          break;
        }
      }
      
      if (!foundVideo) {
        throw new Error('Vídeo não foi baixado corretamente');
      }
    }

    status.step = 'Salvando informações do vídeo...';
    status.progress = 95;

    // Extract video information from output
    let videoInfo: any = null;
    try {
      const outputLines = videoResult.stdout.split('\n');
      const jsonStart = outputLines.findIndex(line => line.trim().startsWith('{'));
      if (jsonStart !== -1) {
        const jsonLines = outputLines.slice(jsonStart);
        const jsonStr = jsonLines.join('\n').trim();
        videoInfo = JSON.parse(jsonStr);
      }
    } catch (err) {
      console.warn(`[${processId}] ⚠️  Não foi possível extrair informações do vídeo do output`);
    }

    // Update database
    const updatedSong = getSongById(song.id);
    if (updatedSong) {
      const updatedFiles = { ...updatedSong.files, video: 'video.mp4' };
      updateSong(song.id, {
        ...updatedSong,
        files: updatedFiles,
        video: videoInfo ? {
          ...videoInfo,
          file: 'video.mp4'
        } : undefined
      });
    }

    status.status = 'completed';
    status.songId = song.id;
    status.step = 'Download de vídeo concluído!';
    status.progress = 100;

    console.log(`[${processId}] ✅ Vídeo baixado com sucesso!`);
    
    // Clean up status after 1 hour
    setTimeout(() => {
      processingStatus.delete(processId);
      console.log(`[${processId}] 🧹 Status de download de vídeo removido (limpeza automática)`);
    }, PROCESSING_CONFIG.STATUS_CLEANUP_TIME);

  } catch (error: any) {
    status.status = 'error';
    status.error = error.message;
    status.step = 'Erro no download de vídeo';
    
    console.error(`\n${'='.repeat(60)}`);
    console.error(`[${processId}] ❌ ERRO durante o download de vídeo:`);
    console.error(`[${processId}] 📝 Mensagem: ${error.message}`);
    if (error.stack) {
      console.error(`[${processId}] 📚 Stack trace:`, error.stack);
    }
    console.error(`${'='.repeat(60)}\n`);
    
    // Clean up status after 1 hour even on error
    setTimeout(() => {
      processingStatus.delete(processId);
      console.log(`[${processId}] 🧹 Status de download de vídeo removido (limpeza automática)`);
    }, PROCESSING_CONFIG.STATUS_CLEANUP_TIME);
  }
}

/**
 * POST /api/processing/generate-lrc/:songId
 * Generate LRC lyrics for an existing song
 */
export const generateLRC = asyncHandler(async (req: Request, res: Response) => {
  const { songId } = req.params;
  const song = getSongById(songId);
  
  if (!song) {
    return res.status(404).json({ error: 'Música não encontrada' });
  }

  const musicDir = join(PROJECT_ROOT, 'music', songId);
  const processId = `lrc-${songId}-${Date.now()}`;

  // Create processing status
  processingStatus.set(processId, {
    status: 'processing',
    step: 'Iniciando geração de LRC...',
    progress: 0
  });

  // Start processing in background
  generateLRCForSong(processId, song, musicDir).catch(err => {
    console.error(`[${processId}] ❌ Erro fatal na geração de LRC:`, err);
    const status = processingStatus.get(processId);
    if (status) {
      status.status = 'error';
      status.error = err.message;
    }
  });

  res.json({
    processId,
    message: 'Geração de LRC iniciada',
    statusUrl: `/api/processing/status/${processId}`
  });
});

/**
 * Generate LRC for a specific song
 */
async function generateLRCForSong(
  processId: string,
  song: any,
  musicDir: string
) {
  const status = processingStatus.get(processId);
  if (!status) return;

  try {
    status.step = 'Localizando arquivo de vocais...';
    status.progress = 10;

    // Usar apenas vocals.wav (voz isolada do vocalista)
    const vocalsPath = join(musicDir, 'vocals.wav');

    if (!existsSync(vocalsPath)) {
      throw new Error('Arquivo vocals.wav não encontrado. É necessário processar a música primeiro para extrair os vocais.');
    }

    const audioPath = vocalsPath;
    console.log(`[${processId}] ✅ Usando arquivo de vocais isolados: ${audioPath}`);

    status.step = 'Verificando tamanho do arquivo...';
    status.progress = 20;

    // Verificar tamanho do arquivo
    const audioFileSize = statSync(audioPath).size;
    const maxSize = 25 * 1024 * 1024; // 25 MB (limite da API OpenAI)
    
    let audioForLRC = audioPath;
    
    // Se o arquivo for muito grande, converter para MP3
    if (audioFileSize > maxSize) {
      console.log(`[${processId}] ⚠️  Arquivo muito grande (${(audioFileSize / 1024 / 1024).toFixed(2)} MB), convertendo para MP3...`);
      
      status.step = 'Convertendo áudio para MP3...';
      status.progress = 25;
      
      const mp3Path = join(musicDir, 'temp_audio_lrc.mp3');
      const convertScript = join(PROJECT_ROOT, 'youtube-downloader', 'convert_audio_to_mp3.py');
      
      if (existsSync(convertScript)) {
        try {
          await execPython(
            `python "${convertScript}" "${audioPath}" "${mp3Path}" "128k" "22050" "1"`,
            undefined,
            `${processId} [Convert to MP3]`
          );
          
          if (existsSync(mp3Path)) {
            const mp3Size = statSync(mp3Path).size;
            if (mp3Size > maxSize) {
              // Tentar versão ainda menor
              const smallerMp3Path = join(musicDir, 'temp_audio_lrc_small.mp3');
              await execPython(
                `python "${convertScript}" "${audioPath}" "${smallerMp3Path}" "96k" "16000" "1"`,
                undefined,
                `${processId} [Convert to Small MP3]`
              );
              
              if (existsSync(smallerMp3Path)) {
                audioForLRC = smallerMp3Path;
              } else {
                audioForLRC = mp3Path;
              }
            } else {
              audioForLRC = mp3Path;
            }
            console.log(`[${processId}] ✅ Áudio convertido para MP3`);
          }
        } catch (convertError: any) {
          console.warn(`[${processId}] ⚠️  Erro ao converter: ${convertError.message}`);
        }
      }
    }

    status.step = 'Gerando letras LRC...';
    status.progress = 30;

    const lyricsPath = join(musicDir, 'lyrics.lrc');
    const lrcScript = join(PROJECT_ROOT, 'lrc-generator', 'src', 'index.ts');
    
    // Criar prompt contextual com o nome da música e da banda para melhorar a transcrição
    const songName = song.displayName || song.name || '';
    let bandName = '';
    
    // Buscar nome da banda se a música tiver uma banda associada
    if (song.band) {
      const band = getBandById(song.band);
      if (band) {
        bandName = band.name;
      }
    }
    
    // Construir prompt contextual em inglês para não influenciar a detecção de idioma
    // O prompt em inglês ajuda o Whisper a detectar corretamente o idioma original da música
    let contextualPrompt = '';
    if (bandName && songName) {
      contextualPrompt = `This is the song ${songName} by ${bandName}. Transcribe the lyrics exactly as they are being sung, preserving the original language.`;
    } else if (songName) {
      contextualPrompt = `This is the song ${songName}. Transcribe the lyrics exactly as they are being sung, preserving the original language.`;
    } else if (bandName) {
      contextualPrompt = `This is a song by ${bandName}. Transcribe the lyrics exactly as they are being sung, preserving the original language.`;
    } else {
      contextualPrompt = 'Transcribe the lyrics exactly as they are being sung, preserving the original language.';
    }
    
    // Escapar aspas e caracteres especiais no prompt para evitar problemas na linha de comando
    // Usar aspas simples no Windows para evitar problemas de escape
    const escapedPrompt = contextualPrompt.replace(/"/g, "'").replace(/\$/g, '\\$');
    
    await execPython(
      `cd "${join(PROJECT_ROOT, 'lrc-generator')}" && npx tsx "${lrcScript}" "${audioForLRC}" --output-dir "${musicDir}" --prompt "${escapedPrompt}"`, 
      join(PROJECT_ROOT, 'lrc-generator'), 
      `${processId} [LRC Generator]`,
      (progress: number) => {
        const stepProgress = 30 + (progress * 0.6);
        status.progress = Math.round(stepProgress);
        status.step = `Gerando letras... ${progress}%`;
      }
    );

    // Procurar arquivo de letras gerado
    const fs = await import('fs/promises');
    let foundLyricsFile: string | null = null;
    
    try {
      const files = await fs.readdir(musicDir);
      const lrcFile = files.find((f: string) => f.toLowerCase().endsWith('.lrc'));
      
      if (lrcFile) {
        foundLyricsFile = join(musicDir, lrcFile);
        if (lrcFile !== 'lyrics.lrc') {
          console.log(`[${processId}] 📝 Renomeando: ${lrcFile} -> lyrics.lrc`);
          await fs.rename(foundLyricsFile, lyricsPath);
          foundLyricsFile = lyricsPath;
        }
      }
    } catch (err) {
      console.error(`[${processId}] ⚠️  Erro ao procurar arquivo de letras:`, err);
    }

    if (!foundLyricsFile || !existsSync(lyricsPath)) {
      throw new Error('Arquivo de letras não foi gerado');
    }

    status.step = 'Atualizando banco de dados...';
    status.progress = 95;

    // Atualizar banco de dados
    const updatedSong = getSongById(song.id);
    if (updatedSong) {
      const updatedFiles = { ...updatedSong.files, lyrics: 'lyrics.lrc' };
      updateSong(song.id, {
        ...updatedSong,
        files: updatedFiles,
        metadata: {
          ...updatedSong.metadata,
          lastProcessed: new Date().toISOString()
        }
      });
      console.log(`[${processId}] ✅ Banco de dados atualizado`);
    }

    // Limpar arquivos temporários
    try {
      const tempMp3Files = ['temp_audio_lrc.mp3', 'temp_audio_lrc_small.mp3'];
      for (const tempFile of tempMp3Files) {
        const tempPath = join(musicDir, tempFile);
        if (existsSync(tempPath)) {
          await fs.unlink(tempPath);
        }
      }
    } catch (cleanupError) {
      // Ignorar erros de limpeza
    }

    status.status = 'completed';
    status.songId = song.id;
    status.step = 'LRC gerado com sucesso!';
    status.progress = 100;

    console.log(`[${processId}] ✅ LRC gerado com sucesso!`);
    
    // Clean up status after 1 hour
    setTimeout(() => {
      processingStatus.delete(processId);
      console.log(`[${processId}] 🧹 Status de geração de LRC removido (limpeza automática)`);
    }, PROCESSING_CONFIG.STATUS_CLEANUP_TIME);

  } catch (error: any) {
    status.status = 'error';
    status.error = error.message;
    status.step = 'Erro na geração de LRC';
    
    console.error(`\n${'='.repeat(60)}`);
    console.error(`[${processId}] ❌ ERRO durante a geração de LRC:`);
    console.error(`[${processId}] 📝 Mensagem: ${error.message}`);
    if (error.stack) {
      console.error(`[${processId}] 📚 Stack trace:`, error.stack);
    }
    console.error(`${'='.repeat(60)}\n`);
    
    // Clean up status after 1 hour even on error
    setTimeout(() => {
      processingStatus.delete(processId);
      console.log(`[${processId}] 🧹 Status de geração de LRC removido (limpeza automática)`);
    }, PROCESSING_CONFIG.STATUS_CLEANUP_TIME);
  }
}
