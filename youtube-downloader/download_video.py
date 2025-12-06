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

def download_video(query, output_dir):
    ydl_opts = {
        # Priorizar vídeo completo com movimento
        # Formato: melhor vídeo (com vídeo codec) + melhor áudio, ou melhor formato completo
        # Garantir que tenha codec de vídeo (não apenas áudio ou thumbnail)
        'format': 'bestvideo[vcodec!=none][height<=1080]+bestaudio[acodec!=none]/bestvideo[vcodec!=none]+bestaudio[acodec!=none]/best[vcodec!=none][height<=1080]/best[vcodec!=none]/best',
        'outtmpl': os.path.join(output_dir, 'video.%(ext)s'),
        'quiet': False,
        'no_warnings': False,
        'merge_output_format': 'mp4',  # Garantir que merge em mp4 quando vídeo e áudio são separados
        # Evitar download de apenas thumbnails ou áudio
        'writethumbnail': False,
        'skip_download': False,
        'progress_hooks': [lambda d: None],  # Callback vazio para evitar problemas
    }
    
    try:
        print(f"Buscando vídeo para: {query}", file=sys.stderr)
        print(f"Diretório de saída: {output_dir}", file=sys.stderr)
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Buscar vídeo
            search_query = f"ytsearch1:{query}"
            print(f"Query de busca: {search_query}", file=sys.stderr)
            
            # Primeiro, buscar informações sem baixar para ver formatos disponíveis
            info = ydl.extract_info(search_query, download=False)
            
            # Verificar formatos disponíveis
            if 'entries' in info and info.get('entries'):
                video_entry = info['entries'][0]
                if 'formats' in video_entry:
                    print(f"Formatos disponíveis: {len(video_entry['formats'])}", file=sys.stderr)
                    # Listar alguns formatos para debug
                    for fmt in video_entry['formats'][:5]:
                        fmt_id = fmt.get('format_id', 'N/A')
                        fmt_note = fmt.get('format_note', 'N/A')
                        resolution = fmt.get('resolution', 'N/A')
                        vcodec = fmt.get('vcodec', 'none')
                        acodec = fmt.get('acodec', 'none')
                        print(f"  - ID: {fmt_id}, Note: {fmt_note}, Res: {resolution}, Video: {vcodec}, Audio: {acodec}", file=sys.stderr)
            
            # Agora fazer o download
            info = ydl.extract_info(search_query, download=True)
            
            if not info:
                print("Nenhum vídeo encontrado - info vazio", file=sys.stderr)
                sys.exit(1)
            
            # Se for uma lista de resultados
            if 'entries' in info:
                if not info.get('entries') or len(info['entries']) == 0:
                    print("Nenhum vídeo encontrado - entries vazio", file=sys.stderr)
                    sys.exit(1)
                video_info = info['entries'][0]
            else:
                # Se for um único vídeo
                video_info = info
            
            if not video_info:
                print("Informações do vídeo vazias", file=sys.stderr)
                sys.exit(1)
            
            print(f"Vídeo encontrado: {video_info.get('title', 'Sem título')}", file=sys.stderr)
            print(f"Duração: {video_info.get('duration', 'N/A')} segundos", file=sys.stderr)
            print(f"Formato: {video_info.get('format', 'N/A')}", file=sys.stderr)
            
            # Aguardar um pouco para garantir que o download terminou
            import time
            time.sleep(2)
            
            # Encontrar o arquivo baixado
            video_file = None
            video_path = None
            
            # Procurar por arquivos de vídeo
            if os.path.exists(output_dir):
                files = os.listdir(output_dir)
                print(f"Arquivos no diretório após download: {files}", file=sys.stderr)
                
                # Procurar por arquivos que começam com 'video.'
                for filename in files:
                    if filename.startswith('video.') and os.path.isfile(os.path.join(output_dir, filename)):
                        ext = filename.split('.')[-1].lower()
                        if ext in ['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv']:
                            video_file = filename
                            video_path = os.path.join(output_dir, filename)
                            print(f"Vídeo encontrado: {video_path}", file=sys.stderr)
                            
                            # Verificar tamanho do arquivo (deve ser maior que 1MB para ser um vídeo real)
                            file_size = os.path.getsize(video_path)
                            print(f"Tamanho do arquivo: {file_size / (1024*1024):.2f} MB", file=sys.stderr)
                            
                            if file_size < 1024 * 1024:  # Menor que 1MB provavelmente é thumbnail
                                print(f"AVISO: Arquivo muito pequeno ({file_size} bytes). Pode ser thumbnail.", file=sys.stderr)
                                video_file = None
                                video_path = None
                                continue
                            
                            # Se não for mp4, tentar renomear
                            if ext != 'mp4':
                                mp4_path = os.path.join(output_dir, 'video.mp4')
                                try:
                                    if os.path.exists(mp4_path):
                                        os.remove(mp4_path)  # Remover mp4 antigo se existir
                                    os.rename(video_path, mp4_path)
                                    video_file = 'video.mp4'
                                    video_path = mp4_path
                                    print(f"Vídeo renomeado para: {mp4_path}", file=sys.stderr)
                                except Exception as rename_err:
                                    print(f"Aviso: Não foi possível renomear para mp4: {rename_err}", file=sys.stderr)
                            break
            
            if not video_file or not video_path:
                # Listar todos os arquivos no diretório para debug
                if os.path.exists(output_dir):
                    all_files = os.listdir(output_dir)
                    print(f"Todos os arquivos no diretório: {all_files}", file=sys.stderr)
                raise Exception('Arquivo de vídeo não encontrado após download. Verifique os logs acima para mais detalhes.')
            
            # Retornar informações do vídeo em JSON
            result = {
                'id': video_info.get('id'),
                'title': video_info.get('title'),
                'url': video_info.get('webpage_url'),
                'thumbnail': video_info.get('thumbnail'),
                'duration': video_info.get('duration'),
                'uploader': video_info.get('uploader'),
                'view_count': video_info.get('view_count'),
                'file': video_file,
                'file_size': os.path.getsize(os.path.join(output_dir, video_file)) if video_file else 0
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
        print("Uso: python download_video.py <query> <output_dir>", file=sys.stderr)
        sys.exit(1)
    
    query = sys.argv[1]
    output_dir = sys.argv[2]
    download_video(query, output_dir)

