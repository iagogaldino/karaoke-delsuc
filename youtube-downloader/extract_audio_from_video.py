#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para extrair áudio de um arquivo de vídeo usando FFmpeg.
"""
import sys
import subprocess
import os
import io

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

def extract_audio(video_path, audio_path):
    """
    Extrai áudio de um arquivo de vídeo usando FFmpeg.
    
    Args:
        video_path: Caminho para o arquivo de vídeo
        audio_path: Caminho onde salvar o áudio extraído
    """
    try:
        # Verificar se o vídeo existe
        if not os.path.exists(video_path):
            print(f"Erro: Arquivo de vídeo não encontrado: {video_path}", file=sys.stderr)
            sys.exit(1)
        
        # Comando FFmpeg para extrair áudio
        # -i: arquivo de entrada
        # -vn: não incluir vídeo
        # -acodec pcm_s16le: codec de áudio PCM 16-bit little-endian
        # -ar 44100: taxa de amostragem 44.1kHz
        # -ac 2: 2 canais (estéreo)
        # -y: sobrescrever arquivo de saída se existir
        cmd = [
            'ffmpeg',
            '-i', video_path,
            '-vn',
            '-acodec', 'pcm_s16le',
            '-ar', '44100',
            '-ac', '2',
            audio_path,
            '-y'
        ]
        
        print(f"Extraindo áudio de: {video_path}", file=sys.stderr)
        print(f"Salvando em: {audio_path}", file=sys.stderr)
        
        # Executar FFmpeg
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True
        )
        
        print(f"Extraindo áudio de: {video_path}", file=sys.stderr)
        print(f"Salvando em: {audio_path}", file=sys.stderr)
        
        # Executar FFmpeg
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True
        )
        
        # Verificar se o arquivo foi criado
        if not os.path.exists(audio_path):
            print(f"Erro: Arquivo de áudio não foi criado: {audio_path}", file=sys.stderr)
            sys.exit(1)
        
        file_size = os.path.getsize(audio_path)
        if file_size < 100 * 1024:  # Menor que 100KB
            print(f"Erro: Arquivo de áudio muito pequeno ({file_size} bytes)", file=sys.stderr)
            sys.exit(1)
        
        print(f"Áudio extraído com sucesso! ({file_size / (1024*1024):.2f} MB)", file=sys.stderr)
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
        print("Uso: python extract_audio_from_video.py <video_path> <audio_path>", file=sys.stderr)
        sys.exit(1)
    
    video_path = sys.argv[1]
    audio_path = sys.argv[2]
    extract_audio(video_path, audio_path)
