# 🎤 Extração de Voz com Demucs

Script Python simples para extrair apenas a voz (vocals) de arquivos de áudio usando o modelo **Demucs** da Meta.

## 📋 Requisitos

- Python 3.8 ou superior
- Pip (gerenciador de pacotes Python)
- Recomendado: GPU NVIDIA com CUDA (para processamento mais rápido)
- Opcional: CPU (funciona, mas será mais lento)

## 🚀 Instalação

### 1. Clone ou baixe este repositório

### 2. Instale as dependências

**Opção A: CPU (funciona em qualquer computador, mais lento)**
```bash
pip install -r requirements.txt
```

**Opção B: GPU NVIDIA (muito mais rápido, requer CUDA)**
```bash
# Primeiro, instale PyTorch com suporte CUDA:
# Para CUDA 11.8:
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118

# Para CUDA 12.1:
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121

# Depois, instale as outras dependências:
pip install -r requirements.txt
```

### 3. Verifique a instalação

```bash
python extract_voice.py --help
```

## 📖 Como Usar

### Uso Básico

```bash
python extract_voice.py seu_arquivo.mp3
```

O arquivo de vocais será salvo em `output/seu_arquivo_vocals.wav`

### Opções Disponíveis

```bash
python extract_voice.py [ARQUIVO] [OPÇÕES]
```

**Argumentos:**
- `ARQUIVO` (obrigatório): Caminho para o arquivo de áudio (mp3, wav, m4a, etc.)

**Opções:**
- `--output` ou `-o`: Diretório de saída (padrão: `output/`)
- `--model` ou `-m`: Modelo a usar (`htdemucs`, `htdemucs_ft`, `mdx_extra`)
  - `htdemucs`: Modelo mais recente e recomendado (padrão)
  - `htdemucs_ft`: Versão fine-tuned (melhor qualidade)
  - `mdx_extra`: Modelo alternativo
- `--device` ou `-d`: Forçar dispositivo (`cuda` para GPU ou `cpu`)

### Exemplos

```bash
# Exemplo 1: Uso básico
python extract_voice.py musica.mp3

# Exemplo 2: Especificar pasta de saída
python extract_voice.py musica.wav --output minha_pasta

# Exemplo 3: Usar modelo fine-tuned
python extract_voice.py musica.m4a --model htdemucs_ft

# Exemplo 4: Forçar uso de CPU
python extract_voice.py musica.mp3 --device cpu

# Exemplo 5: Forçar uso de GPU
python extract_voice.py musica.mp3 --device cuda
```

## 🎵 Formatos Suportados

O script suporta os seguintes formatos de áudio:
- MP3 (.mp3)
- WAV (.wav)
- M4A (.m4a)
- FLAC (.flac)
- E outros formatos suportados pela biblioteca

## 📁 Estrutura de Saída

```
projeto/
├── extract_voice.py
├── requirements.txt
├── README.md
└── output/              # Arquivos de vocais extraídos
    └── musica_vocals.wav
```

## ⚙️ Como Funciona

1. **Carregamento do Modelo**: O script carrega o modelo Demucs pré-treinado (htdemucs é o padrão)
2. **Processamento do Áudio**: O arquivo de entrada é carregado e normalizado
3. **Separação de Stems**: O modelo separa o áudio em 4 stems:
   - Drums (bateria)
   - Bass (baixo)
   - Other (outros instrumentos)
   - Vocals (vocais) ← **Este é o que extraímos**
4. **Extração**: Apenas o stem de vocais é extraído
5. **Salvamento**: O arquivo de vocais é salvo em WAV de alta qualidade

## 🔧 Solução de Problemas

### Erro: "CUDA out of memory"
- Use `--device cpu` para forçar processamento na CPU
- Ou reduza o tamanho do arquivo de áudio

### Erro: "ModuleNotFoundError"
- Execute `pip install -r requirements.txt` novamente
- Certifique-se de estar no ambiente virtual correto (se estiver usando)

### Processamento muito lento
- Se tiver GPU NVIDIA, instale o PyTorch com suporte CUDA
- Use `--device cuda` para forçar uso da GPU

### Qualidade do áudio não está boa
- Tente usar `--model htdemucs_ft` (modelo fine-tuned, melhor qualidade)
- O arquivo original pode ter vocais muito misturados com instrumentos

## 📝 Notas

- O primeiro uso pode demorar mais pois o modelo precisa ser baixado (~1.5 GB)
- Arquivos grandes podem demorar vários minutos para processar
- O arquivo de saída é sempre em formato WAV para manter alta qualidade
- O script preserva a taxa de amostragem original do áudio

## 📄 Licença

Este script utiliza o modelo Demucs da Meta, que é de código aberto.
Para mais informações sobre o Demucs: https://github.com/facebookresearch/demucs

## 🙏 Créditos

- **Demucs**: Meta Research (Facebook AI Research)
- Modelo de separação de áudio de última geração

