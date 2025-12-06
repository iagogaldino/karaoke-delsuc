# 📁 Reorganização da Estrutura do Projeto

## Nova Estrutura

Todos os arquivos processados de uma música agora ficam organizados em uma pasta única:

```
music/
└── [NomeDaMusica]/
    ├── vocals.wav          # Áudio apenas com voz
    ├── instrumental.wav    # Áudio sem voz
    ├── waveform.json       # Dados da waveform
    └── lyrics.lrc         # Letras sincronizadas
```

## Exemplo

```
music/
└── AlceuValenca/
    ├── vocals.wav
    ├── instrumental.wav
    ├── waveform.json
    └── lyrics.lrc
```

## Vantagens

✅ **Organização**: Todos os arquivos de uma música em um só lugar  
✅ **Escalabilidade**: Fácil adicionar novas músicas  
✅ **Manutenção**: Estrutura clara e intuitiva  
✅ **Backend**: Caminhos simplificados e configuráveis  

## Configuração

O backend agora procura os arquivos em `music/[NomeDaMusica]/`

Você pode configurar o nome da música via variável de ambiente:
```bash
MUSIC_NAME=AlceuValenca npm run dev
```

Ou editar `backend/src/utils/paths.ts` para mudar o nome padrão.

## Migração de Arquivos Antigos

Os arquivos foram copiados (não movidos) para manter compatibilidade. Você pode:

1. **Manter os arquivos antigos** (para referência)
2. **Deletar os arquivos antigos** após confirmar que tudo funciona:
   - `just-voice/output/`
   - `voice-remove/output/`
   - `waveform-generator/wave_json/`
   - `lrc-generator/*.lrc` ou `lrc-generator/lrc-output/`

## Adicionar Novas Músicas

Para adicionar uma nova música:

1. Crie a pasta: `music/NovaMusica/`
2. Coloque os arquivos processados:
   - `vocals.wav`
   - `instrumental.wav`
   - `waveform.json`
   - `lyrics.lrc`
3. Configure o backend para usar a nova música (via `MUSIC_NAME` ou edite `paths.ts`)

