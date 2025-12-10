# Análise de Performance - Frontend

## Problemas Identificados

### 1. **App.tsx - Componente Principal**
- **17 estados diferentes** - Muitos estados causam re-renders frequentes
- **Funções não memoizadas** - Handlers recriados a cada render
- **Componentes recebem funções inline** - Causam re-renders desnecessários
- **Recarregamentos completos** - `handleSaveSongName` e `handleAudioModeChange` recarregam todas as músicas

### 2. **SongTree.tsx - Lista de Músicas**
- **Componente não memoizado** - Re-renderiza mesmo quando props não mudam significativamente
- **Funções inline passadas como props** - Criam novas referências a cada render
- **23 operações de array** - Maps e filters sem memoização adequada

### 3. **HomeScreen.tsx - Tela Inicial**
- **setVisiblePhotos cria novos Sets** - Cria novo objeto a cada atualização
- **Intervalos não otimizados** - Polling a cada 10-15 segundos sem debounce
- **Múltiplos useEffects** - Podem ser combinados

### 4. **LyricsDisplay.tsx - Display de Letras**
- **useEffect com currentTime** - Roda a cada frame (alta frequência)
- **Busca linear** - Loop O(n) para encontrar linha ativa
- **Scroll em requestAnimationFrame** - Pode ser otimizado com throttle

### 5. **KaraokeView.tsx - Modo Player**
- **Muitos estados e refs** - 15+ refs e estados
- **WebSocket pode ter problemas de cleanup**

### 6. **AudioPlayer.tsx**
- **useEffect sem memoização de dependências** - Pode causar reloads desnecessários

## Otimizações Recomendadas (Prioridade)

### Alta Prioridade
1. ✅ Memoizar SongTree com React.memo
2. ✅ Usar useCallback para handlers no App.tsx
3. ✅ Otimizar LyricsDisplay para evitar re-renders por currentTime
4. ✅ Usar atualização granular em vez de reload completo

### Média Prioridade
5. ✅ Memoizar cálculos pesados com useMemo
6. ✅ Debounce/throttle em atualizações frequentes
7. ✅ Lazy loading de componentes pesados

### Baixa Prioridade
8. ⚠️ Code splitting por rotas
9. ⚠️ Virtualização de listas longas

