#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Análise de áudio para validação de timestamps LRC e detecção de atividade vocal
"""

import numpy as np
import librosa
from typing import List, Tuple, Optional
import sys
import io

# Configurar encoding UTF-8 para Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


def detect_vocal_activity(audio_path: str, threshold: float = 0.01) -> List[Tuple[float, float]]:
    """
    Detecta trechos de atividade vocal no áudio.
    
    Args:
        audio_path: Caminho para o arquivo de áudio
        threshold: Threshold de energia RMS para considerar atividade vocal (padrão: 0.01)
        
    Returns:
        Lista de tuplas (start, end) em segundos com trechos de atividade vocal
    """
    try:
        # Carregar áudio
        y, sr = librosa.load(audio_path, sr=None, mono=True)
        
        # Calcular energia RMS
        frame_length = 2048
        hop_length = 512
        rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
        
        # Converter frames para tempo
        times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop_length)
        
        # Detectar atividade vocal (RMS acima do threshold)
        vocal_frames = rms > threshold
        
        # Encontrar segmentos contínuos de atividade vocal
        segments = []
        in_segment = False
        segment_start = 0
        
        for i, is_vocal in enumerate(vocal_frames):
            if is_vocal and not in_segment:
                # Início de segmento
                segment_start = times[i]
                in_segment = True
            elif not is_vocal and in_segment:
                # Fim de segmento
                segments.append((segment_start, times[i]))
                in_segment = False
        
        # Adicionar último segmento se ainda estiver ativo
        if in_segment:
            segments.append((segment_start, times[-1]))
        
        return segments
    except Exception as e:
        print(f"⚠️  Erro ao analisar atividade vocal: {e}")
        return []


def validate_lrc_timestamps(audio_path: str, lrc_lines: List[dict], threshold: float = 0.01, 
                           window: float = 0.5) -> List[bool]:
    """
    Valida cada timestamp do LRC verificando se há atividade vocal no momento indicado.
    
    Args:
        audio_path: Caminho para o arquivo de áudio
        lrc_lines: Lista de linhas LRC parseadas (com 'time' em segundos)
        threshold: Threshold de energia RMS (padrão: 0.01)
        window: Janela de tempo em segundos para verificar ao redor do timestamp (padrão: 0.5s)
        
    Returns:
        Lista de booleanos: True se há atividade vocal, False se é silêncio
    """
    try:
        # Carregar áudio
        y, sr = librosa.load(audio_path, sr=None, mono=True)
        
        # Calcular energia RMS
        frame_length = 2048
        hop_length = 512
        rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
        times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop_length)
        
        validation_results = []
        
        for lrc_line in lrc_lines:
            timestamp = lrc_line['time']
            
            # Verificar se há atividade vocal na janela ao redor do timestamp
            start_time = max(0, timestamp - window / 2)
            end_time = min(len(y) / sr, timestamp + window / 2)
            
            # Encontrar índices de frames correspondentes
            start_idx = np.argmin(np.abs(times - start_time))
            end_idx = np.argmin(np.abs(times - end_time))
            
            # Calcular energia média na janela
            if start_idx < len(rms) and end_idx < len(rms):
                avg_rms = np.mean(rms[start_idx:end_idx+1])
                has_vocal_activity = avg_rms > threshold
            else:
                has_vocal_activity = False
            
            validation_results.append(has_vocal_activity)
        
        return validation_results
    except Exception as e:
        print(f"⚠️  Erro ao validar timestamps: {e}")
        # Retornar True para todos se houver erro (não remover linhas)
        return [True] * len(lrc_lines)


def analyze_segment_duration(audio_path: str, start_time: float, end_time: float) -> float:
    """
    Analisa a duração real de um segmento no áudio.
    
    Args:
        audio_path: Caminho para o arquivo de áudio
        start_time: Tempo de início em segundos
        end_time: Tempo de fim em segundos
        
    Returns:
        Duração real em segundos (pode ser diferente de end_time - start_time se houver silêncio)
    """
    try:
        # Carregar apenas o segmento necessário
        y, sr = librosa.load(audio_path, sr=None, mono=True, offset=start_time, 
                            duration=max(0.1, end_time - start_time))
        
        # Calcular energia RMS
        frame_length = 2048
        hop_length = 512
        rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
        times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop_length)
        
        # Encontrar primeiro e último frame com atividade vocal
        threshold = 0.01
        vocal_frames = rms > threshold
        
        if not np.any(vocal_frames):
            return 0.0
        
        first_vocal = np.where(vocal_frames)[0][0]
        last_vocal = np.where(vocal_frames)[0][-1]
        
        # Duração real de atividade vocal
        real_start = times[first_vocal]
        real_end = times[last_vocal]
        real_duration = real_end - real_start
        
        return max(0.1, real_duration)  # Mínimo 0.1s
    except Exception as e:
        print(f"⚠️  Erro ao analisar duração do segmento: {e}")
        return end_time - start_time  # Fallback para duração nominal


def get_audio_duration(audio_path: str) -> float:
    """
    Obtém a duração total do áudio.
    
    Args:
        audio_path: Caminho para o arquivo de áudio
        
    Returns:
        Duração em segundos
    """
    try:
        y, sr = librosa.load(audio_path, sr=None, mono=True)
        return len(y) / sr
    except Exception as e:
        print(f"⚠️  Erro ao obter duração do áudio: {e}")
        return 0.0
