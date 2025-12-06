#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para extrair apenas a voz de um arquivo de áudio usando Demucs (Meta).
Extrai o stem de vocais e salva em alta qualidade na pasta output/.
"""

import sys
import argparse
from pathlib import Path
import io

# Configurar encoding UTF-8 para Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

try:
    import torch
    import torchaudio
    import soundfile as sf
    from demucs.pretrained import get_model
    from demucs.apply import apply_model
    from demucs.audio import AudioFile
except ImportError as e:
    print(f"Erro: Dependências não instaladas. Execute: pip install -r requirements.txt")
    print(f"Detalhes: {e}")
    sys.exit(1)


def extract_vocals(input_file, output_dir=None, model_name="htdemucs", device=None):
    """
    Extrai apenas a voz de um arquivo de áudio usando Demucs.
    
    Args:
        input_file (str): Caminho para o arquivo de áudio de entrada
        output_dir (str): Diretório onde salvar o arquivo de saída
        model_name (str): Nome do modelo Demucs a usar (htdemucs é o mais recente)
        device (str): Dispositivo a usar ('cuda' para GPU ou 'cpu' para CPU)
    """
    
    # 1. Verificar se o arquivo de entrada existe
    input_path = Path(input_file)
    if not input_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {input_file}")
    
    print(f"📁 Arquivo de entrada: {input_path}")
    
    # 2. Criar diretório de saída se não existir
    # Se output_dir foi fornecido, usar diretamente (não tentar detectar automaticamente)
    if output_dir is not None:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        output_filename = "vocals.wav"
    else:
        # Se não especificado, usar a nova estrutura: music/[nome]/
        audio_name = input_path.stem
        # Subir níveis até a raiz do projeto
        current_dir = input_path.parent
        # Se está em just-voice/, subir um nível
        if current_dir.name == 'just-voice':
            project_root = current_dir.parent
        else:
            # Tentar encontrar a raiz (onde está a pasta music/)
            project_root = current_dir
            # Procurar pela pasta music/ subindo diretórios
            test_path = project_root
            for _ in range(3):  # Máximo 3 níveis
                if (test_path / "music").exists():
                    project_root = test_path
                    break
                test_path = test_path.parent
        
        output_path = project_root / "music" / audio_name
        output_path.mkdir(parents=True, exist_ok=True)
        output_filename = "vocals.wav"
    
    output_file = output_path / output_filename
    print(f"📂 Diretório de saída: {output_path.absolute()}")
    
    # 3. Detectar dispositivo (GPU se disponível, senão CPU)
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"🖥️  Usando dispositivo: {device}")
    
    # 4. Carregar o modelo Demucs pré-treinado
    print(f"🤖 Carregando modelo Demucs ({model_name})...")
    model = get_model(model_name)
    model.to(device)
    model.eval()
    print("✅ Modelo carregado com sucesso!")
    
    # Obter informações do modelo (pode ser BagOfModels ou modelo único)
    # BagOfModels não tem sample_rate diretamente, precisa acessar o modelo interno
    if hasattr(model, 'models') and len(model.models) > 0:
        # É um BagOfModels, pegar o primeiro modelo interno
        inner_model = model.models[0]
        sample_rate = inner_model.samplerate
        audio_channels = inner_model.audio_channels
    else:
        # É um modelo único
        sample_rate = getattr(model, 'samplerate', getattr(model, 'sample_rate', 44100))
        audio_channels = getattr(model, 'audio_channels', 2)
    
    # 5. Carregar e processar o arquivo de áudio
    print(f"🎵 Carregando arquivo de áudio...")
    wav = AudioFile(input_path).read(streams=0, samplerate=sample_rate, channels=audio_channels)
    
    # Converter para numpy se for tensor
    if isinstance(wav, torch.Tensor):
        wav_np = wav.cpu().numpy()
    else:
        wav_np = wav
    
    # Normalizar o áudio
    ref = wav_np.mean(0)
    wav_np = (wav_np - ref.mean()) / ref.std()
    
    # Converter para tensor e preparar para o modelo
    wav_tensor = torch.from_numpy(wav_np).float()
    if len(wav_tensor.shape) == 1:
        wav_tensor = wav_tensor.unsqueeze(0)
    wav_tensor = wav_tensor.unsqueeze(0).to(device)
    
    print(f"   Taxa de amostragem: {sample_rate} Hz")
    print(f"   Canais: {audio_channels}")
    print(f"   Duração: {wav_tensor.shape[-1] / sample_rate:.2f} segundos")
    
    # 6. Aplicar o modelo para separar os stems
    print(f"🎤 Separando stems de áudio (isso pode levar alguns minutos)...")
    with torch.no_grad():
        sources = apply_model(model, wav_tensor, shifts=1, split=True, overlap=0.25, progress=True)
    
    # 7. Extrair apenas o stem de vocais
    # O modelo htdemucs separa em: [drums, bass, other, vocals]
    stems = ["drums", "bass", "other", "vocals"]
    vocals_idx = stems.index("vocals")
    
    print(f"🎙️  Extraindo stem de vocais...")
    vocals = sources[0, vocals_idx].cpu()
    
    # Desnormalizar o áudio
    ref_tensor = torch.from_numpy(ref)
    vocals = vocals * ref_tensor.std() + ref_tensor.mean()
    
    # Converter para numpy para salvar com soundfile
    vocals_np = vocals.numpy()
    
    # Transpor se necessário (soundfile espera [samples, channels])
    if vocals_np.shape[0] < vocals_np.shape[-1]:
        vocals_np = vocals_np.T

    # 8. Arquivo de saída já foi definido acima
    
    # 9. Salvar o arquivo de vocais usando soundfile
    print(f"💾 Salvando arquivo de vocais...")
    sf.write(str(output_file), vocals_np, sample_rate, subtype='PCM_24')
    
    print(f"✅ Vocais extraídos com sucesso!")
    print(f"📄 Arquivo salvo em: {output_file.absolute()}")
    
    return str(output_file.absolute())


def main():
    """
    Função principal do script.
    """
    parser = argparse.ArgumentParser(
        description="Extrai apenas a voz de um arquivo de áudio usando Demucs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos:
  python extract_voice.py musica.mp3
  python extract_voice.py musica.wav --output minha_pasta
  python extract_voice.py musica.m4a --model htdemucs_ft
        """
    )
    
    parser.add_argument(
        "input_file",
        type=str,
        help="Arquivo de áudio de entrada (mp3, wav, m4a, etc.)"
    )
    
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default="output",
        help="Diretório de saída (padrão: output/)"
    )
    
    parser.add_argument(
        "--model",
        "-m",
        type=str,
        default="htdemucs",
        choices=["htdemucs", "htdemucs_ft", "mdx_extra"],
        help="Modelo Demucs a usar (padrão: htdemucs - o mais recente)"
    )
    
    parser.add_argument(
        "--device",
        "-d",
        type=str,
        choices=["cuda", "cpu"],
        default=None,
        help="Dispositivo a usar (cuda para GPU, cpu para CPU). Se não especificado, usa GPU se disponível."
    )
    
    args = parser.parse_args()
    
    try:
        # Executar extração de vocais
        output_file = extract_vocals(
            input_file=args.input_file,
            output_dir=args.output,
            model_name=args.model,
            device=args.device
        )
        
        print("\n" + "="*50)
        print("🎉 Processamento concluído com sucesso!")
        print("="*50)
        
    except Exception as e:
        print(f"\n❌ Erro durante o processamento: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

