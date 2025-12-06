# Extrator de Waveform de Áudio de Voz

Script Python completo para extrair a waveform de um arquivo de áudio contendo apenas voz, gerando um arquivo JSON com todos os valores e uma imagem PNG com a visualização.

## 📋 Requisitos

- Python 3.8 ou superior
- Bibliotecas Python (ver `requirements.txt`)

## 🚀 Instalação

### 1. Instalar as dependências

```bash
pip install -r requirements.txt
```

Ou instale manualmente:

```bash
pip install librosa numpy matplotlib soundfile
```

**Nota:** No Windows, pode ser necessário instalar o `soundfile` separadamente. Se houver problemas, tente:

```bash
pip install soundfile
```

## 📖 Uso

### Uso Básico

Coloque seu arquivo de áudio `voz.wav` na mesma pasta do script e execute:

```bash
python waveform_extractor.py
```

Ou especifique o arquivo de áudio:

```bash
python waveform_extractor.py meu_audio.mp3
```

**Nota:** Os arquivos de saída usarão automaticamente o nome do arquivo de áudio:
- `meu_audio.json` na pasta `wave_json/`
- `meu_audio.png` na pasta `wave_images/`

### Uso Avançado

Você pode especificar o arquivo de entrada, os arquivos de saída e as pastas:

```bash
python waveform_extractor.py voz.wav waveform.json waveform.png wave_json wave_images
```

**Parâmetros:**
- Primeiro argumento: arquivo de áudio de entrada (padrão: `voz.wav`)
- Segundo argumento: arquivo JSON de saída (padrão: usa o nome do áudio + `.json`)
- Terceiro argumento: arquivo PNG de saída (padrão: usa o nome do áudio + `.png`)
- Quarto argumento: pasta para arquivos JSON (padrão: `wave_json`)
- Quinto argumento: pasta para arquivos PNG (padrão: `wave_images`)

**Notas:**
- As pastas são criadas automaticamente se não existirem
- Se não especificar os nomes dos arquivos de saída, eles usarão o nome do arquivo de áudio

## 📁 Arquivos Gerados

Por padrão, os arquivos são salvos em pastas específicas:
- **JSON**: pasta `wave_json/`
- **Imagens PNG**: pasta `wave_images/`

Os arquivos usam o nome do arquivo de áudio de entrada. Por exemplo, se o áudio for `AlceuValenca.mp3`:
- JSON: `wave_json/AlceuValenca.json`
- PNG: `wave_images/AlceuValenca.png`

### `wave_json/[nome_do_audio].json`

Arquivo JSON contendo:
- `sample_rate`: Taxa de amostragem do áudio (Hz)
- `duration`: Duração do áudio em segundos
- `num_samples`: Número total de amostras
- `waveform`: Array com todos os valores da waveform normalizada (entre -1 e 1)

**Exemplo de estrutura:**
```json
{
  "sample_rate": 44100,
  "duration": 5.23,
  "num_samples": 230643,
  "waveform": [0.001, -0.002, 0.003, ...]
}
```

### `wave_images/[nome_do_audio].png`

Imagem PNG com a visualização gráfica da waveform, incluindo:
- Gráfico da forma de onda
- Eixos de tempo (segundos) e amplitude (normalizada)
- Informações sobre taxa de amostragem, duração e número de amostras

## 🔧 Funcionalidades

- ✅ Carrega áudio em formato mono (canal único)
- ✅ Normaliza valores entre -1 e 1
- ✅ Gera JSON com todos os valores da waveform
- ✅ Cria visualização gráfica em PNG
- ✅ Suporta diferentes formatos de áudio (WAV, MP3, FLAC, etc.)
- ✅ Organiza arquivos em pastas específicas (JSON e imagens)
- ✅ Cria pastas automaticamente se não existirem
- ✅ Comentários explicativos no código

## 📝 Notas

- O script converte automaticamente áudios estéreo para mono
- A normalização garante que os valores fiquem entre -1 e 1
- O arquivo JSON pode ser grande para áudios longos (cada valor é um float32)
- A imagem PNG é gerada com resolução de 150 DPI

## 🐛 Solução de Problemas

### Erro ao instalar librosa

No Windows, pode ser necessário instalar dependências adicionais. Tente:

```bash
pip install --upgrade pip
pip install librosa
```

### Erro: "Arquivo não encontrado"

Certifique-se de que o arquivo `voz.wav` está na mesma pasta do script ou forneça o caminho completo.

### Áudio muito grande

Para áudios muito longos, o arquivo JSON pode ficar grande. Considere usar compressão ou processar em chunks se necessário.

## 📄 Licença

Este script é fornecido como está, livre para uso e modificação.

