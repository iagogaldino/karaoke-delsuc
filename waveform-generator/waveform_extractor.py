"""
Script para extrair waveform de arquivo de áudio de voz
Gera arquivo JSON com valores e imagem PNG com visualização
"""

import librosa
import numpy as np
import matplotlib.pyplot as plt
import json
import os
import sys
import io

# Configurar encoding UTF-8 para Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


def extract_waveform(audio_file='voz.wav', output_json='waveform.json', output_image='waveform.png', 
                     json_folder=None, image_folder=None, use_new_structure=True):
    """
    Extrai a waveform de um arquivo de áudio e gera JSON e imagem
    
    Args:
        audio_file: Caminho do arquivo de áudio de entrada (padrão: voz.wav)
        output_json: Nome do arquivo JSON de saída (padrão: waveform.json)
        output_image: Nome do arquivo PNG de saída (padrão: waveform.png)
        json_folder: Pasta para salvar arquivos JSON (padrão: json)
        image_folder: Pasta para salvar arquivos PNG (padrão: images)
    """
    
    # Verifica se o arquivo de áudio existe
    if not os.path.exists(audio_file):
        print(f"Erro: Arquivo '{audio_file}' não encontrado!")
        sys.exit(1)
    
    # Determinar pasta de saída
    # Se json_folder ou image_folder foram fornecidos, usar diretamente (não tentar detectar automaticamente)
    if json_folder is not None or image_folder is not None:
        # Usar os diretórios fornecidos
        if json_folder is None:
            json_folder = image_folder
        if image_folder is None:
            image_folder = json_folder
        output_json = 'waveform.json'
        output_image = 'waveform.png'
    elif use_new_structure:
        # Se use_new_structure está ativo e nenhum diretório foi fornecido, tentar detectar automaticamente
        # Usar nova estrutura: music/[nome]/
        # Se o arquivo de entrada já está em music/[nome]/, usar esse diretório
        audio_file_abs = os.path.abspath(audio_file)
        audio_dir = os.path.dirname(audio_file_abs)
        
        # Normalizar o caminho para garantir compatibilidade com Windows
        audio_dir = os.path.normpath(audio_dir)
        
        # Verificar se o arquivo está dentro de music/[nome]/
        # Usar os.path.join para garantir compatibilidade entre sistemas
        parts = audio_dir.split(os.sep)
        music_index = -1
        for i, part in enumerate(parts):
            if part == 'music' and i + 1 < len(parts):
                music_index = i
                break
        
        if music_index >= 0:
            # Usar o diretório music/[nome]/
            # Reconstruir o caminho usando os.path.join
            target_dir = os.sep.join(parts[:music_index + 2])  # music/[nome]
            target_dir = os.path.normpath(target_dir)
            
            # Sempre sobrescrever para usar o diretório correto quando detectado
            json_folder = target_dir
            image_folder = target_dir
            output_json = 'waveform.json'  # Nome fixo na nova estrutura
            output_image = 'waveform.png'  # Nome fixo na nova estrutura
        else:
            # Fallback: usar nome do arquivo
            audio_name = os.path.splitext(os.path.basename(audio_file))[0]
            # Subir níveis até a raiz do projeto
            current_dir = audio_dir
            project_root = current_dir
            test_path = project_root
            for _ in range(5):  # Máximo 5 níveis
                if os.path.exists(os.path.join(test_path, 'music')):
                    project_root = test_path
                    break
                parent = os.path.dirname(test_path)
                if parent == test_path:  # Chegou na raiz
                    break
                test_path = parent
            
            target_dir = os.path.join(project_root, 'music', audio_name)
            target_dir = os.path.normpath(target_dir)
            if json_folder is None:
                json_folder = target_dir
            if image_folder is None:
                image_folder = target_dir
            output_json = 'waveform.json'
            output_image = 'waveform.png'
    
    # Garantir valores padrão se ainda forem None (fallback para estrutura antiga)
    if json_folder is None:
        json_folder = 'wave_json'
    if image_folder is None:
        image_folder = 'wave_images'
    
    # Cria as pastas de saída se não existirem
    os.makedirs(json_folder, exist_ok=True)
    os.makedirs(image_folder, exist_ok=True)
    print(f"Pastas criadas/verificadas: '{json_folder}' e '{image_folder}'")
    
    print(f"Carregando áudio: {audio_file}")
    
    # Carrega o áudio no formato mono usando librosa
    # sr=None mantém a taxa de amostragem original
    # mono=True converte para mono (canal único)
    audio_data, sample_rate = librosa.load(audio_file, sr=None, mono=True)
    
    print(f"Taxa de amostragem: {sample_rate} Hz")
    print(f"Duração: {len(audio_data) / sample_rate:.2f} segundos")
    print(f"Número de amostras: {len(audio_data)}")
    
    # Normaliza a waveform entre -1 e 1
    # Encontra o valor máximo absoluto
    max_value = np.max(np.abs(audio_data))
    
    if max_value > 0:
        # Divide todos os valores pelo máximo absoluto para normalizar
        normalized_waveform = audio_data / max_value
    else:
        # Se o áudio estiver silencioso, mantém os valores originais
        normalized_waveform = audio_data
        print("Aviso: Áudio parece estar silencioso (valores próximos de zero)")
    
    # Verifica se a normalização está correta
    min_val = np.min(normalized_waveform)
    max_val = np.max(normalized_waveform)
    print(f"Valores normalizados - Min: {min_val:.6f}, Max: {max_val:.6f}")
    
    # Converte para lista Python para serialização JSON
    # Usa float32 para reduzir tamanho do arquivo mantendo precisão
    waveform_list = normalized_waveform.astype(np.float32).tolist()
    
    # Prepara dados para JSON
    waveform_data = {
        "sample_rate": int(sample_rate),
        "duration": float(len(normalized_waveform) / sample_rate),
        "num_samples": len(normalized_waveform),
        "waveform": waveform_list
    }
    
    # Monta o caminho completo do arquivo JSON na pasta específica
    json_path = os.path.join(json_folder, output_json)
    
    # Salva o arquivo JSON
    print(f"\nSalvando waveform em: {json_path}")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(waveform_data, f, indent=2)
    
    print(f"Arquivo JSON criado com sucesso! ({len(waveform_list)} valores)")
    
    # Monta o caminho completo do arquivo PNG na pasta específica
    image_path = os.path.join(image_folder, output_image)
    
    # Gera a visualização da waveform
    print(f"\nGerando imagem: {image_path}")
    
    # Para áudios muito longos, faz downsampling para visualização
    # Mantém no máximo 100.000 pontos para renderização eficiente
    max_points = 100000
    if len(normalized_waveform) > max_points:
        # Calcula o fator de downsampling
        downsample_factor = len(normalized_waveform) // max_points
        # Faz downsampling mantendo a forma geral da onda
        waveform_plot = normalized_waveform[::downsample_factor]
        time_axis_plot = np.linspace(0, len(normalized_waveform) / sample_rate, len(waveform_plot))
        print(f"Downsampling aplicado para visualização: {len(normalized_waveform)} -> {len(waveform_plot)} pontos")
    else:
        # Usa todos os pontos se o áudio for curto
        waveform_plot = normalized_waveform
        time_axis_plot = np.linspace(0, len(normalized_waveform) / sample_rate, len(normalized_waveform))
    
    # Cria a figura com tamanho adequado
    plt.figure(figsize=(14, 6))
    
    # Plota a waveform
    plt.plot(time_axis_plot, waveform_plot, linewidth=0.5, color='#2E86AB')
    plt.fill_between(time_axis_plot, waveform_plot, 0, alpha=0.3, color='#2E86AB')
    
    # Configurações do gráfico
    plt.title('Waveform do Áudio de Voz', fontsize=16, fontweight='bold', pad=20)
    plt.xlabel('Tempo (segundos)', fontsize=12)
    plt.ylabel('Amplitude (normalizada)', fontsize=12)
    plt.grid(True, alpha=0.3, linestyle='--')
    plt.xlim(0, time_axis_plot[-1])
    plt.ylim(-1.1, 1.1)
    
    # Adiciona informações no gráfico
    info_text = f"Taxa de amostragem: {sample_rate} Hz | Duração: {time_axis_plot[-1]:.2f}s | Amostras: {len(normalized_waveform)}"
    plt.figtext(0.5, 0.02, info_text, ha='center', fontsize=9, style='italic')
    
    # Ajusta layout para evitar cortes
    plt.tight_layout()
    
    # Salva a imagem
    plt.savefig(image_path, dpi=150, bbox_inches='tight')
    plt.close()
    
    print(f"Imagem PNG criada com sucesso!")
    
    # Resumo final
    print("\n" + "="*60)
    print("Extração concluída com sucesso!")
    print("="*60)
    print(f"Arquivo JSON: {json_path}")
    print(f"Arquivo PNG: {image_path}")
    print(f"Total de valores na waveform: {len(waveform_list)}")
    print("="*60)


if __name__ == "__main__":
    # Permite passar o arquivo de áudio como argumento da linha de comando
    if len(sys.argv) > 1:
        audio_file = sys.argv[1]
    else:
        audio_file = 'voz.wav'
    
    # Extrai o nome base do arquivo de áudio (sem extensão) para usar nos arquivos de saída
    audio_basename = os.path.splitext(os.path.basename(audio_file))[0]
    
    # Permite passar o nome do arquivo JSON como segundo argumento
    # Se não for especificado, usa o nome do áudio
    if len(sys.argv) > 2:
        output_json = sys.argv[2]
    else:
        output_json = f'{audio_basename}.json'
    
    # Permite passar o nome do arquivo PNG como terceiro argumento
    # Se não for especificado, usa o nome do áudio
    if len(sys.argv) > 3:
        output_image = sys.argv[3]
    else:
        output_image = f'{audio_basename}.png'
    
    # Permite passar a pasta JSON como quarto argumento
    # Se não for passado, deixar None para detecção automática
    if len(sys.argv) > 4:
        json_folder = sys.argv[4]
    else:
        json_folder = None  # Será determinado automaticamente pela função
    
    # Permite passar a pasta de imagens como quinto argumento
    if len(sys.argv) > 5:
        image_folder = sys.argv[5]
    else:
        image_folder = None  # Será determinado automaticamente pela função
    
    # Executa a extração
    extract_waveform(audio_file, output_json, output_image, json_folder, image_folder, use_new_structure=True)

