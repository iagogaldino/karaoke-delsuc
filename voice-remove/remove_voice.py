#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para remover voz de arquivos de áudio usando demucs
"""

import os
import sys
from pathlib import Path
import io

# Configurar encoding UTF-8 para Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
import torch
import torchaudio
from demucs.pretrained import get_model
from demucs.apply import apply_model
from demucs.audio import convert_audio
# Verificar disponibilidade de pydub
try:
    from pydub import AudioSegment
    PYDUB_AVAILABLE = True
except ImportError:
    PYDUB_AVAILABLE = False

# Verificar disponibilidade de soundfile (sempre verificar, independente de pydub)
try:
    import soundfile as sf
    SOUNDFILE_AVAILABLE = True
except ImportError:
    SOUNDFILE_AVAILABLE = False

def remove_voice(input_file, output_file=None, output_dir=None, use_new_structure=True):
    """
    Remove a voz de um arquivo de áudio usando demucs
    
    Args:
        input_file: Caminho para o arquivo de áudio de entrada
        output_file: Caminho para o arquivo de saída (opcional)
        output_dir: Pasta onde salvar o arquivo processado (opcional, padrão: "output")
    """
    # Verificar se o arquivo existe
    if not os.path.exists(input_file):
        print(f"Erro: Arquivo não encontrado: {input_file}")
        return False
    
    input_path = Path(input_file)
    
    # Definir pasta de saída
    # Se output_dir foi fornecido, usar diretamente (não tentar detectar automaticamente)
    if output_dir is not None:
        # output_dir foi fornecido (nova estrutura com songId)
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        if output_file is None:
            # Usar nome fixo "instrumental.wav" quando output_dir é fornecido
            output_file = output_dir / "instrumental.wav"
        else:
            output_file = Path(output_file)
            if not output_file.is_absolute():
                output_file = output_dir / output_file
            else:
                # Se for absoluto, criar a pasta pai se necessário
                output_file.parent.mkdir(parents=True, exist_ok=True)
    elif use_new_structure:
        # Usar nova estrutura: music/[nome]/ (só quando output_dir não foi fornecido)
        audio_name = input_path.stem
        current_dir = input_path.parent
        
        # Se o arquivo está em temp/, subir para a raiz do projeto
        if current_dir.name == 'temp':
            project_root = current_dir.parent
        elif current_dir.name in ['voice-remove', 'just-voice', 'waveform-generator']:
            project_root = current_dir.parent
        else:
            # Procurar pela pasta music/ subindo diretórios
            project_root = current_dir
            test_path = project_root
            for _ in range(5):  # Máximo 5 níveis
                if (test_path / "music").exists():
                    project_root = test_path
                    break
                parent = test_path.parent
                if parent == test_path:  # Chegou na raiz
                    break
                test_path = parent
        
        output_dir = project_root / "music" / audio_name
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / "instrumental.wav"
    else:
        # Comportamento antigo
        output_dir = Path(input_path.parent) / "output"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / f"{input_path.stem}_no_vocals.wav"
    
    print(f"Carregando modelo demucs...")
    # Carregar o modelo pré-treinado (htdemucs é um dos melhores)
    model = get_model('htdemucs')
    model.eval()
    
    # Obter sample rate e número de canais do modelo
    # Se for BagOfModels, pegar do primeiro modelo
    if hasattr(model, 'samplerate'):
        model_sr = model.samplerate
        model_channels = model.chin if hasattr(model, 'chin') else 2
    elif hasattr(model, 'models') and len(model.models) > 0:
        # Tentar acessar o modelo interno
        inner_model = model.models[0]
        model_sr = getattr(inner_model, 'sample_rate', getattr(inner_model, 'samplerate', 44100))
        model_channels = getattr(inner_model, 'chin', 2)
    else:
        # Valores padrão do htdemucs
        model_sr = 44100
        model_channels = 2
    
    print(f"Processando arquivo: {input_file}")
    print("Isso pode levar alguns minutos...")
    
    # Carregar o áudio - tentar diferentes métodos
    wav = None
    sr = None
    
    # Método 1: Tentar com pydub (melhor para MP3)
    if PYDUB_AVAILABLE:
        try:
            print("Carregando áudio com pydub...")
            audio = AudioSegment.from_file(input_file)
            sr = audio.frame_rate
            # Converter para numpy array e depois para tensor
            import numpy as np
            samples = np.array(audio.get_array_of_samples())
            if audio.channels == 2:
                samples = samples.reshape((-1, 2)).T
            else:
                samples = samples.reshape((1, -1))
            wav = torch.from_numpy(samples).float() / 32768.0
        except Exception as e:
            print(f"Erro com pydub: {e}")
    
    # Método 2: Tentar com soundfile
    if wav is None and SOUNDFILE_AVAILABLE:
        try:
            print("Carregando áudio com soundfile...")
            import soundfile as sf
            data, sr = sf.read(input_file)
            if len(data.shape) == 1:
                wav = torch.from_numpy(data).unsqueeze(0).float()
            else:
                wav = torch.from_numpy(data).T.float()
        except Exception as e:
            print(f"Erro com soundfile: {e}")
    
    # Método 3: Tentar com torchaudio (pode precisar de torchcodec)
    if wav is None:
        try:
            print("Carregando áudio com torchaudio...")
            wav, sr = torchaudio.load(input_file, backend="soundfile")
        except Exception as e:
            print(f"Erro com torchaudio: {e}")
            # Última tentativa: converter MP3 para WAV temporariamente
            if input_file.lower().endswith('.mp3'):
                print("Tentando converter MP3 para WAV temporariamente...")
                try:
                    if PYDUB_AVAILABLE:
                        audio = AudioSegment.from_mp3(input_file)
                        temp_wav = str(Path(input_file).with_suffix('.temp.wav'))
                        audio.export(temp_wav, format="wav")
                        wav, sr = torchaudio.load(temp_wav, backend="soundfile")
                        os.remove(temp_wav)
                    else:
                        raise ImportError("pydub não está disponível")
                except Exception as e2:
                    print(f"Erro na conversão: {e2}")
                    raise
    
    if wav is None:
        raise RuntimeError("Não foi possível carregar o arquivo de áudio. Tente instalar: pip install pydub soundfile")
    
    # Converter para o formato esperado pelo demucs
    # O demucs espera: [channels, samples] com sample rate correto
    wav = convert_audio(wav, sr, model_sr, model_channels)
    
    # Aplicar o modelo para separar as fontes
    # O demucs separa em: drums, bass, other, vocals
    with torch.no_grad():
        sources = apply_model(model, wav[None], device='cpu', split=True, overlap=0.25, shifts=1)
    
    # sources tem formato [batch, sources, channels, samples]
    # Fontes: [drums, bass, other, vocals]
    drums = sources[0, 0]  # bateria
    bass = sources[0, 1]    # baixo
    other = sources[0, 2]   # outros instrumentos
    vocals = sources[0, 3]  # vocais
    
    # Combinar tudo exceto os vocais para criar a versão instrumental
    instrumental = drums + bass + other
    
    # Normalizar para evitar clipping
    max_val = instrumental.abs().max()
    if max_val > 0:
        instrumental = instrumental / max_val * 0.95
    
    # Salvar o resultado
    print(f"Salvando resultado em: {output_file}")
    
    # Converter para numpy para salvar
    import numpy as np
    audio_data = instrumental.cpu().numpy()
    
    # Se for MP3, salvar como WAV primeiro ou usar pydub
    if str(output_file).lower().endswith('.mp3'):
        if PYDUB_AVAILABLE:
            # Converter tensor para formato do pydub
            if audio_data.shape[0] == 1:
                # Mono
                samples = (audio_data[0] * 32768.0).astype(np.int16)
            else:
                # Stereo
                samples = (audio_data.T * 32768.0).astype(np.int16)
            
            audio_segment = AudioSegment(
                samples.tobytes(),
                frame_rate=int(model_sr),
                channels=instrumental.shape[0],
                sample_width=2
            )
            audio_segment.export(str(output_file), format="mp3", bitrate="192k")
        else:
            # Salvar como WAV se pydub não estiver disponível
            wav_output = str(output_file).replace('.mp3', '.wav')
            if SOUNDFILE_AVAILABLE:
                import soundfile as sf
                sf.write(wav_output, audio_data.T, int(model_sr))
                print(f"Arquivo salvo como WAV (pydub necessário para MP3): {wav_output}")
            else:
                torchaudio.save(wav_output, instrumental, int(model_sr), backend="soundfile")
                print(f"Arquivo salvo como WAV (pydub necessário para MP3): {wav_output}")
    else:
        # Salvar como WAV ou outro formato suportado
        if SOUNDFILE_AVAILABLE:
            import soundfile as sf
            sf.write(str(output_file), audio_data.T, int(model_sr))
        else:
            torchaudio.save(str(output_file), instrumental, int(model_sr), backend="soundfile")
    
    print(f"✓ Concluído! Arquivo salvo em: {output_file}")
    return True

if __name__ == "__main__":
    input_file = r"C:\Users\iago_\Desktop\Projects\Karaoke\v4\voice-remove\AlceuValenca.mp3"
    output_file = None
    output_dir = None
    
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    
    if len(sys.argv) > 2:
        # Se o segundo argumento for uma pasta (termina sem extensão ou é um diretório)
        arg2 = sys.argv[2]
        if os.path.isdir(arg2) or (not Path(arg2).suffix and not arg2.endswith('.mp3') and not arg2.endswith('.wav')):
            output_dir = arg2
        else:
            output_file = arg2
    
    if len(sys.argv) > 3:
        output_dir = sys.argv[3]
    
    try:
        remove_voice(input_file, output_file, output_dir, use_new_structure=True)
    except Exception as e:
        print(f"Erro ao processar: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

