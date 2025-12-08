#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para converter arquivo de áudio para MP3 com qualidade reduzida.
Usado para reduzir o tamanho do arquivo antes de enviar para APIs.
"""
import sys
import subprocess
import os
import io

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

def convert_to_mp3(input_path, output_path, bitrate='128k', sample_rate=22050, channels=1):
    """
    Converte arquivo de áudio para MP3 com qualidade reduzida.
    
    Args:
        input_path: Caminho para o arquivo de áudio de entrada
        output_path: Caminho onde salvar o MP3
        bitrate: Bitrate do MP3 (padrão: 128k)
        sample_rate: Taxa de amostragem (padrão: 22050 Hz)
        channels: Número de canais (1 = mono, 2 = estéreo, padrão: 1)
    """
    try:
        # Verificar se o arquivo de entrada existe
        if not os.path.exists(input_path):
            print(f"Erro: Arquivo de entrada não encontrado: {input_path}", file=sys.stderr)
            sys.exit(1)
        
        # Comando FFmpeg para converter para MP3
        cmd = [
            'ffmpeg',
            '-i', input_path,
            '-acodec', 'libmp3lame',
            '-b:a', bitrate,
            '-ar', str(sample_rate),
            '-ac', str(channels),
            output_path,
            '-y'
        ]
        
        print(f"Convertendo áudio: {input_path}", file=sys.stderr)
        print(f"Salvando como MP3: {output_path}", file=sys.stderr)
        print(f"Configuração: {bitrate}, {sample_rate}Hz, {channels} canal(is)", file=sys.stderr)
        
        # Executar FFmpeg
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True
        )
        
        # Verificar se o arquivo foi criado
        if not os.path.exists(output_path):
            print(f"Erro: Arquivo MP3 não foi criado: {output_path}", file=sys.stderr)
            sys.exit(1)
        
        file_size = os.path.getsize(output_path)
        input_size = os.path.getsize(input_path)
        reduction = ((input_size - file_size) / input_size) * 100
        
        print(f"Conversão concluída!", file=sys.stderr)
        print(f"Tamanho original: {input_size / (1024*1024):.2f} MB", file=sys.stderr)
        print(f"Tamanho MP3: {file_size / (1024*1024):.2f} MB", file=sys.stderr)
        print(f"Redução: {reduction:.1f}%", file=sys.stderr)
        
        if file_size < 100 * 1024:  # Menor que 100KB
            print(f"AVISO: Arquivo MP3 muito pequeno ({file_size} bytes)", file=sys.stderr)
            sys.exit(1)
        
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
    if len(sys.argv) < 3:
        print("Uso: python convert_audio_to_mp3.py <input_path> <output_path> [bitrate] [sample_rate] [channels]", file=sys.stderr)
        print("Exemplo: python convert_audio_to_mp3.py audio.wav audio.mp3 128k 22050 1", file=sys.stderr)
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    bitrate = sys.argv[3] if len(sys.argv) > 3 else '128k'
    sample_rate = int(sys.argv[4]) if len(sys.argv) > 4 else 22050
    channels = int(sys.argv[5]) if len(sys.argv) > 5 else 1
    
    convert_to_mp3(input_path, output_path, bitrate, sample_rate, channels)
