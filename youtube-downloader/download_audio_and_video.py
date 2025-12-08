#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import json
import os
import io

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

try:
    import yt_dlp
except ImportError:
    print("Erro: yt-dlp não está instalado. Instale com: pip install yt-dlp", file=sys.stderr)
    sys.exit(1)

def download_audio_and_video(youtube_url, output_dir):
    """
    Baixa o áudio e vídeo de um link do YouTube.
    Retorna informações sobre os arquivos baixados.
    """
    # Primeiro, baixar o vídeo completo
    # IMPORTANTE: noplaylist=True garante que apenas o vídeo seja baixado, mesmo se a URL for de uma playlist
    video_opts = {
        'format': 'bestvideo[vcodec!=none][height<=1080]+bestaudio[acodec!=none]/bestvideo[vcodec!=none]+bestaudio[acodec!=none]/best[vcodec!=none][height<=1080]/best[vcodec!=none]/best',
        'outtmpl': os.path.join(output_dir, 'video.%(ext)s'),
        'quiet': False,
        'no_warnings': False,
        'merge_output_format': 'mp4',
        'writethumbnail': False,
        'skip_download': False,
        'noplaylist': True,  # Baixar apenas o vídeo, não a playlist inteira
        'extractor_args': {'youtube': {'player_client': ['android', 'web']}},  # Reduzir avisos do YouTube
        'progress_hooks': [lambda d: None],
    }
    
    # Depois, baixar apenas o áudio em formato WAV/MP3
    audio_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(output_dir, 'temp_audio.%(ext)s'),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
            'preferredquality': '192',
        }],
        'quiet': False,
        'no_warnings': False,
        'writethumbnail': False,
        'skip_download': False,
        'noplaylist': True,  # Baixar apenas o vídeo, não a playlist inteira
        'extractor_args': {'youtube': {'player_client': ['android', 'web']}},  # Reduzir avisos do YouTube
        'progress_hooks': [lambda d: None],
    }
    
    try:
        print(f"Processando URL do YouTube: {youtube_url}", file=sys.stderr)
        print(f"Diretório de saída: {output_dir}", file=sys.stderr)
        
        # Garantir que o diretório existe
        os.makedirs(output_dir, exist_ok=True)
        
        video_info = None
        audio_info = None
        
        # Passo 1: Baixar vídeo
        print("Baixando vídeo...", file=sys.stderr)
        with yt_dlp.YoutubeDL(video_opts) as ydl:
            # Extrair informações e baixar vídeo
            # download=False primeiro para obter informações sem baixar
            info = ydl.extract_info(youtube_url, download=False)
            
            if not info:
                raise Exception("Não foi possível obter informações do vídeo")
            
            # Se for uma playlist, pegar apenas o primeiro vídeo
            if 'entries' in info:
                if not info.get('entries') or len(info['entries']) == 0:
                    raise Exception("Nenhum vídeo encontrado na playlist")
                video_info = info['entries'][0]
                # Extrair o ID do vídeo individual
                video_id = video_info.get('id')
                if video_id:
                    # Baixar apenas o vídeo específico
                    single_video_url = f"https://www.youtube.com/watch?v={video_id}"
                    print(f"Processando apenas o primeiro vídeo da playlist: {video_info.get('title', 'Sem título')}", file=sys.stderr)
                    ydl.download([single_video_url])
                else:
                    ydl.download([youtube_url])
            else:
                # É um vídeo único
                video_info = info
                ydl.download([youtube_url])
            
            print(f"Vídeo encontrado: {video_info.get('title', 'Sem título')}", file=sys.stderr)
            print(f"Duração: {video_info.get('duration', 'N/A')} segundos", file=sys.stderr)
        
        # Aguardar um pouco para garantir que o download terminou
        import time
        time.sleep(2)
        
        # Encontrar o arquivo de vídeo baixado
        video_file = None
        video_path = None
        
        if os.path.exists(output_dir):
            files = os.listdir(output_dir)
            print(f"Arquivos no diretório após download de vídeo: {files}", file=sys.stderr)
            
            for filename in files:
                if filename.startswith('video.') and os.path.isfile(os.path.join(output_dir, filename)):
                    ext = filename.split('.')[-1].lower()
                    if ext in ['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv']:
                        video_file = filename
                        video_path = os.path.join(output_dir, filename)
                        
                        file_size = os.path.getsize(video_path)
                        print(f"Vídeo encontrado: {video_path} ({file_size / (1024*1024):.2f} MB)", file=sys.stderr)
                        
                        if file_size < 1024 * 1024:
                            print(f"AVISO: Arquivo muito pequeno ({file_size} bytes). Pode ser thumbnail.", file=sys.stderr)
                            video_file = None
                            video_path = None
                            continue
                        
                        # Renomear para mp4 se necessário
                        if ext != 'mp4':
                            mp4_path = os.path.join(output_dir, 'video.mp4')
                            try:
                                if os.path.exists(mp4_path):
                                    os.remove(mp4_path)
                                os.rename(video_path, mp4_path)
                                video_file = 'video.mp4'
                                video_path = mp4_path
                                print(f"Vídeo renomeado para: {mp4_path}", file=sys.stderr)
                            except Exception as rename_err:
                                print(f"Aviso: Não foi possível renomear para mp4: {rename_err}", file=sys.stderr)
                        break
        
        if not video_file or not video_path:
            raise Exception('Arquivo de vídeo não encontrado após download')
        
        # Passo 2: Não baixar áudio separadamente
        # O áudio será extraído do vídeo usando FFmpeg no backend
        print("Pulando download de áudio separado (será extraído do vídeo no backend)...", file=sys.stderr)
        audio_info = video_info  # Usar as mesmas informações do vídeo
        
        # O áudio será extraído do vídeo no backend, então não precisamos procurar por ele aqui
        audio_file = None
        audio_path = None
        
        # Retornar informações em JSON
        result = {
            'id': video_info.get('id'),
            'title': video_info.get('title'),
            'url': video_info.get('webpage_url') or youtube_url,
            'thumbnail': video_info.get('thumbnail'),
            'duration': video_info.get('duration'),
            'uploader': video_info.get('uploader'),
            'view_count': video_info.get('view_count'),
            'video_file': video_file,
            'video_path': video_path,
            'video_size': os.path.getsize(video_path) if video_path else 0,
            # Áudio será extraído do vídeo no backend
            'audio_file': None,
            'audio_path': None,
            'audio_size': 0
        }
        
        print(json.dumps(result, ensure_ascii=False))
        return True
        
    except Exception as e:
        print(f"Erro: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Uso: python download_audio_and_video.py <youtube_url> <output_dir>", file=sys.stderr)
        sys.exit(1)
    
    youtube_url = sys.argv[1]
    output_dir = sys.argv[2]
    download_audio_and_video(youtube_url, output_dir)
