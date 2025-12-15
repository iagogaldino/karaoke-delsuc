# Agente de Pós-processamento LRC

Módulo Python que pós-processa arquivos LRC gerados pelo Whisper, melhorando a precisão através de análise de áudio.

## Funcionalidades

1. **Detecção de palavras arrastadas**: Identifica quando palavras estão sendo arrastadas (ex: "Ameeeeei", "Vouuuu") e adiciona letras repetidas
2. **Remoção de silêncios**: Remove linhas LRC que correspondem a trechos sem cantoria
3. **Validação de timestamps**: Valida se os timestamps do LRC realmente correspondem a atividade vocal

## Estratégia Híbrida

O agente usa uma abordagem híbrida que combina:
- **LRC existente**: Usa o LRC gerado pelo Whisper como base (não precisa transcrever novamente)
- **Análise de áudio**: Valida e melhora o LRC usando análise do arquivo `vocals.wav`

## Instalação

```bash
pip install -r requirements.txt
```

## Uso

### Linha de comando

```bash
python post_process_lrc.py lyrics.lrc vocals.wav lyrics_processed.lrc
```

### Parâmetros opcionais

```bash
python post_process_lrc.py lyrics.lrc vocals.wav lyrics.lrc \
  --silence-threshold 0.02 \
  --duration-threshold 1.5
```

- `--silence-threshold`: Threshold para detecção de silêncio (padrão: 0.01)
- `--duration-threshold`: Multiplicador para detectar palavras arrastadas (padrão: 1.5)

## Estrutura do Módulo

- `post_process_lrc.py` - Script principal que orquestra o pós-processamento
- `lrc_parser.py` - Parser de arquivos LRC (extrai timestamps e textos)
- `audio_analyzer.py` - Análise de áudio (valida timestamps, detecta silêncio)
- `word_detector.py` - Detecção de palavras arrastadas usando LRC + análise de áudio

## Como Funciona

1. **Parse do LRC**: Extrai timestamps e textos do LRC gerado pelo Whisper
2. **Validação de timestamps**: Para cada timestamp, verifica se há atividade vocal no áudio
3. **Filtro de silêncios**: Remove linhas LRC que caem em trechos sem cantoria
4. **Detecção de arrastos**: Compara duração esperada (texto) vs duração real (áudio)
5. **Melhoria de palavras**: Adiciona letras repetidas quando detecta arrasto
6. **Salvamento**: Salva o LRC processado

## Integração

O módulo é automaticamente chamado pelo backend após a geração do LRC pelo Whisper.

## Dependências

- `librosa>=0.10.0` - Análise de áudio
- `numpy>=1.24.0` - Processamento numérico
- `soundfile>=0.12.0` - Leitura de arquivos de áudio
- `scipy>=1.10.0` - Processamento de sinais
