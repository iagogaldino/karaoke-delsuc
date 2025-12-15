#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Detecção de palavras arrastadas usando LRC + análise de áudio
"""

import re
from typing import Dict, Optional, List
import sys
from pathlib import Path

# Adicionar diretório atual ao path para imports
sys.path.insert(0, str(Path(__file__).parent))

from audio_analyzer import analyze_segment_duration


def estimate_expected_duration(text: str) -> float:
    """
    Estima a duração esperada de uma palavra/frase baseado no número de caracteres e sílabas.
    
    Args:
        text: Texto da palavra/frase
        
    Returns:
        Duração esperada em segundos
    """
    # Remover espaços e caracteres especiais para contar apenas letras
    clean_text = re.sub(r'[^\w]', '', text.lower())
    
    if not clean_text:
        return 0.2  # Duração mínima
    
    # Estimativa: ~0.1s por caractere para fala normal
    # Ajustar para português/inglês (sílabas são mais relevantes)
    char_count = len(clean_text)
    
    # Contar vogais (aproximação de sílabas)
    vowels = 'aeiouáéíóúàèìòùâêîôûãõ'
    vowel_count = sum(1 for c in clean_text if c in vowels)
    
    # Se não houver vogais, usar contagem de caracteres
    if vowel_count == 0:
        syllable_estimate = char_count
    else:
        syllable_estimate = vowel_count
    
    # Duração base: ~0.15s por sílaba
    base_duration = syllable_estimate * 0.15
    
    # Duração mínima e máxima
    min_duration = 0.2
    max_duration = char_count * 0.25
    
    return max(min_duration, min(base_duration, max_duration))


def find_last_vowel(text: str) -> Optional[str]:
    """
    Encontra a última vogal em uma palavra.
    
    Args:
        text: Texto da palavra
        
    Returns:
        Última vogal encontrada ou None
    """
    vowels = 'aeiouAEIOUáéíóúàèìòùâêîôûãõÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÃÕ'
    
    # Procurar da direita para esquerda
    for char in reversed(text):
        if char in vowels:
            return char
    
    return None


def detect_dragged_words(audio_path: str, lrc_lines: List[dict], 
                        duration_threshold: float = 1.5) -> List[dict]:
    """
    Detecta palavras arrastadas comparando duração esperada vs real.
    
    Args:
        audio_path: Caminho para o arquivo de áudio
        lrc_lines: Lista de linhas LRC parseadas
        duration_threshold: Multiplicador para considerar arrasto (padrão: 1.5x)
        
    Returns:
        Lista de linhas LRC atualizadas com palavras arrastadas marcadas
    """
    improved_lines = []
    
    for i, lrc_line in enumerate(lrc_lines):
        text = lrc_line['text']
        time = lrc_line['time']
        
        # Calcular duração esperada baseado no texto
        expected_duration = estimate_expected_duration(text)
        
        # Calcular duração real do segmento no áudio
        # Usar próxima linha para determinar fim do segmento, ou assumir 2s se for a última
        if i < len(lrc_lines) - 1:
            next_time = lrc_lines[i + 1]['time']
            segment_end = next_time
        else:
            # Última linha: assumir duração de 2 segundos ou até o fim do áudio
            segment_end = time + 2.0
        
        segment_duration = segment_end - time
        
        # Analisar duração real de atividade vocal no segmento
        real_duration = analyze_segment_duration(audio_path, time, segment_end)
        
        # Se a duração real for significativamente maior que a esperada, há arrasto
        if real_duration > expected_duration * duration_threshold:
            # Verificar se já tem letras repetidas (Whisper pode ter detectado)
            has_repeated = bool(re.search(r'(.)\1{2,}', text))
            
            if not has_repeated:
                # Calcular quantas letras adicionar baseado na duração extra
                extra_duration = real_duration - expected_duration
                # Cada 0.15s extra = 1 letra repetida
                repeat_count = min(int(extra_duration / 0.15), 5)  # Máximo 5 repetições
                
                if repeat_count > 0:
                    # Encontrar última vogal para repetir
                    last_vowel = find_last_vowel(text)
                    
                    if last_vowel:
                        # Adicionar letras repetidas
                        improved_text = text + last_vowel * repeat_count
                    else:
                        # Se não houver vogal, repetir último caractere
                        if text:
                            improved_text = text + text[-1] * repeat_count
                        else:
                            improved_text = text
                    
                    # Criar nova linha com texto melhorado
                    improved_line = lrc_line.copy()
                    improved_line['text'] = improved_text
                    improved_lines.append(improved_line)
                    continue
        
        # Se não houver arrasto detectado, manter linha original
        improved_lines.append(lrc_line)
    
    return improved_lines


def detect_dragged_vowels_in_segment(audio_path: str, start_time: float, 
                                    end_time: float, text: str) -> Optional[str]:
    """
    Analisa se há vogais arrastadas em um segmento específico.
    
    Args:
        audio_path: Caminho para o arquivo de áudio
        start_time: Tempo de início em segundos
        end_time: Tempo de fim em segundos
        text: Texto do segmento
        
    Returns:
        Texto melhorado com letras repetidas ou None se não houver arrasto
    """
    expected_duration = estimate_expected_duration(text)
    real_duration = analyze_segment_duration(audio_path, start_time, end_time)
    
    if real_duration > expected_duration * 1.5:
        # Calcular repetições
        extra_duration = real_duration - expected_duration
        repeat_count = min(int(extra_duration / 0.15), 5)
        
        if repeat_count > 0:
            last_vowel = find_last_vowel(text)
            if last_vowel:
                return text + last_vowel * repeat_count
    
    return None
