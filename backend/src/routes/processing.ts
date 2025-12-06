import { Router, Request, Response } from 'express';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, renameSync, statSync } from 'fs';
import { addSong, getSongById, updateSong } from '../utils/database.js';
import multer from 'multer';

// Função para executar comandos Python com encoding UTF-8 e logging em tempo real
const execAsync = promisify(exec);
const execPython = async (
  command: string, 
  cwd?: string, 
  logPrefix?: string,
  onProgress?: (progress: number, message?: string) => void
): Promise<{ stdout: string; stderr: string }> => {
  return new Promise((resolve, reject) => {
    // Configurar encoding UTF-8 para Windows
    const env = { ...process.env };
    env.PYTHONIOENCODING = 'utf-8';
    env.PYTHONUTF8 = '1';
    
    const prefix = logPrefix ? `[${logPrefix}] ` : '';
    console.log(`${prefix}🚀 Executando: ${command}`);
    
    // Parse do comando para usar com spawn
    const isWindows = process.platform === 'win32';
    let cmd: string;
    let args: string[];
    let useShell = false;
    
    if (isWindows) {
      // No Windows, usar cmd /c para executar comandos complexos
      if (command.includes('&&') || command.includes('cd')) {
        cmd = 'cmd';
        args = ['/c', command];
        useShell = true;
      } else {
        // Comando simples Python - melhorar parsing para suportar mais argumentos
        // Padrão: python "script.py" "arg1" "arg2" --flag "arg3"
        const pythonMatch = command.match(/python\s+"([^"]+)"\s*(.+)?/);
        if (pythonMatch) {
          cmd = 'python';
          const scriptPath = pythonMatch[1];
          const restOfCommand = pythonMatch[2] || '';
          // Parsear argumentos: suporta strings entre aspas e flags
          const argsList: string[] = [];
          const regex = /"([^"]+)"|--?\w+(?:="[^"]+")?|(\S+)/g;
          let match;
          while ((match = regex.exec(restOfCommand)) !== null) {
            if (match[1]) {
              // String entre aspas
              argsList.push(match[1]);
            } else if (match[2]) {
              // Argumento sem aspas
              argsList.push(match[2]);
            } else if (match[0].startsWith('--')) {
              // Flag
              const flagMatch = match[0].match(/^--?\w+(?:="([^"]+)")?$/);
              if (flagMatch) {
                argsList.push(flagMatch[0].split('=')[0]);
                if (flagMatch[1]) {
                  argsList.push(flagMatch[1]);
                }
              } else {
                argsList.push(match[0]);
              }
            }
          }
          args = [scriptPath, ...argsList];
        } else {
          // Fallback para exec
          return execAsync(command, {
            encoding: 'utf8',
            maxBuffer: 1024 * 1024 * 100,
            env,
            cwd
          }).then(resolve).catch(reject);
        }
      }
    } else {
      // Unix/Linux
      cmd = 'sh';
      args = ['-c', command];
      useShell = true;
    }
    
    const child = spawn(cmd, args, {
      env,
      cwd: cwd || process.cwd(),
      shell: useShell,
      windowsHide: true
    });
    
    let stdout = '';
    let stderr = '';
    
    // Função para parsear progresso de barras de progresso (tqdm, etc)
    const parseProgress = (line: string): number | null => {
      // Padrões comuns de progresso:
      // "50%|███████████████████████████████████                                     | 5.85/11.7 [00:04<00:04,  1.28seconds/s]"
      // "77%|███████████████████████████████████▎          | 251.55/327.60 [01:52<00:32,  2.33seconds/s]"
      const percentMatch = line.match(/(\d+)%/);
      if (percentMatch) {
        return parseInt(percentMatch[1], 10);
      }
      return null;
    };
    
    // Capturar stdout em tempo real
    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString('utf8');
      stdout += text;
      // Logar cada linha em tempo real
      text.split('\n').forEach((line: string) => {
        if (line.trim()) {
          console.log(`${prefix}📤 ${line.trim()}`);
          // Tentar parsear progresso do stdout também
          if (onProgress) {
            const progress = parseProgress(line);
            if (progress !== null) {
              onProgress(progress);
            }
          }
        }
      });
    });
    
    // Capturar stderr em tempo real (demucs geralmente mostra progresso no stderr)
    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString('utf8');
      stderr += text;
      // Logar cada linha em tempo real
      text.split('\n').forEach((line: string) => {
        if (line.trim()) {
          console.log(`${prefix}⚠️  ${line.trim()}`);
          // Parsear progresso de barras de progresso (tqdm)
          if (onProgress) {
            const progress = parseProgress(line);
            if (progress !== null) {
              onProgress(progress, line.trim());
            }
          }
        }
      });
    });
    
    // Quando o processo terminar
    child.on('close', (code: number | null) => {
      if (code === 0) {
        console.log(`${prefix}✅ Comando executado com sucesso (código: ${code})`);
        if (onProgress) {
          onProgress(100); // Marcar como 100% ao finalizar
        }
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`Comando falhou com código ${code}`);
        (error as any).stdout = stdout;
        (error as any).stderr = stderr;
        (error as any).code = code;
        console.error(`${prefix}❌ Comando falhou (código: ${code})`);
        reject(error);
      }
    });
    
    // Tratamento de erros
    child.on('error', (error: Error) => {
      console.error(`${prefix}❌ Erro ao executar comando:`, error.message);
      reject(error);
    });
  });
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

// Configurar multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = join(PROJECT_ROOT, 'temp');
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

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB max
});

const router = Router();

/**
 * Função auxiliar para atualizar progresso no banco de dados
 */
async function updateProcessingProgress(
  songId: string,
  progress: { vocals?: boolean; instrumental?: boolean; waveform?: boolean; lyrics?: boolean }
) {
  try {
    const song = await getSongById(songId);
    if (song) {
      // Atualizar status dos arquivos processados
      const updatedFiles = { ...song.files };
      if (progress.vocals !== undefined) {
        updatedFiles.vocals = progress.vocals ? 'vocals.wav' : '';
      }
      if (progress.instrumental !== undefined) {
        updatedFiles.instrumental = progress.instrumental ? 'instrumental.wav' : '';
      }
      if (progress.waveform !== undefined) {
        updatedFiles.waveform = progress.waveform ? 'waveform.json' : '';
      }
      if (progress.lyrics !== undefined) {
        updatedFiles.lyrics = progress.lyrics ? 'lyrics.lrc' : '';
      }
      
      await updateSong(songId, {
        ...song,
        files: updatedFiles,
        metadata: {
          ...song.metadata,
          lastProcessed: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    console.error(`Erro ao atualizar progresso no banco de dados:`, error);
  }
}

// Armazenar status de processamento
const processingStatus = new Map<string, {
  status: 'pending' | 'processing' | 'completed' | 'error';
  step: string;
  progress: number;
  error?: string;
  songId?: string;
}>();

/**
 * POST /api/processing/upload
 * Upload do arquivo de áudio
 */
router.post('/upload', upload.single('audio'), async (req, res) => {
  try {
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
    
    // Validar extensão
    const allowedExtensions = ['mp3', 'wav', 'm4a', 'flac', 'ogg'];
    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      console.log(`❌ Formato não suportado: ${fileExtension}`);
      // Deletar arquivo temporário
      try {
        const fs = await import('fs/promises');
        await fs.unlink(tempPath);
      } catch (err) {
        console.error('Error deleting invalid file:', err);
      }
      return res.status(400).json({ 
        error: 'Formato não suportado. Use: mp3, wav, m4a, flac, ogg' 
      });
    }

    // Extrair nome da música (sem extensão, limpar caracteres especiais)
    const musicName = originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '');
    
    // Gerar ID único para evitar conflitos (apenas ID, sem nome)
    const uniqueId = Date.now().toString(36) + '-' + Math.round(Math.random() * 1E9).toString(36);
    const songId = uniqueId; // Apenas o ID, sem o nome
    
    console.log(`✅ Upload concluído. Nome da música: ${musicName}`);
    console.log(`   🆔 Song ID: ${songId}\n`);
    
    res.json({
      fileId,
      musicName,
      songId, // Incluir songId na resposta
      fileName: originalName,
      fileSize: req.file.size,
      tempPath
    });
  } catch (error: any) {
    console.error('❌ Erro ao fazer upload:', error);
    res.status(500).json({ error: 'Erro ao fazer upload do arquivo', message: error.message });
  }
});

/**
 * POST /api/processing/start
 * Inicia o processamento de uma música
 */
router.post('/start', async (req, res) => {
  try {
    const { fileId, musicName, tempPath, songId } = req.body;

    if (!fileId || !musicName || !tempPath || !songId) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    if (!existsSync(tempPath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    // Usar songId fornecido (já inclui nome + ID único)
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
    console.log(`📥 Nova solicitação de processamento recebida`);
    console.log(`📋 ID: ${fileId}`);
    console.log(`🎵 Música: ${musicName}`);
    console.log(`📁 Diretório: ${musicDir}`);
    console.log(`${'='.repeat(60)}\n`);

    // Iniciar processamento em background
    processMusic(fileId, tempPath, musicDir, songId, musicName).catch(err => {
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
  } catch (error: any) {
    console.error('Error starting processing:', error);
    res.status(500).json({ error: 'Erro ao iniciar processamento', message: error.message });
  }
});

/**
 * GET /api/processing/status/:fileId
 * Retorna o status do processamento
 */
router.get('/status/:fileId', (req, res) => {
  const { fileId } = req.params;
  const status = processingStatus.get(fileId);

  if (!status) {
    return res.status(404).json({ error: 'Status não encontrado' });
  }

  res.json(status);
});

/**
 * Função para processar a música
 */
async function processMusic(
  fileId: string,
  tempPath: string,
  musicDir: string,
  songId: string,
  musicName: string
) {
  const status = processingStatus.get(fileId);
  if (!status) return;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎵 Iniciando processamento da música: ${musicName}`);
  console.log(`📁 ID: ${fileId}`);
  console.log(`📂 Diretório: ${musicDir}`);
  console.log(`📄 Arquivo temporário: ${tempPath}`);
  console.log(`${'='.repeat(60)}\n`);

  // Salvar arquivo original no diretório da música
  try {
    const fs = await import('fs/promises');
    await fs.mkdir(musicDir, { recursive: true });
    
    const originalPath = join(musicDir, 'original' + extname(tempPath));
    if (!existsSync(originalPath)) {
      console.log(`[${fileId}] 💾 Salvando arquivo original...`);
      await fs.copyFile(tempPath, originalPath);
      console.log(`[${fileId}] ✅ Arquivo original salvo: ${originalPath}`);
    } else {
      console.log(`[${fileId}] ℹ️  Arquivo original já existe, mantendo existente`);
    }
  } catch (err: any) {
    console.warn(`[${fileId}] ⚠️  Erro ao salvar arquivo original:`, err.message);
  }

  // Verificar quais etapas já foram concluídas
  const vocalsPath = join(musicDir, 'vocals.wav');
  const instrumentalPath = join(musicDir, 'instrumental.wav');
  const waveformPath = join(musicDir, 'waveform.json');
  const lyricsPath = join(musicDir, 'lyrics.lrc');
  
  const vocalsExists = existsSync(vocalsPath);
  const instrumentalExists = existsSync(instrumentalPath);
  const waveformExists = existsSync(waveformPath);
  const lyricsExists = existsSync(lyricsPath);
  
  console.log(`[${fileId}] 🔍 Verificando etapas já concluídas:`);
  console.log(`[${fileId}]   ${vocalsExists ? '✅' : '❌'} Vocais: ${vocalsExists ? 'Já processado' : 'Pendente'}`);
  console.log(`[${fileId}]   ${instrumentalExists ? '✅' : '❌'} Instrumental: ${instrumentalExists ? 'Já processado' : 'Pendente'}`);
  console.log(`[${fileId}]   ${waveformExists ? '✅' : '❌'} Waveform: ${waveformExists ? 'Já processado' : 'Pendente'}`);
  console.log(`[${fileId}]   ${lyricsExists ? '✅' : '❌'} Letras: ${lyricsExists ? 'Já processado' : 'Pendente'}\n`);

  try {
    status.status = 'processing';
    
    // Etapa 1: Extrair vocais
    if (!vocalsExists) {
      status.step = 'Extraindo vocais...';
      status.progress = 10;

      console.log(`[${fileId}] 🎤 Etapa 1/4: Extraindo vocais...`);
      console.log(`[${fileId}] 📂 Arquivo de entrada: ${tempPath}`);
      
      const extractVoiceScript = join(PROJECT_ROOT, 'just-voice', 'extract_voice.py');
      
      // Garantir que o diretório existe
      const fs = await import('fs/promises');
      await fs.mkdir(musicDir, { recursive: true });
      
      // Passar o diretório de saída correto (com songId) para o script
      // Capturar progresso em tempo real
      await execPython(
        `python "${extractVoiceScript}" "${tempPath}" --output "${musicDir}"`, 
        undefined, 
        `${fileId} [Extract Vocals]`,
        (progress: number, message?: string) => {
          // Atualizar progresso da etapa 1 (10% a 30%)
          // progress vem de 0-100, mapear para 10-30
          const stepProgress = 10 + (progress * 0.2); // 10% + (progress * 20%)
          status.progress = Math.round(stepProgress);
          if (message) {
            status.step = `Extraindo vocais... ${progress}%`;
          }
        }
      );
      
      // Verificar se o arquivo foi criado no local esperado
      if (!existsSync(vocalsPath)) {
        console.log(`[${fileId}] ⚠️  Arquivo não encontrado no local esperado: ${vocalsPath}`);
        console.log(`[${fileId}] 🔍 Procurando arquivo em outros locais...`);
        
        // Tentar encontrar o arquivo em locais alternativos
        const searchDirs = [
          join(PROJECT_ROOT, 'just-voice', 'output'),
          join(PROJECT_ROOT, 'output'),
          join(PROJECT_ROOT, 'backend', 'output'),
          join(PROJECT_ROOT, 'music', songId), // Usar songId em vez de musicName
          join(PROJECT_ROOT, 'music', musicName) // Fallback para compatibilidade
        ];
        
        let foundPath: string | null = null;
        
        for (const searchDir of searchDirs) {
          try {
            const files = await fs.readdir(searchDir);
            const vocalsFile = files.find((f: string) => 
              f.includes('vocals') && f.endsWith('.wav')
            );
            
            if (vocalsFile) {
              foundPath = join(searchDir, vocalsFile);
              console.log(`[${fileId}] ✅ Arquivo encontrado em: ${foundPath}`);
              break;
            }
          } catch (err) {
            // Diretório não existe, continuar procurando
          }
        }
        
        if (foundPath) {
          // Mover o arquivo para o local correto
          console.log(`[${fileId}] 📦 Movendo arquivo para: ${vocalsPath}`);
          await fs.rename(foundPath, vocalsPath);
          console.log(`[${fileId}] ✅ Arquivo movido com sucesso!`);
        } else {
          console.error(`[${fileId}] ❌ Arquivo de vocais não encontrado em nenhum local`);
          throw new Error('Falha ao extrair vocais - arquivo não encontrado');
        }
      }
      
      const vocalsSize = statSync(vocalsPath).size;
      console.log(`[${fileId}] ✅ Vocais extraídos com sucesso! (${(vocalsSize / 1024 / 1024).toFixed(2)} MB)`);
      
      // Atualizar banco de dados com progresso
      await updateProcessingProgress(songId, { vocals: true });
    } else {
      console.log(`[${fileId}] ⏭️  Vocais já processados, pulando etapa...`);
      const vocalsSize = statSync(vocalsPath).size;
      console.log(`[${fileId}] ✅ Vocais encontrados (${(vocalsSize / 1024 / 1024).toFixed(2)} MB)`);
    }

    // Etapa 2: Remover voz (instrumental)
    if (!instrumentalExists) {
      status.step = 'Removendo voz...';
      status.progress = 30;

      console.log(`\n[${fileId}] 🎵 Etapa 2/4: Removendo voz (gerando instrumental)...`);
      
      const removeVoiceScript = join(PROJECT_ROOT, 'voice-remove', 'remove_voice.py');
    
      // Passar o diretório de saída correto (com songId) como segundo argumento
      // Capturar progresso em tempo real
      await execPython(
        `python "${removeVoiceScript}" "${tempPath}" "${musicDir}"`, 
        undefined, 
        `${fileId} [Remove Voice]`,
        (progress: number, message?: string) => {
          // Atualizar progresso da etapa 2 (30% a 50%)
          // progress vem de 0-100, mapear para 30-50
          const stepProgress = 30 + (progress * 0.2); // 30% + (progress * 20%)
          status.progress = Math.round(stepProgress);
          if (message) {
            status.step = `Removendo voz... ${progress}%`;
          }
        }
      );
      
      // Verificar se o arquivo foi criado no local esperado
      if (!existsSync(instrumentalPath)) {
        console.log(`[${fileId}] ⚠️  Arquivo instrumental não encontrado no local esperado: ${instrumentalPath}`);
        console.log(`[${fileId}] 🔍 Procurando arquivo em outros locais...`);
        
        const fs = await import('fs/promises');
        // Tentar encontrar o arquivo em locais alternativos
        const searchDirs = [
          join(PROJECT_ROOT, 'temp', 'music', songId), // Usar songId
          join(PROJECT_ROOT, 'temp', 'music', musicName), // Fallback para compatibilidade
          join(PROJECT_ROOT, 'voice-remove', 'output'),
          join(PROJECT_ROOT, 'output'),
          join(PROJECT_ROOT, 'backend', 'output'),
          join(PROJECT_ROOT, 'music', songId), // Usar songId
          join(PROJECT_ROOT, 'music', musicName) // Fallback para compatibilidade
        ];
        
        // Também procurar recursivamente em temp/music/ caso o script tenha criado subdiretórios
        const tempMusicDir = join(PROJECT_ROOT, 'temp', 'music');
        if (existsSync(tempMusicDir)) {
          try {
            const fs = await import('fs/promises');
            const tempDirs = await fs.readdir(tempMusicDir, { withFileTypes: true });
            for (const dir of tempDirs) {
              if (dir.isDirectory()) {
                const tempSubDir = join(tempMusicDir, dir.name);
                searchDirs.unshift(tempSubDir); // Adicionar no início da lista
              }
            }
          } catch (err) {
            // Ignorar erros ao ler temp/music
          }
        }
        
        let foundPath: string | null = null;
        
        for (const searchDir of searchDirs) {
          try {
            const files = await fs.readdir(searchDir);
            const instrumentalFile = files.find((f: string) => 
              (f.includes('no_vocals') || f.includes('instrumental')) && f.endsWith('.wav')
            );
            
            if (instrumentalFile) {
              foundPath = join(searchDir, instrumentalFile);
              console.log(`[${fileId}] ✅ Arquivo encontrado em: ${foundPath}`);
              break;
            }
          } catch (err) {
            // Diretório não existe, continuar procurando
          }
        }
        
        if (foundPath) {
          // Mover o arquivo para o local correto
          console.log(`[${fileId}] 📦 Movendo arquivo para: ${instrumentalPath}`);
          await fs.rename(foundPath, instrumentalPath);
          console.log(`[${fileId}] ✅ Arquivo movido com sucesso!`);
        } else {
          console.error(`[${fileId}] ❌ Arquivo instrumental não encontrado em nenhum local`);
          throw new Error('Falha ao remover voz - arquivo não encontrado');
        }
      }
      
      const instrumentalSize = statSync(instrumentalPath).size;
      console.log(`[${fileId}] ✅ Instrumental gerado com sucesso! (${(instrumentalSize / 1024 / 1024).toFixed(2)} MB)`);
      
      // Atualizar banco de dados com progresso
      await updateProcessingProgress(songId, { instrumental: true });
    } else {
      console.log(`[${fileId}] ⏭️  Instrumental já processado, pulando etapa...`);
      const instrumentalSize = statSync(instrumentalPath).size;
      console.log(`[${fileId}] ✅ Instrumental encontrado (${(instrumentalSize / 1024 / 1024).toFixed(2)} MB)`);
    }

    // Etapa 3: Gerar waveform (usar vocals.wav)
    if (!waveformExists) {
      status.step = 'Gerando waveform...';
      status.progress = 50;

      console.log(`\n[${fileId}] 📊 Etapa 3/4: Gerando waveform...`);
      console.log(`[${fileId}] 📂 Usando arquivo: ${vocalsPath}`);
      
      const waveformScript = join(PROJECT_ROOT, 'waveform-generator', 'waveform_extractor.py');
      // Passar o diretório de saída correto (com songId) como quarto argumento (json_folder)
      // Capturar progresso em tempo real
      await execPython(
        `python "${waveformScript}" "${vocalsPath}" "waveform.json" "waveform.png" "${musicDir}"`, 
        undefined, 
        `${fileId} [Waveform]`,
        (progress: number, message?: string) => {
          // Atualizar progresso da etapa 3 (50% a 70%)
          // progress vem de 0-100, mapear para 50-70
          const stepProgress = 50 + (progress * 0.2); // 50% + (progress * 20%)
          status.progress = Math.round(stepProgress);
          if (message) {
            status.step = `Gerando waveform... ${progress}%`;
          }
        }
      );
      
      // Verificar se o arquivo foi criado no local esperado
      if (!existsSync(waveformPath)) {
        console.log(`[${fileId}] ⚠️  Arquivo não encontrado no local esperado: ${waveformPath}`);
        console.log(`[${fileId}] 🔍 Procurando arquivo em outros locais...`);
        
        const fs = await import('fs/promises');
        // Tentar encontrar o arquivo em locais alternativos
        const searchDirs = [
          join(PROJECT_ROOT, 'waveform-generator', 'wave_json'),
          join(PROJECT_ROOT, 'wave_json'),
          join(PROJECT_ROOT, 'music', songId, 'wave_json'), // Usar songId
          join(PROJECT_ROOT, 'music', musicName, 'wave_json'), // Fallback
          join(musicDir, 'wave_json'),
          musicDir
        ];
        
        let foundPath: string | null = null;
        
        for (const searchDir of searchDirs) {
          try {
            const files = await fs.readdir(searchDir);
            // Procurar por arquivos JSON que podem ser waveform
            // Priorizar arquivos que correspondem ao nome da música
            const waveformFile = files.find((f: string) => {
              if (!f.endsWith('.json')) return false;
              // Priorizar arquivos com nome da música, songId, "vocals" ou "waveform"
              const lowerF = f.toLowerCase();
              const lowerMusicName = musicName.toLowerCase();
              const lowerSongId = songId.toLowerCase();
              return lowerF.includes(lowerSongId) ||
                     lowerF.includes(lowerMusicName) || 
                     lowerF.includes('vocals') || 
                     lowerF.includes('waveform');
            });
            
            if (waveformFile) {
              foundPath = join(searchDir, waveformFile);
              console.log(`[${fileId}] ✅ Arquivo encontrado em: ${foundPath}`);
              break;
            }
          } catch (err) {
            // Diretório não existe, continuar procurando
          }
        }
        
        if (foundPath) {
          // Ler o conteúdo do arquivo JSON para verificar se é um waveform válido
          try {
            const fs = await import('fs/promises');
            const content = await fs.readFile(foundPath, 'utf-8');
            const data = JSON.parse(content);
            
            // Verificar se tem estrutura de waveform (tem array de valores ou waveform)
            if (data.waveform || Array.isArray(data) || (data.sample_rate && data.duration)) {
              // Mover o arquivo para o local correto
              console.log(`[${fileId}] 📦 Movendo arquivo para: ${waveformPath}`);
              await fs.mkdir(musicDir, { recursive: true });
              await fs.rename(foundPath, waveformPath);
              console.log(`[${fileId}] ✅ Arquivo movido com sucesso!`);
            } else {
              console.error(`[${fileId}] ⚠️  Arquivo encontrado mas não parece ser um waveform válido`);
              throw new Error('Arquivo encontrado mas formato inválido');
            }
          } catch (err: any) {
            console.error(`[${fileId}] ❌ Erro ao processar arquivo encontrado:`, err.message);
            throw new Error('Falha ao processar waveform encontrado');
          }
        } else {
          console.error(`[${fileId}] ❌ Arquivo de waveform não encontrado em nenhum local`);
          throw new Error('Falha ao gerar waveform - arquivo não encontrado');
        }
      }
      
      const waveformSize = statSync(waveformPath).size;
      console.log(`[${fileId}] ✅ Waveform gerado com sucesso! (${(waveformSize / 1024).toFixed(2)} KB)`);
      
      // Atualizar banco de dados com progresso
      await updateProcessingProgress(songId, { waveform: true });
    } else {
      console.log(`[${fileId}] ⏭️  Waveform já processado, pulando etapa...`);
      const waveformSize = statSync(waveformPath).size;
      console.log(`[${fileId}] ✅ Waveform encontrado (${(waveformSize / 1024).toFixed(2)} KB)`);
    }

    // Etapa 4: Gerar letras LRC
    if (!lyricsExists) {
      status.step = 'Gerando letras...';
      status.progress = 70;

      console.log(`\n[${fileId}] 📝 Etapa 4/4: Gerando letras LRC...`);
      
      const lrcScript = join(PROJECT_ROOT, 'lrc-generator', 'src', 'index.ts');
      // Passar o diretório de saída correto (com songId) usando --output-dir
      await execPython(`cd "${join(PROJECT_ROOT, 'lrc-generator')}" && npx tsx "${lrcScript}" "${tempPath}" --output-dir "${musicDir}"`, join(PROJECT_ROOT, 'lrc-generator'), `${fileId} [LRC Generator]`);
      
      // Procurar arquivo .lrc no diretório (pode ter nome diferente)
      const fs = await import('fs/promises');
      let foundLyricsFile: string | null = null;
      
      try {
        const files = await fs.readdir(musicDir);
        const lrcFile = files.find((f: string) => f.toLowerCase().endsWith('.lrc'));
        
        if (lrcFile) {
          foundLyricsFile = join(musicDir, lrcFile);
          // Se o arquivo não se chama "lyrics.lrc", renomeá-lo
          if (lrcFile !== 'lyrics.lrc') {
            console.log(`[${fileId}] 📝 Renomeando arquivo de letras: ${lrcFile} -> lyrics.lrc`);
            await fs.rename(foundLyricsFile, lyricsPath);
            foundLyricsFile = lyricsPath;
          }
        }
      } catch (err) {
        console.error(`[${fileId}] ⚠️  Erro ao procurar arquivo de letras:`, err);
      }
      
      // Verificar se o arquivo foi criado
      if (!foundLyricsFile || !existsSync(lyricsPath)) {
        console.warn(`[${fileId}] ⚠️  Aviso: Arquivo de letras não foi gerado. Continuando...`);
      } else {
        const lyricsSize = statSync(lyricsPath).size;
        console.log(`[${fileId}] ✅ Letras geradas com sucesso! (${(lyricsSize / 1024).toFixed(2)} KB)`);
        // Atualizar banco de dados com progresso
        await updateProcessingProgress(songId, { lyrics: true });
      }
    } else {
      console.log(`[${fileId}] ⏭️  Letras já processadas, pulando etapa...`);
      const lyricsSize = statSync(lyricsPath).size;
      console.log(`[${fileId}] ✅ Letras encontradas (${(lyricsSize / 1024).toFixed(2)} KB)`);
    }

    status.step = 'Atualizando banco de dados...';
    status.progress = 90;

    console.log(`\n[${fileId}] 💾 Atualizando banco de dados...`);

    // 5. Obter duração do áudio para o banco de dados
    let duration = 0;
    try {
      // Tentar obter duração do waveform
      if (existsSync(waveformPath)) {
        const waveformData = await import('fs/promises').then(fs => 
          fs.readFile(waveformPath, 'utf-8')
        ).then(data => JSON.parse(data));
        duration = waveformData.duration || 0;
        console.log(`[${fileId}] ⏱️  Duração detectada: ${duration.toFixed(2)} segundos`);
      }
    } catch (err) {
      console.error(`[${fileId}] ⚠️  Erro ao obter duração:`, err);
    }

    // 6. Adicionar ou atualizar no banco de dados
    try {
      const existingSong = await getSongById(songId);
      
      const songData = {
        id: songId,
        name: musicName,
        displayName: musicName.replace(/([A-Z])/g, ' $1').trim(),
        artist: 'Unknown',
        duration: duration,
        files: {
          original: existsSync(join(musicDir, 'original' + extname(tempPath))) ? 'original' + extname(tempPath) : '',
          vocals: existsSync(vocalsPath) ? 'vocals.wav' : '',
          instrumental: existsSync(instrumentalPath) ? 'instrumental.wav' : '',
          waveform: existsSync(waveformPath) ? 'waveform.json' : '',
          lyrics: existsSync(lyricsPath) ? 'lyrics.lrc' : ''
        },
        metadata: {
          sampleRate: 44100,
          format: 'wav',
          createdAt: existingSong?.metadata?.createdAt || new Date().toISOString(),
          lastProcessed: new Date().toISOString()
        }
      };
      
      if (existingSong) {
        // Atualizar música existente
        await updateSong(songId, {
          ...existingSong,
          ...songData,
          files: {
            ...existingSong.files,
            ...songData.files
          }
        });
        console.log(`[${fileId}] ✅ Música atualizada no banco de dados: ${songId}`);
      } else {
        // Adicionar nova música
        await addSong(songData);
        console.log(`[${fileId}] ✅ Música adicionada ao banco de dados: ${songId}`);
      }
    } catch (err: any) {
      console.log(`[${fileId}] ⚠️  Erro ao atualizar banco de dados:`, err.message);
    }

    status.step = 'Finalizando...';
    status.progress = 100;

    // Limpar arquivo temporário
    try {
      const fs = await import('fs/promises');
      await fs.unlink(tempPath);
      console.log(`[${fileId}] 🗑️  Arquivo temporário removido: ${tempPath}`);
    } catch (err) {
      console.error(`[${fileId}] ⚠️  Erro ao remover arquivo temporário:`, err);
    }

    status.status = 'completed';
    status.songId = songId;
    status.step = 'Processamento concluído!';

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${fileId}] 🎉 Processamento concluído com sucesso!`);
    console.log(`[${fileId}] 📁 Música disponível em: ${musicDir}`);
    console.log(`${'='.repeat(60)}\n`);

    // Limpar status após 1 hora
    setTimeout(() => {
      processingStatus.delete(fileId);
      console.log(`[${fileId}] 🧹 Status de processamento removido (limpeza automática)`);
    }, 3600000);
  } catch (error: any) {
    status.status = 'error';
    status.error = error.message;
    status.step = 'Erro no processamento';
    
    console.error(`\n${'='.repeat(60)}`);
    console.error(`[${fileId}] ❌ ERRO durante o processamento:`);
    console.error(`[${fileId}] 📝 Mensagem: ${error.message}`);
    if (error.stack) {
      console.error(`[${fileId}] 📚 Stack trace:`, error.stack);
    }
    console.error(`${'='.repeat(60)}\n`);
  }
}

export { router as processingRoutes };

