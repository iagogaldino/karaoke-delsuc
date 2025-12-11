import { spawn } from 'child_process';
import { join, extname } from 'path';
import { existsSync, mkdirSync, renameSync, statSync } from 'fs';
import { addSong, getSongById, updateSong } from '../utils/database.js';
import { PROJECT_ROOT, PROCESSING_CONFIG, PATHS } from '../config/index.js';
import { ProcessingStatus } from '../types/index.js';

// Store processing status
export const processingStatus = new Map<string, ProcessingStatus>();

/**
 * Execute Python commands with UTF-8 encoding and real-time logging
 */
export async function execPython(
  command: string,
  cwd?: string,
  logPrefix?: string,
  onProgress?: (progress: number, message?: string) => void
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // Configure UTF-8 encoding for Windows
    const env = { ...process.env };
    env.PYTHONIOENCODING = 'utf-8';
    env.PYTHONUTF8 = '1';
    
    const prefix = logPrefix ? `[${logPrefix}] ` : '';
    console.log(`${prefix}🚀 Executando: ${command}`);
    
    // Parse command to use with spawn
    const isWindows = process.platform === 'win32';
    let cmd: string;
    let args: string[];
    let useShell = false;
    
    if (isWindows) {
      // On Windows, use cmd /c to execute complex commands
      if (command.includes('&&') || command.includes('cd')) {
        cmd = 'cmd';
        args = ['/c', command];
        useShell = true;
      } else {
        // Simple Python command - improve parsing to support more arguments
        // Pattern: python "script.py" "arg1" "arg2" --flag "arg3"
        const pythonMatch = command.match(/python\s+"([^"]+)"\s*(.+)?/);
        if (pythonMatch) {
          cmd = 'python';
          const scriptPath = pythonMatch[1];
          const restOfCommand = pythonMatch[2] || '';
          // Parse arguments: supports quoted strings and flags
          const argsList: string[] = [];
          const regex = /"([^"]+)"|--?\w+(?:="[^"]+")?|(\S+)/g;
          let match;
          while ((match = regex.exec(restOfCommand)) !== null) {
            if (match[1]) {
              // Quoted string
              argsList.push(match[1]);
            } else if (match[2]) {
              // Unquoted argument
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
          throw new Error('Unsupported command format');
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
    
    // Function to parse progress from progress bars (tqdm, etc)
    const parseProgress = (line: string): number | null => {
      // Common progress patterns:
      // "50%|███████████████████████████████████                                     | 5.85/11.7 [00:04<00:04,  1.28seconds/s]"
      const percentMatch = line.match(/(\d+)%/);
      if (percentMatch) {
        return parseInt(percentMatch[1], 10);
      }
      return null;
    };
    
    // Capture stdout in real-time
    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString('utf8');
      stdout += text;
      // Log each line in real-time
      text.split('\n').forEach((line: string) => {
        if (line.trim()) {
          console.log(`${prefix}📤 ${line.trim()}`);
          // Try to parse progress from stdout too
          if (onProgress) {
            const progress = parseProgress(line);
            if (progress !== null) {
              onProgress(progress);
            }
          }
        }
      });
    });
    
    // Capture stderr in real-time (demucs usually shows progress in stderr)
    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString('utf8');
      stderr += text;
      // Log each line in real-time
      text.split('\n').forEach((line: string) => {
        if (line.trim()) {
          console.log(`${prefix}⚠️  ${line.trim()}`);
          // Parse progress from progress bars (tqdm)
          if (onProgress) {
            const progress = parseProgress(line);
            if (progress !== null) {
              onProgress(progress, line.trim());
            }
          }
        }
      });
    });
    
    // When process finishes
    child.on('close', (code: number | null) => {
      if (code === 0) {
        console.log(`${prefix}✅ Comando executado com sucesso (código: ${code})`);
        if (onProgress) {
          onProgress(100); // Mark as 100% when finished
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
    
    // Error handling
    child.on('error', (error: Error) => {
      console.error(`${prefix}❌ Erro ao executar comando:`, error.message);
      reject(error);
    });
  });
}

/**
 * Helper function to update processing progress in database
 */
export async function updateProcessingProgress(
  songId: string,
  progress: { vocals?: boolean; instrumental?: boolean; waveform?: boolean; lyrics?: boolean }
) {
  try {
    const song = getSongById(songId);
    if (song) {
      // Update status of processed files
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
      
      updateSong(songId, {
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

/**
 * Process music file
 */
export async function processMusic(
  fileId: string,
  tempPath: string,
  musicDir: string,
  songId: string,
  musicName: string,
  displayName: string,
  bandId?: string
) {
  const status = processingStatus.get(fileId);
  if (!status) return;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎵 Iniciando processamento da música: ${musicName}`);
  console.log(`📁 ID: ${fileId}`);
  console.log(`📂 Diretório: ${musicDir}`);
  console.log(`📄 Arquivo temporário: ${tempPath}`);
  console.log(`${'='.repeat(60)}\n`);

  // Criar entrada inicial no banco de dados para permitir re-processamento mesmo em caso de erro
  try {
    const existingSong = getSongById(songId);
    if (!existingSong) {
      // Criar entrada básica no banco de dados
      const initialSongData = {
        id: songId,
        name: musicName,
        displayName: displayName || musicName.replace(/([A-Z])/g, ' $1').trim(),
        artist: 'Unknown',
        duration: 0,
        files: {
          original: '',
          vocals: '',
          instrumental: '',
          waveform: '',
          lyrics: ''
        },
        metadata: {
          sampleRate: 44100,
          format: 'wav',
          createdAt: new Date().toISOString(),
          lastProcessed: new Date().toISOString()
        },
        band: bandId || undefined
      };
      addSong(initialSongData);
      console.log(`[${fileId}] ✅ Entrada criada no banco de dados: ${songId}`);
    } else {
      console.log(`[${fileId}] ℹ️  Música já existe no banco de dados, atualizando...`);
    }
  } catch (err: any) {
    console.warn(`[${fileId}] ⚠️  Erro ao criar entrada inicial no banco de dados:`, err.message);
  }

  // Save original file in music directory
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

  // Check which steps have already been completed
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
    
    // Step 1: Extract vocals
    if (!vocalsExists) {
      status.step = 'Extraindo vocais...';
      status.progress = 10;

      console.log(`[${fileId}] 🎤 Etapa 1/4: Extraindo vocais...`);
      console.log(`[${fileId}] 📂 Arquivo de entrada: ${tempPath}`);
      
      const extractVoiceScript = join(PROJECT_ROOT, 'just-voice', 'extract_voice.py');
      
      // Ensure directory exists
      const fs = await import('fs/promises');
      await fs.mkdir(musicDir, { recursive: true });
      
      // Pass correct output directory (with songId) to script
      // Capture progress in real-time
      await execPython(
        `python "${extractVoiceScript}" "${tempPath}" --output "${musicDir}"`, 
        undefined, 
        `${fileId} [Extract Vocals]`,
        (progress: number, message?: string) => {
          // Update progress of step 1 (10% to 30%)
          const stepProgress = 10 + (progress * 0.2);
          status.progress = Math.round(stepProgress);
          if (message) {
            status.step = `Extraindo vocais... ${progress}%`;
          }
        }
      );
      
      // Verify file was created in expected location
      if (!existsSync(vocalsPath)) {
        console.log(`[${fileId}] ⚠️  Arquivo não encontrado no local esperado: ${vocalsPath}`);
        console.log(`[${fileId}] 🔍 Procurando arquivo em outros locais...`);
        
        // Try to find file in alternative locations
        const searchDirs = [
          join(PROJECT_ROOT, 'just-voice', 'output'),
          join(PROJECT_ROOT, 'output'),
          join(PROJECT_ROOT, 'backend', 'output'),
          join(PROJECT_ROOT, 'music', songId),
          join(PROJECT_ROOT, 'music', musicName)
        ];
        
        let foundPath: string | null = null;
        const fs = await import('fs/promises');
        
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
            // Directory doesn't exist, continue searching
          }
        }
        
        if (foundPath) {
          // Move file to correct location
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
      
      // Update database with progress
      await updateProcessingProgress(songId, { vocals: true });
      
      // Salvar no banco de dados imediatamente após cada etapa
      try {
        const song = getSongById(songId);
        if (song) {
          const updatedFiles = { ...song.files, vocals: 'vocals.wav' };
          updateSong(songId, { files: updatedFiles, metadata: { ...song.metadata, lastProcessed: new Date().toISOString() } });
          console.log(`[${fileId}] 💾 Progresso salvo no banco de dados (vocais)`);
        }
      } catch (err: any) {
        console.warn(`[${fileId}] ⚠️  Erro ao salvar progresso no banco:`, err.message);
      }
    } else {
      console.log(`[${fileId}] ⏭️  Vocais já processados, pulando etapa...`);
      const vocalsSize = statSync(vocalsPath).size;
      console.log(`[${fileId}] ✅ Vocais encontrados (${(vocalsSize / 1024 / 1024).toFixed(2)} MB)`);
    }

    // Step 2: Remove voice (instrumental)
    if (!instrumentalExists) {
      status.step = 'Removendo voz...';
      status.progress = 30;

      console.log(`\n[${fileId}] 🎵 Etapa 2/4: Removendo voz (gerando instrumental)...`);
      
      const removeVoiceScript = join(PROJECT_ROOT, 'voice-remove', 'remove_voice.py');
    
      // Pass correct output directory (with songId) as second argument
      await execPython(
        `python "${removeVoiceScript}" "${tempPath}" "${musicDir}"`, 
        undefined, 
        `${fileId} [Remove Voice]`,
        (progress: number, message?: string) => {
          const stepProgress = 30 + (progress * 0.2);
          status.progress = Math.round(stepProgress);
          if (message) {
            status.step = `Removendo voz... ${progress}%`;
          }
        }
      );
      
      // Verify file was created in expected location
      if (!existsSync(instrumentalPath)) {
        console.log(`[${fileId}] ⚠️  Arquivo instrumental não encontrado no local esperado: ${instrumentalPath}`);
        console.log(`[${fileId}] 🔍 Procurando arquivo em outros locais...`);
        
        const fs = await import('fs/promises');
        const searchDirs = [
          join(PROJECT_ROOT, 'temp', 'music', songId),
          join(PROJECT_ROOT, 'temp', 'music', musicName),
          join(PROJECT_ROOT, 'voice-remove', 'output'),
          join(PROJECT_ROOT, 'output'),
          join(PROJECT_ROOT, 'backend', 'output'),
          join(PROJECT_ROOT, 'music', songId),
          join(PROJECT_ROOT, 'music', musicName)
        ];
        
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
            // Directory doesn't exist, continue searching
          }
        }
        
        if (foundPath) {
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
      
      await updateProcessingProgress(songId, { instrumental: true });
      
      // Salvar no banco de dados imediatamente após cada etapa
      try {
        const song = getSongById(songId);
        if (song) {
          const updatedFiles = { ...song.files, instrumental: 'instrumental.wav' };
          updateSong(songId, { files: updatedFiles, metadata: { ...song.metadata, lastProcessed: new Date().toISOString() } });
          console.log(`[${fileId}] 💾 Progresso salvo no banco de dados (instrumental)`);
        }
      } catch (err: any) {
        console.warn(`[${fileId}] ⚠️  Erro ao salvar progresso no banco:`, err.message);
      }
    } else {
      console.log(`[${fileId}] ⏭️  Instrumental já processado, pulando etapa...`);
      const instrumentalSize = statSync(instrumentalPath).size;
      console.log(`[${fileId}] ✅ Instrumental encontrado (${(instrumentalSize / 1024 / 1024).toFixed(2)} MB)`);
    }

    // Step 3: Generate waveform (use vocals.wav)
    if (!waveformExists) {
      status.step = 'Gerando waveform...';
      status.progress = 50;

      console.log(`\n[${fileId}] 📊 Etapa 3/4: Gerando waveform...`);
      console.log(`[${fileId}] 📂 Usando arquivo: ${vocalsPath}`);
      
      const waveformScript = join(PROJECT_ROOT, 'waveform-generator', 'waveform_extractor.py');
      await execPython(
        `python "${waveformScript}" "${vocalsPath}" "waveform.json" "waveform.png" "${musicDir}"`, 
        undefined, 
        `${fileId} [Waveform]`,
        (progress: number, message?: string) => {
          const stepProgress = 50 + (progress * 0.2);
          status.progress = Math.round(stepProgress);
          if (message) {
            status.step = `Gerando waveform... ${progress}%`;
          }
        }
      );
      
      // Verify file was created
      if (!existsSync(waveformPath)) {
        console.log(`[${fileId}] ⚠️  Arquivo não encontrado no local esperado: ${waveformPath}`);
        console.log(`[${fileId}] 🔍 Procurando arquivo em outros locais...`);
        
        const fs = await import('fs/promises');
        const searchDirs = [
          join(PROJECT_ROOT, 'waveform-generator', 'wave_json'),
          join(PROJECT_ROOT, 'wave_json'),
          join(PROJECT_ROOT, 'music', songId, 'wave_json'),
          join(PROJECT_ROOT, 'music', musicName, 'wave_json'),
          join(musicDir, 'wave_json'),
          musicDir
        ];
        
        let foundPath: string | null = null;
        
        for (const searchDir of searchDirs) {
          try {
            const files = await fs.readdir(searchDir);
            const waveformFile = files.find((f: string) => {
              if (!f.endsWith('.json')) return false;
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
            // Directory doesn't exist, continue searching
          }
        }
        
        if (foundPath) {
          try {
            const fs = await import('fs/promises');
            const content = await fs.readFile(foundPath, 'utf-8');
            const data = JSON.parse(content);
            
            if (data.waveform || Array.isArray(data) || (data.sample_rate && data.duration)) {
              console.log(`[${fileId}] 📦 Movendo arquivo para: ${waveformPath}`);
              await fs.mkdir(musicDir, { recursive: true });
              await fs.rename(foundPath, waveformPath);
              console.log(`[${fileId}] ✅ Arquivo movido com sucesso!`);
            } else {
              throw new Error('Arquivo encontrado mas formato inválido');
            }
          } catch (err: any) {
            console.error(`[${fileId}] ❌ Erro ao processar arquivo encontrado:`, err.message);
            throw new Error('Falha ao processar waveform encontrado');
          }
        } else {
          throw new Error('Falha ao gerar waveform - arquivo não encontrado');
        }
      }
      
      const waveformSize = statSync(waveformPath).size;
      console.log(`[${fileId}] ✅ Waveform gerado com sucesso! (${(waveformSize / 1024).toFixed(2)} KB)`);
      
      await updateProcessingProgress(songId, { waveform: true });
      
      // Salvar no banco de dados imediatamente após cada etapa
      try {
        const song = getSongById(songId);
        if (song) {
          const updatedFiles = { ...song.files, waveform: 'waveform.json' };
          updateSong(songId, { files: updatedFiles, metadata: { ...song.metadata, lastProcessed: new Date().toISOString() } });
          console.log(`[${fileId}] 💾 Progresso salvo no banco de dados (waveform)`);
        }
      } catch (err: any) {
        console.warn(`[${fileId}] ⚠️  Erro ao salvar progresso no banco:`, err.message);
      }
    } else {
      console.log(`[${fileId}] ⏭️  Waveform já processado, pulando etapa...`);
      const waveformSize = statSync(waveformPath).size;
      console.log(`[${fileId}] ✅ Waveform encontrado (${(waveformSize / 1024).toFixed(2)} KB)`);
    }

    // Step 4: Generate LRC lyrics
    if (!lyricsExists) {
      status.step = 'Gerando letras...';
      status.progress = 70;

      console.log(`\n[${fileId}] 📝 Etapa 4/4: Gerando letras LRC...`);
      
      // Verificar tamanho do arquivo de áudio
      const audioFileSize = statSync(tempPath).size;
      const maxSize = 25 * 1024 * 1024; // 25 MB (limite da API OpenAI)
      
      let audioForLRC = tempPath;
      
      // Se o arquivo for muito grande, converter para MP3 usando script Python
      if (audioFileSize > maxSize) {
        console.log(`[${fileId}] ⚠️  Arquivo de áudio muito grande (${(audioFileSize / 1024 / 1024).toFixed(2)} MB), convertendo para MP3...`);
        
        const mp3Path = join(musicDir, 'temp_audio_lrc.mp3');
        const convertScript = join(PROJECT_ROOT, 'youtube-downloader', 'convert_audio_to_mp3.py');
        
        if (!existsSync(convertScript)) {
          console.warn(`[${fileId}] ⚠️  Script de conversão não encontrado, tentando com arquivo original...`);
        } else {
          try {
            // Converter para MP3 com qualidade reduzida (128k, 22kHz, mono)
            await execPython(
              `python "${convertScript}" "${tempPath}" "${mp3Path}" "128k" "22050" "1"`,
              undefined,
              `${fileId} [Convert to MP3]`
            );
            
            if (existsSync(mp3Path)) {
              const mp3Size = statSync(mp3Path).size;
              console.log(`[${fileId}] ✅ Áudio convertido para MP3: ${(mp3Size / 1024 / 1024).toFixed(2)} MB`);
              
              // Se ainda for muito grande, reduzir mais (96k, 16kHz, mono)
              if (mp3Size > maxSize) {
                console.log(`[${fileId}] ⚠️  MP3 ainda é grande, reduzindo qualidade...`);
                const smallerMp3Path = join(musicDir, 'temp_audio_lrc_small.mp3');
                
                try {
                  await execPython(
                    `python "${convertScript}" "${tempPath}" "${smallerMp3Path}" "96k" "16000" "1"`,
                    undefined,
                    `${fileId} [Convert to Small MP3]`
                  );
                  
                  if (existsSync(smallerMp3Path)) {
                    const smallerSize = statSync(smallerMp3Path).size;
                    console.log(`[${fileId}] ✅ Versão reduzida criada: ${(smallerSize / 1024 / 1024).toFixed(2)} MB`);
                    audioForLRC = smallerMp3Path;
                  } else {
                    audioForLRC = mp3Path;
                  }
                } catch (smallerError: any) {
                  console.warn(`[${fileId}] ⚠️  Erro ao criar versão reduzida: ${smallerError.message}`);
                  audioForLRC = mp3Path;
                }
              } else {
                audioForLRC = mp3Path;
              }
            } else {
              console.warn(`[${fileId}] ⚠️  Falha ao converter para MP3, tentando com arquivo original...`);
            }
          } catch (convertError: any) {
            console.warn(`[${fileId}] ⚠️  Erro ao converter para MP3: ${convertError.message}`);
            console.warn(`[${fileId}] ⚠️  Tentando com arquivo original (pode falhar se muito grande)...`);
          }
        }
      }
      
      const lrcScript = join(PROJECT_ROOT, 'lrc-generator', 'src', 'index.ts');
      await execPython(
        `cd "${join(PROJECT_ROOT, 'lrc-generator')}" && npx tsx "${lrcScript}" "${audioForLRC}" --output-dir "${musicDir}"`, 
        join(PROJECT_ROOT, 'lrc-generator'), 
        `${fileId} [LRC Generator]`
      );
      
      // Limpar arquivos temporários de MP3 se foram criados
      try {
        const fs = await import('fs/promises');
        const tempMp3Files = ['temp_audio_lrc.mp3', 'temp_audio_lrc_small.mp3'];
        for (const tempFile of tempMp3Files) {
          const tempPath = join(musicDir, tempFile);
          if (existsSync(tempPath) && tempPath !== audioForLRC) {
            await fs.unlink(tempPath);
            console.log(`[${fileId}] 🗑️  Arquivo temporário removido: ${tempFile}`);
          }
        }
      } catch (cleanupError) {
        // Ignorar erros de limpeza
      }
      
      // Look for .lrc file in directory
      const fs = await import('fs/promises');
      let foundLyricsFile: string | null = null;
      
      try {
        const files = await fs.readdir(musicDir);
        const lrcFile = files.find((f: string) => f.toLowerCase().endsWith('.lrc'));
        
        if (lrcFile) {
          foundLyricsFile = join(musicDir, lrcFile);
          if (lrcFile !== 'lyrics.lrc') {
            console.log(`[${fileId}] 📝 Renomeando arquivo de letras: ${lrcFile} -> lyrics.lrc`);
            await fs.rename(foundLyricsFile, lyricsPath);
            foundLyricsFile = lyricsPath;
          }
        }
      } catch (err) {
        console.error(`[${fileId}] ⚠️  Erro ao procurar arquivo de letras:`, err);
      }
      
      if (!foundLyricsFile || !existsSync(lyricsPath)) {
        console.warn(`[${fileId}] ⚠️  Aviso: Arquivo de letras não foi gerado. Continuando...`);
      } else {
        const lyricsSize = statSync(lyricsPath).size;
        console.log(`[${fileId}] ✅ Letras geradas com sucesso! (${(lyricsSize / 1024).toFixed(2)} KB)`);
        await updateProcessingProgress(songId, { lyrics: true });
        
        // Salvar no banco de dados imediatamente após cada etapa
        try {
          const song = getSongById(songId);
          if (song) {
            const updatedFiles = { ...song.files, lyrics: 'lyrics.lrc' };
            updateSong(songId, { files: updatedFiles, metadata: { ...song.metadata, lastProcessed: new Date().toISOString() } });
            console.log(`[${fileId}] 💾 Progresso salvo no banco de dados (letras)`);
          }
        } catch (err: any) {
          console.warn(`[${fileId}] ⚠️  Erro ao salvar progresso no banco:`, err.message);
        }
      }
    } else {
      console.log(`[${fileId}] ⏭️  Letras já processadas, pulando etapa...`);
      const lyricsSize = statSync(lyricsPath).size;
      console.log(`[${fileId}] ✅ Letras encontradas (${(lyricsSize / 1024).toFixed(2)} KB)`);
    }

    status.step = 'Atualizando banco de dados...';
    status.progress = 90;

    console.log(`\n[${fileId}] 💾 Atualizando banco de dados...`);

    // Get audio duration for database
    let duration = 0;
    try {
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

    // Add or update in database
    try {
      const existingSong = getSongById(songId);
      
      const songData = {
        id: songId,
        name: musicName,
        displayName: displayName || musicName.replace(/([A-Z])/g, ' $1').trim(),
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
        },
        band: bandId || existingSong?.band || undefined
      };
      
      if (existingSong) {
        updateSong(songId, {
          ...existingSong,
          ...songData,
          files: {
            ...existingSong.files,
            ...songData.files
          }
        });
        console.log(`[${fileId}] ✅ Música atualizada no banco de dados: ${songId}`);
      } else {
        addSong(songData);
        console.log(`[${fileId}] ✅ Música adicionada ao banco de dados: ${songId}`);
      }
    } catch (err: any) {
      console.log(`[${fileId}] ⚠️  Erro ao atualizar banco de dados:`, err.message);
    }

    status.step = 'Finalizando...';
    status.progress = 100;

    // Clean up temporary file (only if it's in temp directory, not in music directory)
    try {
      const fs = await import('fs/promises');
      // Only remove if file is in temp directory, not in music directory
      if (tempPath.includes(PATHS.TEMP_DIR) && !tempPath.includes(musicDir)) {
        await fs.unlink(tempPath);
        console.log(`[${fileId}] 🗑️  Arquivo temporário removido: ${tempPath}`);
      } else {
        console.log(`[${fileId}] ℹ️  Mantendo arquivo (não é temporário): ${tempPath}`);
      }
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

    // Clean up status after 1 hour
    setTimeout(() => {
      processingStatus.delete(fileId);
      console.log(`[${fileId}] 🧹 Status de processamento removido (limpeza automática)`);
    }, PROCESSING_CONFIG.STATUS_CLEANUP_TIME);
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
    
    // Salvar progresso atual no banco de dados mesmo em caso de erro
    try {
      console.log(`[${fileId}] 💾 Salvando progresso atual no banco de dados antes de finalizar...`);
      const song = getSongById(songId);
      if (song) {
        // Verificar quais arquivos foram processados
        const vocalsPath = join(musicDir, 'vocals.wav');
        const instrumentalPath = join(musicDir, 'instrumental.wav');
        const waveformPath = join(musicDir, 'waveform.json');
        const lyricsPath = join(musicDir, 'lyrics.lrc');
        const originalPath = join(musicDir, 'original' + extname(tempPath));
        
        const updatedFiles = {
          ...song.files,
          original: existsSync(originalPath) ? 'original' + extname(tempPath) : song.files.original,
          vocals: existsSync(vocalsPath) ? 'vocals.wav' : song.files.vocals,
          instrumental: existsSync(instrumentalPath) ? 'instrumental.wav' : song.files.instrumental,
          waveform: existsSync(waveformPath) ? 'waveform.json' : song.files.waveform,
          lyrics: existsSync(lyricsPath) ? 'lyrics.lrc' : song.files.lyrics
        };
        
        // Tentar obter duração do waveform se disponível
        let duration = song.duration;
        try {
          if (existsSync(waveformPath)) {
            const waveformData = await import('fs/promises').then(fs => 
              fs.readFile(waveformPath, 'utf-8')
            ).then(data => JSON.parse(data));
            duration = waveformData.duration || duration;
          }
        } catch (err) {
          // Ignorar erro ao ler waveform
        }
        
        updateSong(songId, {
          ...song,
          files: updatedFiles,
          duration: duration,
          metadata: {
            ...song.metadata,
            lastProcessed: new Date().toISOString()
          }
        });
        console.log(`[${fileId}] ✅ Progresso salvo no banco de dados (permitindo re-processamento)`);
      } else {
        // Se não existe, criar entrada básica
        const initialSongData = {
          id: songId,
          name: musicName,
          displayName: displayName || musicName.replace(/([A-Z])/g, ' $1').trim(),
          artist: 'Unknown',
          duration: 0,
          files: {
            original: existsSync(join(musicDir, 'original' + extname(tempPath))) ? 'original' + extname(tempPath) : '',
            vocals: existsSync(join(musicDir, 'vocals.wav')) ? 'vocals.wav' : '',
            instrumental: existsSync(join(musicDir, 'instrumental.wav')) ? 'instrumental.wav' : '',
            waveform: existsSync(join(musicDir, 'waveform.json')) ? 'waveform.json' : '',
            lyrics: existsSync(join(musicDir, 'lyrics.lrc')) ? 'lyrics.lrc' : ''
          },
          metadata: {
            sampleRate: 44100,
            format: 'wav',
            createdAt: new Date().toISOString(),
            lastProcessed: new Date().toISOString()
          }
        };
        addSong(initialSongData);
        console.log(`[${fileId}] ✅ Entrada criada no banco de dados com progresso atual`);
      }
    } catch (saveError: any) {
      console.error(`[${fileId}] ⚠️  Erro ao salvar progresso no banco de dados:`, saveError.message);
    }
    
    // Clean up status after 1 hour even on error
    setTimeout(() => {
      processingStatus.delete(fileId);
      console.log(`[${fileId}] 🧹 Status de processamento removido (limpeza automática)`);
    }, PROCESSING_CONFIG.STATUS_CLEANUP_TIME);
  }
}

/**
 * Process music from YouTube URL
 */
export async function processYouTubeMusic(
  fileId: string,
  youtubeUrl: string,
  musicDir: string,
  songId: string,
  musicName: string,
  displayName: string,
  bandId?: string
) {
  const status = processingStatus.get(fileId);
  if (!status) return;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎵 Iniciando processamento do YouTube: ${musicName}`);
  console.log(`📁 ID: ${fileId}`);
  console.log(`🔗 URL: ${youtubeUrl}`);
  console.log(`📂 Diretório: ${musicDir}`);
  console.log(`${'='.repeat(60)}\n`);

  // Criar entrada inicial no banco de dados para permitir re-processamento mesmo em caso de erro
  try {
    const existingSong = getSongById(songId);
    if (!existingSong) {
      // Criar entrada básica no banco de dados
      const initialSongData = {
        id: songId,
        name: musicName,
        displayName: displayName || musicName.replace(/([A-Z])/g, ' $1').trim(),
        artist: 'Unknown',
        duration: 0,
        files: {
          original: '',
          vocals: '',
          instrumental: '',
          waveform: '',
          lyrics: '',
          video: ''
        },
        metadata: {
          sampleRate: 44100,
          format: 'wav',
          createdAt: new Date().toISOString(),
          lastProcessed: new Date().toISOString()
        },
        band: bandId || undefined
      };
      addSong(initialSongData);
      console.log(`[${fileId}] ✅ Entrada criada no banco de dados: ${songId}`);
    } else {
      console.log(`[${fileId}] ℹ️  Música já existe no banco de dados, atualizando...`);
    }
  } catch (err: any) {
    console.warn(`[${fileId}] ⚠️  Erro ao criar entrada inicial no banco de dados:`, err.message);
  }

  try {
    status.status = 'processing';
    status.step = 'Validando URL do YouTube...';
    status.progress = 5;

    // Validar URL do YouTube
    const youtubePattern = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+$/i;
    if (!youtubePattern.test(youtubeUrl)) {
      throw new Error('URL do YouTube inválida');
    }

    // O script Python já verifica se yt-dlp está instalado
    // Vamos pular a verificação prévia e deixar o script lidar com isso
    // Isso evita problemas com diferentes ambientes Python

    // Criar diretório da música
    const fs = await import('fs/promises');
    await fs.mkdir(musicDir, { recursive: true });

    // Baixar áudio e vídeo do YouTube
    status.step = 'Baixando áudio e vídeo do YouTube...';
    status.progress = 15;

    const downloadScript = join(PROJECT_ROOT, 'youtube-downloader', 'download_audio_and_video.py');
    
    if (!existsSync(downloadScript)) {
      throw new Error('Script de download do YouTube não encontrado. Verifique se o arquivo youtube-downloader/download_audio_and_video.py existe.');
    }

    console.log(`[${fileId}] 📥 Baixando áudio e vídeo do YouTube...`);
    
    let downloadResult;
    try {
      downloadResult = await execPython(
        `python "${downloadScript}" "${youtubeUrl}" "${musicDir}"`,
        undefined,
        `${fileId} [YouTube Download]`,
        (progress: number, message?: string) => {
          const stepProgress = 15 + (progress * 0.15);
          status.progress = Math.round(stepProgress);
          if (message) {
            status.step = `Baixando do YouTube... ${progress}%`;
          }
        }
      );
    } catch (error: any) {
      // Verificar se o erro é relacionado ao yt-dlp não estar instalado
      const errorMessage = error.stderr || error.message || '';
      if (errorMessage.includes('yt-dlp não está instalado') || errorMessage.includes('yt_dlp')) {
        throw new Error('yt-dlp não está instalado. Por favor, instale com: pip install yt-dlp');
      }
      // Re-lançar outros erros
      throw error;
    }

    // Extrair informações do resultado
    let downloadInfo: any = null;
    try {
      const outputLines = downloadResult.stdout.split('\n');
      const jsonStart = outputLines.findIndex(line => line.trim().startsWith('{'));
      if (jsonStart !== -1) {
        const jsonLines = outputLines.slice(jsonStart);
        const jsonStr = jsonLines.join('\n').trim();
        downloadInfo = JSON.parse(jsonStr);
      }
    } catch (err) {
      console.warn(`[${fileId}] ⚠️  Não foi possível extrair informações do download`);
    }

    // Verificar se o vídeo foi baixado
    const videoPath = join(musicDir, 'video.mp4');
    let foundVideo = false;
    let actualVideoPath = videoPath;
    
    if (!existsSync(videoPath)) {
      // Tentar outros formatos de vídeo
      const possibleVideoFormats = ['video.mkv', 'video.webm', 'video.avi', 'video.mov'];
      for (const format of possibleVideoFormats) {
        const testPath = join(musicDir, format);
        if (existsSync(testPath)) {
          console.log(`[${fileId}] 📦 Renomeando vídeo: ${format} -> video.mp4`);
          actualVideoPath = testPath;
          // Não renomear ainda, vamos usar o arquivo original para extrair áudio
          foundVideo = true;
          break;
        }
      }
    } else {
      foundVideo = true;
    }
    
    if (!foundVideo) {
      throw new Error('Vídeo não foi baixado corretamente do YouTube');
    }
    
    console.log(`[${fileId}] ✅ Vídeo baixado: ${actualVideoPath}`);
    
    // Sempre extrair áudio do vídeo usando FFmpeg
    status.step = 'Extraindo áudio do vídeo...';
    status.progress = 30;
    
    const audioPath = join(musicDir, 'temp_audio.wav');
    console.log(`[${fileId}] 🎵 Extraindo áudio do vídeo...`);
    
    // Usar script Python dedicado para extrair áudio do vídeo
    const extractAudioScript = join(PROJECT_ROOT, 'youtube-downloader', 'extract_audio_from_video.py');
    
    if (!existsSync(extractAudioScript)) {
      throw new Error('Script de extração de áudio não encontrado. Verifique se o arquivo youtube-downloader/extract_audio_from_video.py existe.');
    }
    
    try {
      await execPython(
        `python "${extractAudioScript}" "${actualVideoPath}" "${audioPath}"`,
        undefined,
        `${fileId} [Extract Audio]`,
        (progress: number, message?: string) => {
          const stepProgress = 30 + (progress * 0.1);
          status.progress = Math.round(stepProgress);
          if (message) {
            status.step = `Extraindo áudio... ${progress}%`;
          }
        }
      );
    } catch (extractError: any) {
      const errorMessage = extractError.stderr || extractError.message || '';
      if (errorMessage.includes('FFmpeg não está instalado') || errorMessage.includes('ffmpeg')) {
        throw new Error('FFmpeg não está instalado ou não está no PATH. Por favor, instale o FFmpeg: https://ffmpeg.org/download.html');
      }
      throw new Error(`Não foi possível extrair áudio do vídeo. Erro: ${extractError.message}`);
    }
    
    // Verificar se o áudio foi extraído
    if (!existsSync(audioPath)) {
      throw new Error('Falha ao extrair áudio do vídeo - arquivo não foi criado');
    }
    
    const audioSize = statSync(audioPath).size;
    if (audioSize < 100 * 1024) {
      throw new Error('Áudio extraído é muito pequeno, pode estar corrompido');
    }
    
    console.log(`[${fileId}] ✅ Áudio extraído com sucesso! (${(audioSize / 1024 / 1024).toFixed(2)} MB)`);
    
    // Se o vídeo não estava em MP4, renomear agora
    if (actualVideoPath !== videoPath && existsSync(actualVideoPath)) {
      try {
        renameSync(actualVideoPath, videoPath);
        console.log(`[${fileId}] ✅ Vídeo renomeado para MP4`);
      } catch (renameError) {
        console.warn(`[${fileId}] ⚠️  Não foi possível renomear vídeo, mas continuando...`);
      }
    }
    
    console.log(`[${fileId}] ✅ Download e extração concluídos!`);
    console.log(`[${fileId}] 📄 Áudio: ${audioPath}`);
    console.log(`[${fileId}] 🎬 Vídeo: ${videoPath}`);

    // Usar o áudio baixado como tempPath e processar normalmente
    status.step = 'Iniciando processamento de áudio...';
    status.progress = 30;

    // Processar música usando o pipeline existente
    // Recuperar bandId da música existente se disponível
    const existingSong = getSongById(songId);
    const songBandId = existingSong?.band;
    await processMusic(fileId, audioPath, musicDir, songId, musicName, displayName, songBandId);

    // Atualizar banco de dados com informações do vídeo se disponível
    if (downloadInfo && existsSync(videoPath)) {
      try {
        const song = getSongById(songId);
        if (song) {
          const updatedFiles = { ...song.files, video: 'video.mp4' };
          updateSong(songId, {
            ...song,
            files: updatedFiles,
            video: {
              id: downloadInfo.id,
              title: downloadInfo.title,
              url: downloadInfo.url,
              thumbnail: downloadInfo.thumbnail,
              duration: downloadInfo.duration,
              uploader: downloadInfo.uploader,
              view_count: downloadInfo.view_count,
              file: 'video.mp4'
            }
          });
          console.log(`[${fileId}] ✅ Informações do vídeo atualizadas no banco de dados`);
        }
      } catch (err: any) {
        console.warn(`[${fileId}] ⚠️  Erro ao atualizar informações do vídeo:`, err.message);
      }
    }

    console.log(`\n[${fileId}] 🎉 Processamento do YouTube concluído com sucesso!`);
    
  } catch (error: any) {
    status.status = 'error';
    
    // Salvar progresso atual no banco de dados mesmo em caso de erro
    try {
      console.log(`[${fileId}] 💾 Salvando progresso atual no banco de dados antes de finalizar...`);
      const song = getSongById(songId);
      if (song) {
        // Verificar quais arquivos foram processados
        const vocalsPath = join(musicDir, 'vocals.wav');
        const instrumentalPath = join(musicDir, 'instrumental.wav');
        const waveformPath = join(musicDir, 'waveform.json');
        const lyricsPath = join(musicDir, 'lyrics.lrc');
        const videoPath = join(musicDir, 'video.mp4');
        const audioPath = join(musicDir, 'temp_audio.wav');
        
        const updatedFiles = {
          ...song.files,
          vocals: existsSync(vocalsPath) ? 'vocals.wav' : song.files.vocals,
          instrumental: existsSync(instrumentalPath) ? 'instrumental.wav' : song.files.instrumental,
          waveform: existsSync(waveformPath) ? 'waveform.json' : song.files.waveform,
          lyrics: existsSync(lyricsPath) ? 'lyrics.lrc' : song.files.lyrics,
          video: existsSync(videoPath) ? 'video.mp4' : song.files.video
        };
        
        // Tentar obter duração do waveform se disponível
        let duration = song.duration;
        try {
          if (existsSync(waveformPath)) {
            const waveformData = await import('fs/promises').then(fs => 
              fs.readFile(waveformPath, 'utf-8')
            ).then(data => JSON.parse(data));
            duration = waveformData.duration || duration;
          }
        } catch (err) {
          // Ignorar erro ao ler waveform
        }
        
        updateSong(songId, {
          ...song,
          files: updatedFiles,
          duration: duration,
          metadata: {
            ...song.metadata,
            lastProcessed: new Date().toISOString()
          }
        });
        console.log(`[${fileId}] ✅ Progresso salvo no banco de dados (permitindo re-processamento)`);
      } else {
        // Se não existe, criar entrada básica
        const vocalsPath = join(musicDir, 'vocals.wav');
        const instrumentalPath = join(musicDir, 'instrumental.wav');
        const waveformPath = join(musicDir, 'waveform.json');
        const lyricsPath = join(musicDir, 'lyrics.lrc');
        const videoPath = join(musicDir, 'video.mp4');
        
        const initialSongData = {
          id: songId,
          name: musicName,
          displayName: displayName || musicName.replace(/([A-Z])/g, ' $1').trim(),
          artist: 'Unknown',
          duration: 0,
          files: {
            original: '',
            vocals: existsSync(vocalsPath) ? 'vocals.wav' : '',
            instrumental: existsSync(instrumentalPath) ? 'instrumental.wav' : '',
            waveform: existsSync(waveformPath) ? 'waveform.json' : '',
            lyrics: existsSync(lyricsPath) ? 'lyrics.lrc' : '',
            video: existsSync(videoPath) ? 'video.mp4' : ''
          },
          metadata: {
            sampleRate: 44100,
            format: 'wav',
            createdAt: new Date().toISOString(),
            lastProcessed: new Date().toISOString()
          }
        };
        addSong(initialSongData);
        console.log(`[${fileId}] ✅ Entrada criada no banco de dados com progresso atual`);
      }
    } catch (saveError: any) {
      console.error(`[${fileId}] ⚠️  Erro ao salvar progresso no banco de dados:`, saveError.message);
    }
    
    // Melhorar mensagem de erro para yt-dlp
    let errorMessage = error.message;
    if (error.stderr && error.stderr.includes('yt-dlp não está instalado')) {
      errorMessage = 'yt-dlp não está instalado. Por favor, instale com: pip install yt-dlp';
    } else if (error.message && error.message.includes('yt-dlp não está instalado')) {
      errorMessage = 'yt-dlp não está instalado. Por favor, instale com: pip install yt-dlp';
    } else if (error.stderr) {
      // Incluir informações do stderr se disponível
      errorMessage = `${error.message}\n\nDetalhes: ${error.stderr}`;
    }
    
    status.error = errorMessage;
    status.step = 'Erro no processamento do YouTube';
    
    console.error(`\n${'='.repeat(60)}`);
    console.error(`[${fileId}] ❌ ERRO durante o processamento do YouTube:`);
    console.error(`[${fileId}] 📝 Mensagem: ${errorMessage}`);
    if (error.stderr) {
      console.error(`[${fileId}] 📤 stderr: ${error.stderr}`);
    }
    if (error.stdout) {
      console.error(`[${fileId}] 📥 stdout: ${error.stdout}`);
    }
    if (error.stack) {
      console.error(`[${fileId}] 📚 Stack trace:`, error.stack);
    }
    console.error(`${'='.repeat(60)}\n`);
    
    // Clean up status after 1 hour even on error
    setTimeout(() => {
      processingStatus.delete(fileId);
      console.log(`[${fileId}] 🧹 Status de processamento removido (limpeza automática)`);
    }, PROCESSING_CONFIG.STATUS_CLEANUP_TIME);
  }
}
