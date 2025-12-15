#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script principal de pós-processamento de LRC
Melhora o LRC gerado pelo Whisper usando análise de áudio
"""

import sys
import argparse
from pathlib import Path

# Adicionar diretório atual ao path para imports
sys.path.insert(0, str(Path(__file__).parent))

from lrc_parser import parse_lrc_file, write_lrc_file, format_lrc_time
from audio_analyzer import validate_lrc_timestamps, get_audio_duration
from word_detector import detect_dragged_words


def post_process_lrc(lrc_path: str, audio_path: str, output_path: str, 
                    silence_threshold: float = 0.01, duration_threshold: float = 1.5) -> str:
    """
    Pós-processa um arquivo LRC usando análise de áudio.
    
    Args:
        lrc_path: Caminho para o arquivo LRC original
        audio_path: Caminho para o arquivo de áudio vocals.wav
        output_path: Caminho para salvar o LRC processado
        silence_threshold: Threshold para detecção de silêncio
        duration_threshold: Multiplicador para detectar palavras arrastadas
        
    Returns:
        Caminho do arquivo processado
    """
    print(f"📝 Carregando LRC: {lrc_path}")
    
    # 1. Parsear LRC existente
    lrc_lines = parse_lrc_file(lrc_path)
    print(f"✅ Parseadas {len(lrc_lines)} linhas LRC")
    
    if not lrc_lines:
        print("⚠️  Nenhuma linha LRC encontrada, copiando arquivo original")
        import shutil
        shutil.copy(lrc_path, output_path)
        return output_path
    
    # 2. Validar timestamps com análise de áudio
    print(f"🎵 Validando timestamps com áudio: {audio_path}")
    validation_results = validate_lrc_timestamps(audio_path, lrc_lines, threshold=silence_threshold)
    
    # 3. Filtrar linhas que caem em silêncio
    filtered_lines = []
    removed_count = 0
    
    for i, (line, is_valid) in enumerate(zip(lrc_lines, validation_results)):
        if is_valid:
            filtered_lines.append(line)
        else:
            removed_count += 1
            print(f"  ⚠️  Removendo linha {i+1} (silêncio): [{format_lrc_time(line['time'])}] {line['text'][:50]}")
    
    print(f"✅ Removidas {removed_count} linhas sem atividade vocal")
    print(f"✅ Mantidas {len(filtered_lines)} linhas válidas")
    
    if not filtered_lines:
        print("⚠️  Todas as linhas foram removidas, mantendo original")
        filtered_lines = lrc_lines
    
    # 4. Detectar e melhorar palavras arrastadas
    print(f"🔍 Detectando palavras arrastadas...")
    improved_lines = detect_dragged_words(audio_path, filtered_lines, 
                                         duration_threshold=duration_threshold)
    
    # Contar melhorias
    improved_count = 0
    for original, improved in zip(filtered_lines, improved_lines):
        if original['text'] != improved['text']:
            improved_count += 1
            print(f"  ✨ Melhorada: '{original['text'][:30]}' → '{improved['text'][:30]}'")
    
    print(f"✅ {improved_count} palavras arrastadas detectadas e melhoradas")
    
    # 5. Salvar LRC processado
    print(f"💾 Salvando LRC processado: {output_path}")
    write_lrc_file(improved_lines, output_path)
    
    print(f"✅ Pós-processamento concluído!")
    print(f"   - Linhas originais: {len(lrc_lines)}")
    print(f"   - Linhas removidas (silêncio): {removed_count}")
    print(f"   - Palavras melhoradas: {improved_count}")
    print(f"   - Linhas finais: {len(improved_lines)}")
    
    return output_path


def main():
    """
    Função principal do script.
    """
    parser = argparse.ArgumentParser(
        description='Pós-processa arquivo LRC usando análise de áudio',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos:
  python post_process_lrc.py lyrics.lrc vocals.wav lyrics_processed.lrc
  python post_process_lrc.py lyrics.lrc vocals.wav lyrics.lrc --silence-threshold 0.02
        """
    )
    
    parser.add_argument('lrc_path', help='Caminho para o arquivo LRC original')
    parser.add_argument('audio_path', help='Caminho para o arquivo de áudio vocals.wav')
    parser.add_argument('output_path', help='Caminho para salvar o LRC processado')
    parser.add_argument('--silence-threshold', type=float, default=0.01,
                       help='Threshold para detecção de silêncio (padrão: 0.01)')
    parser.add_argument('--duration-threshold', type=float, default=1.5,
                       help='Multiplicador para detectar palavras arrastadas (padrão: 1.5)')
    
    args = parser.parse_args()
    
    # Validar arquivos
    lrc_path = Path(args.lrc_path)
    audio_path = Path(args.audio_path)
    
    if not lrc_path.exists():
        print(f"❌ Erro: Arquivo LRC não encontrado: {lrc_path}")
        sys.exit(1)
    
    if not audio_path.exists():
        print(f"❌ Erro: Arquivo de áudio não encontrado: {audio_path}")
        sys.exit(1)
    
    # Criar diretório de saída se necessário
    output_path = Path(args.output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    try:
        # Processar LRC
        result_path = post_process_lrc(
            str(lrc_path),
            str(audio_path),
            str(output_path),
            silence_threshold=args.silence_threshold,
            duration_threshold=args.duration_threshold
        )
        
        print(f"\n✨ Processo concluído com sucesso!")
        print(f"📁 Arquivo salvo em: {result_path}")
        
    except Exception as e:
        print(f"\n❌ Erro durante pós-processamento: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
