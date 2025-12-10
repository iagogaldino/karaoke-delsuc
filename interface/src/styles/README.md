# Sistema de Temas

Este projeto utiliza um sistema de temas centralizado usando **CSS Variables (Custom Properties)**. Todas as cores estão definidas no arquivo `theme.css`.

## Localização

- **Arquivo de tema**: `interface/src/styles/theme.css`
- **Importação**: O tema é importado automaticamente via `index.css` e `main.tsx`

## Como usar

### Em arquivos CSS

Use as variáveis CSS diretamente:

```css
.my-component {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
}
```

### Variáveis disponíveis

#### Backgrounds
- `--bg-primary`: Fundo principal (#0d0d0d)
- `--bg-secondary`: Fundo secundário (#1a1a1a)
- `--bg-tertiary`: Fundo terciário (rgba(255, 255, 255, 0.02))
- `--bg-hover`: Background no hover
- `--bg-active`: Background quando ativo
- `--bg-overlay`: Overlays sutis

#### Textos
- `--text-primary`: Texto principal (branco)
- `--text-secondary`: Texto secundário
- `--text-tertiary`: Texto terciário
- `--text-quaternary`: Texto quaternário
- `--text-quinary`: Texto menos destacado
- `--text-disabled`: Texto desabilitado

#### Cores de destaque (Accents)
- `--accent-primary`: Azul principal (#4a90e2)
- `--accent-primary-hover`: Azul hover (#5aa0f2)
- `--accent-secondary`: Roxo secundário (#667eea)
- `--success`: Verde de sucesso (#10b981)
- `--danger`: Vermelho de perigo (#ff4444)
- `--warning`: Laranja de aviso (#f59e0b)

#### Bordas
- `--border-primary`: Borda primária
- `--border-secondary`: Borda secundária
- `--border-focus`: Borda no foco

#### Inputs
- `--input-bg`: Background de inputs
- `--input-bg-focus`: Background quando focado
- `--input-border`: Borda de inputs
- `--input-border-focus`: Borda quando focado

## Como alterar o tema

Para criar um novo tema, basta modificar as variáveis em `theme.css`. Por exemplo, para um tema claro:

```css
:root {
  --bg-primary: #ffffff;
  --text-primary: #000000;
  /* ... outras cores */
}
```

Ou criar um tema alternativo usando classes:

```css
:root[data-theme="light"] {
  --bg-primary: #ffffff;
  --text-primary: #000000;
}

:root[data-theme="dark"] {
  --bg-primary: #0d0d0d;
  --text-primary: #ffffff;
}
```

E então aplicar via JavaScript:

```javascript
document.documentElement.setAttribute('data-theme', 'light');
```

