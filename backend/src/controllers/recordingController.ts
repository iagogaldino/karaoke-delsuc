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

  // Criar diretório de gravações para esta música (fora de music/)
  const recordingsDir = join(PATHS.RECORDINGS_DIR, songId);
  
  if (!existsSync(recordingsDir)) {
    mkdirSync(recordingsDir, { recursive: true });
    console.log(`📁 Diretório de gravações criado: ${recordingsDir}`);
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

  // Diretório de gravações - FORA da pasta music
  const recordingsDir = join(PATHS.RECORDINGS_DIR, songId);

  if (!existsSync(recordingsDir)) {
    return res.status(404).json({ error: 'Nenhuma gravação encontrada para esta música' });
  }

  // Criar diretório de gravações se não existir
  if (!existsSync(recordingsDir)) {
    mkdirSync(recordingsDir, { recursive: true });
    console.log(`📁 Diretório de gravações criado: ${recordingsDir}`);
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
  console.log(`📊 Duração estimada (assumindo 128kbps): ${((audioStats.size * 8) / 128000).toFixed(2)} segundos`);
  
  if (audioStats.size < 1024) { // Menos de 1KB
    console.warn(`⚠️ Arquivo de áudio muito pequeno (${(audioStats.size / 1024).toFixed(2)} KB). A gravação pode ser muito curta.`);
    console.warn(`⚠️ Tentando gerar LRC mesmo assim...`);
  }
  
  // IMPORTANTE: Log de aviso sobre possível captura de música de fundo
  console.log(`⚠️ AVISO: Se o LRC contiver texto que não foi falado, pode ser que:`);
  console.log(`   1. O microfone esteja capturando música das caixas de som (feedback acústico)`);
  console.log(`   2. O sistema de áudio esteja capturando áudio do sistema em vez de apenas o microfone`);
  console.log(`   3. Há música de fundo sendo capturada junto com a voz`);
  console.log(`   Solução: Use fones de ouvido em vez de caixas de som para evitar feedback acústico`);

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
  
  // Salvar LRC de pontuação no diretório recordings/
  // IMPORTANTE: Sempre usar o mesmo nome para substituir o arquivo anterior
  const outputLrcPath = join(recordingsDir, 'recording-lyrics.lrc');
  
  // Remover arquivo LRC antigo se existir (para garantir substituição)
  if (existsSync(outputLrcPath)) {
    console.log(`🗑️ Removendo LRC antigo: ${outputLrcPath}`);
    try {
      const fs = await import('fs/promises');
      await fs.unlink(outputLrcPath);
      console.log(`✅ LRC antigo removido`);
    } catch (err) {
      console.warn(`⚠️ Erro ao remover LRC antigo:`, err);
    }
  }
  
  // Também remover lyrics.lrc se existir (pode ser um arquivo antigo)
  const oldLyricsPath = join(recordingsDir, 'lyrics.lrc');
  if (existsSync(oldLyricsPath)) {
    console.log(`🗑️ Removendo lyrics.lrc antigo: ${oldLyricsPath}`);
    try {
      const fs = await import('fs/promises');
      await fs.unlink(oldLyricsPath);
      console.log(`✅ lyrics.lrc antigo removido`);
    } catch (err) {
      console.warn(`⚠️ Erro ao remover lyrics.lrc antigo:`, err);
    }
  }
  
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
    // Usar o diretório de gravações
    const normalizedRecordingsDir = recordingsDir.replace(/\\/g, '/');
    const outputDirWithSeparator = normalizedRecordingsDir.endsWith('/') 
      ? normalizedRecordingsDir 
      : normalizedRecordingsDir + '/';
    
    // Construir comando de forma mais segura
    // No Windows, usar caminhos com barras normais e garantir espaços entre argumentos
    // Evitar problemas de parsing usando caminhos sem espaços extras
    // Adicionar prompt para focar apenas na voz do usuário e ignorar música de fundo
    // O prompt ajuda o Whisper a focar na voz do usuário e ignorar a música de fundo
    // Este é um áudio de karaokê onde há música de fundo e uma pessoa cantando
    // O Whisper deve transcrever APENAS o que a pessoa está cantando, não a música original
    // Prompt mais direto e específico para evitar transcrições incorretas
    // IMPORTANTE: Prompt deve ser curto e sem instruções que possam ser transcritas
    // O Whisper pode confundir o prompt com texto a ser transcrito se for muito explícito
    // Usar apenas contexto simples sobre o tipo de áudio
    const prompt = "Karaoke: apenas voz do cantor";
    
    console.log(`📝 Prompt que será usado: ${prompt}`);
    
    let command: string;
    if (isWindows) {
      // No Windows, usar formato que funcione melhor com cmd
      // Separar claramente cada argumento
      // No Windows cmd, precisamos escapar aspas de forma diferente
      // Vamos usar uma abordagem mais segura: passar o prompt sem aspas e deixar o parser lidar
      const escapedPrompt = prompt.replace(/"/g, '\\"'); // Escapar para PowerShell/cmd
      command = `cd /d "${lrcGeneratorDir}" && npx tsx "${lrcScript}" "${audioForLRC}" --output-dir "${outputDirWithSeparator}" --language pt --prompt "${escapedPrompt}"`;
    } else {
      // Escapar aspas do prompt corretamente para Unix/Linux
      const escapedPrompt = prompt.replace(/"/g, '\\"');
      command = `cd "${lrcGeneratorDir}" && npx tsx "${lrcScript}" "${audioForLRC}" --output-dir "${outputDirWithSeparator}" --language pt --prompt "${escapedPrompt}"`;
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
      
      // Retornar erro detalhado ao invés de lançar exceção
      const errorMessage = execError.stderr || execError.message || 'Erro desconhecido ao executar LRC Generator';
      return res.status(500).json({ 
        success: false,
        error: `Falha ao executar LRC Generator: ${errorMessage}`,
        details: {
          stdout: execError.stdout || null,
          stderr: execError.stderr || null,
          command: command
        }
      });
    }

    // Aguardar o arquivo LRC ser criado (polling)
    console.log(`⏳ Aguardando arquivo LRC ser criado...`);
    const fs = await import('fs/promises');
    const maxWaitTime = 60000; // 60 segundos máximo
    const checkInterval = 500; // Verificar a cada 500ms
    const startTime = Date.now();
    let lrcFile: string | null = null;
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const files = await fs.readdir(recordingsDir);
        
        // Procurar qualquer arquivo .lrc
        const allLrcFiles = files.filter(f => f.toLowerCase().endsWith('.lrc'));
        
        if (allLrcFiles.length > 0) {
          // O LRCGenerator pode gerar com diferentes nomes dependendo do nome do áudio
          // Procurar por: recording-lyrics.lrc, lyrics.lrc, ou qualquer outro .lrc
          // IMPORTANTE: Priorizar recording-lyrics.lrc, mas aceitar lyrics.lrc também
          lrcFile = allLrcFiles.find(f => f === 'recording-lyrics.lrc') || null;
          if (!lrcFile) {
            lrcFile = allLrcFiles.find(f => f === 'lyrics.lrc') || null;
          }
          if (!lrcFile && allLrcFiles.length > 0) {
            // Pegar o arquivo .lrc mais recente (por timestamp no nome ou data de modificação)
            lrcFile = allLrcFiles[0];
          }
          
          if (lrcFile) {
            console.log(`✅ Arquivo LRC encontrado: ${lrcFile}`);
            break;
          }
        }
      } catch (dirError: any) {
        console.warn(`⚠️ Erro ao listar arquivos do diretório (tentativa):`, dirError.message);
      }
      
      // Aguardar antes da próxima verificação
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    if (!lrcFile) {
      console.error(`❌ Arquivo LRC não foi criado após ${maxWaitTime / 1000}s de espera`);
      return res.status(500).json({ 
        success: false,
        error: 'LRC não foi gerado dentro do tempo esperado. Verifique os logs do LRC Generator acima e certifique-se de que a OPENAI_API_KEY está configurada no arquivo .env do lrc-generator.' 
      });
    }

    // Se encontrou um arquivo LRC, garantir que está com o nome correto
    const generatedLrcPath = join(recordingsDir, lrcFile);
    
    if (lrcFile !== 'recording-lyrics.lrc') {
      console.log(`📝 Arquivo LRC encontrado: ${lrcFile}, renomeando para recording-lyrics.lrc`);
      // Verificar se o arquivo existe antes de renomear
      if (existsSync(generatedLrcPath)) {
        // Se o arquivo de destino já existe, removê-lo primeiro
        if (existsSync(outputLrcPath)) {
          await fs.unlink(outputLrcPath);
          console.log(`🗑️ Arquivo recording-lyrics.lrc antigo removido`);
        }
        await fs.rename(generatedLrcPath, outputLrcPath);
        console.log(`✅ Arquivo renomeado com sucesso de ${lrcFile} para recording-lyrics.lrc`);
      } else {
        console.warn(`⚠️ Arquivo ${lrcFile} não existe mais`);
      }
    } else {
      console.log(`✅ Arquivo recording-lyrics.lrc já existe e está atualizado`);
    }
    
    // Verificar se o arquivo final existe antes de retornar sucesso
    if (!existsSync(outputLrcPath)) {
      console.error(`❌ Arquivo LRC final não existe: ${outputLrcPath}`);
      return res.status(500).json({ 
        success: false,
        error: 'Arquivo LRC não foi criado corretamente' 
      });
    }

    console.log(`✅ Arquivo LRC confirmado e pronto em: ${outputLrcPath}`);
    
    // Aguardar um pouco extra para garantir que o arquivo está totalmente escrito
    await new Promise(resolve => setTimeout(resolve, 500));
    
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

  // Diretório de gravações - FORA da pasta music
  const recordingsDir = join(PATHS.RECORDINGS_DIR, songId);

  if (!existsSync(recordingsDir)) {
    return res.status(404).json({ error: 'LRC de pontuação não encontrado' });
  }

  // Tentar encontrar o LRC no diretório de gravações
  let lrcPath: string;

  // IMPORTANTE: O generateLRC sempre salva como 'recording-lyrics.lrc', 
  // então procuramos primeiro por esse arquivo, independente do recordingId
  lrcPath = join(recordingsDir, 'recording-lyrics.lrc');
  
  // Se não existir, tentar com o nome específico do recordingId (compatibilidade com versões antigas)
  if (!existsSync(lrcPath) && recordingId) {
    lrcPath = join(recordingsDir, `${recordingId}-lyrics.lrc`);
    
    // Se ainda não existir, verificar no diretório antigo (compatibilidade)
    if (!existsSync(lrcPath)) {
      const oldMusicDir = join(PATHS.MUSIC_DIR, songId);
      const oldRecordingsDir = join(oldMusicDir, 'recordings');
      const oldLrcPath = join(oldRecordingsDir, `${recordingId}-lyrics.lrc`);
      if (existsSync(oldLrcPath)) {
        lrcPath = oldLrcPath;
      }
      // Também verificar no diretório scoring antigo (compatibilidade)
      if (!existsSync(lrcPath)) {
        const oldScoringDir = join(PATHS.SCORING_DIR, songId);
        const oldScoringLrcPath = join(oldScoringDir, `${recordingId}-lyrics.lrc`);
        if (existsSync(oldScoringLrcPath)) {
          lrcPath = oldScoringLrcPath;
        }
      }
    }
  }
  
  // Se ainda não encontrou e não tinha recordingId, verificar no diretório scoring antigo (compatibilidade)
  if (!existsSync(lrcPath) && !recordingId) {
    const oldScoringDir = join(PATHS.SCORING_DIR, songId);
    const oldScoringLrcPath = join(oldScoringDir, 'recording-lyrics.lrc');
    if (existsSync(oldScoringLrcPath)) {
      lrcPath = oldScoringLrcPath;
    }
  }

  if (!existsSync(lrcPath)) {
    return res.status(404).json({ error: 'LRC da gravação não encontrado' });
  }

  // Adicionar cache-busting para garantir que sempre pega a versão mais recente
  const lrcContent = readFileSync(lrcPath, 'utf-8');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.send(lrcContent);
});
