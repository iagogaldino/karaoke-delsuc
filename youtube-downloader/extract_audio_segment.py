#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para extrair um trecho de áudio de um arquivo usando FFmpeg.
"""
import sys
import subprocess
import os
import io

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

def extract_audio_segment(input_path, output_path, start_time, duration, margin=0.5):
    """
    Extrai um trecho de áudio de um arquivo usando FFmpeg.
    
    Args:
        input_path: Caminho para o arquivo de áudio de entrada
        output_path: Caminho onde salvar o trecho extraído
        start_time: Tempo de início em segundos
        duration: Duração do trecho em segundos
        margin: Margem em segundos antes e depois (padrão: 0.5s)
    """
    try:
        # Verificar se o arquivo existe
        if not os.path.exists(input_path):
            print(f"Erro: Arquivo de áudio não encontrado: {input_path}", file=sys.stderr)
            sys.exit(1)
        
        # Ajustar tempo inicial com margem (não pode ser negativo)
        adjusted_start = max(0, start_time - margin)
        # Ajustar duração para incluir margens
        adjusted_duration = duration + (start_time - adjusted_start) + margin
        
        # Comando FFmpeg para extrair trecho
        # -i: arquivo de entrada
        # -ss: tempo de início
        # -t: duração
        # -acodec copy: copiar codec (mais rápido) ou pcm_s16le para WAV
        # -y: sobrescrever arquivo de saída se existir
        cmd = [
            'ffmpeg',
            '-i', input_path,
            '-ss', str(adjusted_start),
            '-t', str(adjusted_duration),
            '-acodec', 'pcm_s16le',  # Codec PCM para WAV
            '-ar', '44100',  # Taxa de amostragem
            '-ac', '1',  # Mono (vocals.wav geralmente é mono)
            output_path,
            '-y'
        ]
        
        print(f"Extraindo trecho de áudio:", file=sys.stderr)
        print(f"  Arquivo: {input_path}", file=sys.stderr)
        print(f"  Início: {adjusted_start:.2f}s (original: {start_time:.2f}s)", file=sys.stderr)
        print(f"  Duração: {adjusted_duration:.2f}s (original: {duration:.2f}s)", file=sys.stderr)
        print(f"  Saída: {output_path}", file=sys.stderr)
        
        # Executar FFmpeg
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True
        )
        
        # Verificar se o arquivo foi criado
        if not os.path.exists(output_path):
            print(f"Erro: Arquivo de áudio não foi criado: {output_path}", file=sys.stderr)
            sys.exit(1)
        
        file_size = os.path.getsize(output_path)
        if file_size < 1000:  # Menor que 1KB
            print(f"Erro: Arquivo de áudio muito pequeno ({file_size} bytes)", file=sys.stderr)
            sys.exit(1)
        
        print(f"Trecho extraído com sucesso! ({file_size / 1024:.2f} KB)", file=sys.stderr)
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"Erro ao executar FFmpeg: {e}", file=sys.stderr)
        if e.stderr:
            print(f"FFmpeg stderr: {e.stderr}", file=sys.stderr)
        if e.stdout:
            print(f"FFmpeg stdout: {e.stdout}", file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError:
        print("Erro: FFmpeg não está instalado ou não está no PATH", file=sys.stderr)
        print("Instale FFmpeg: https://ffmpeg.org/download.html", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Erro inesperado: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 5:
        print("Uso: python extract_audio_segment.py <input_path> <output_path> <start_time> <duration> [margin]", file=sys.stderr)
        print("  start_time: Tempo de início em segundos", file=sys.stderr)
        print("  duration: Duração do trecho em segundos", file=sys.stderr)
        print("  margin: Margem em segundos (opcional, padrão: 0.5)", file=sys.stderr)
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    start_time = float(sys.argv[3])
    duration = float(sys.argv[4])
    margin = float(sys.argv[5]) if len(sys.argv) > 5 else 0.5
    
    extract_audio_segment(input_path, output_path, start_time, duration, margin)
