#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Parser de arquivos LRC
Extrai timestamps e textos de arquivos LRC no formato [mm:ss.xx]texto
"""

import re
from typing import List, Dict, Any, Optional


def parse_lrc_file(lrc_path: str) -> List[Dict[str, Any]]:
    """
    Parseia um arquivo LRC e retorna lista de linhas com timestamps e textos.
    
    Args:
        lrc_path: Caminho para o arquivo LRC
        
    Returns:
        Lista de dicionários com 'time' (segundos), 'text', 'original_line'
    """
    lines = []
    
    try:
        with open(lrc_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        raise IOError(f"Erro ao ler arquivo LRC: {e}")
    
    # Formato LRC: [mm:ss.xx]texto
    lrc_pattern = re.compile(r'\[(\d{2}):(\d{2})\.(\d{2})\](.*)')
    
    for line_num, line in enumerate(content.split('\n'), 1):
        line = line.strip()
        if not line:
            continue
            
        match = lrc_pattern.match(line)
        if match:
            minutes = int(match.group(1))
            seconds = int(match.group(2))
            centiseconds = int(match.group(3))
            text = match.group(4).strip()
            
            # Converter para segundos
            time_in_seconds = minutes * 60 + seconds + centiseconds / 100.0
            
            if text:  # Apenas adicionar se houver texto
                lines.append({
                    'time': time_in_seconds,
                    'text': text,
                    'original_line': line,
                    'line_number': line_num
                })
    
    # Ordenar por tempo
    lines.sort(key=lambda x: x['time'])
    
    return lines


def format_lrc_time(seconds: float) -> str:
    """
    Converte segundos para formato LRC [mm:ss.xx]
    
    Args:
        seconds: Tempo em segundos
        
    Returns:
        String no formato [mm:ss.xx]
    """
    minutes = int(seconds // 60)
    secs = seconds % 60
    secs_int = int(secs)
    centiseconds = int((secs - secs_int) * 100)
    
    return f"[{minutes:02d}:{secs_int:02d}.{centiseconds:02d}]"


def write_lrc_file(lines: List[Dict[str, Any]], output_path: str) -> None:
    """
    Escreve linhas LRC para um arquivo.
    
    Args:
        lines: Lista de dicionários com 'time' e 'text'
        output_path: Caminho do arquivo de saída
    """
    with open(output_path, 'w', encoding='utf-8') as f:
        for line in lines:
            time_str = format_lrc_time(line['time'])
            text = line['text']
            f.write(f"{time_str}{text}\n")


if __name__ == '__main__':
    # Teste básico
    import sys
    if len(sys.argv) > 1:
        lrc_path = sys.argv[1]
        lines = parse_lrc_file(lrc_path)
        print(f"Parseadas {len(lines)} linhas LRC")
        for i, line in enumerate(lines[:5]):
            print(f"  {i+1}. [{line['time']:.2f}s] {line['text'][:50]}")
