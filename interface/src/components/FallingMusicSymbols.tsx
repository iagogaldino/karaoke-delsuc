import { useEffect, useState, useRef } from 'react';
import './FallingMusicSymbols.css';

interface FallingMusicSymbolsProps {
  isPlaying: boolean;
}

interface MusicSymbol {
  id: number;
  symbol: string;
  left: number;
  delay: number;
  duration: number;
  size: number;
  createdAt: number; // Timestamp de criação para controle independente
  rotationDirection: 'left' | 'right' | 'none'; // Direção de rotação independente
  usePulse: boolean; // Se deve usar animação pulsante
  colorVariant: number; // Variante de cor (0-4) para independência visual
}

const MUSIC_SYMBOLS = ['♪', '♫', '♬', '♭', '♯', '♮', '𝄞', '𝄢', '𝄡', '𝄪', '𝄫', '𝄐', '𝄑', '𝄒', '𝄓', '𝄔', '𝄕', '𝄖', '𝄗', '𝄘', '𝄙', '𝄚', '𝄛', '𝄜', '𝄝', '𝄞', '𝄟', '𝄠', '𝄡', '𝄢', '𝄣', '𝄤', '𝄥', '𝄦', '𝄧', '𝄨', '𝄩', '𝄪', '𝄫', '𝄬', '𝄭', '𝄮', '𝄯', '𝄰', '𝄱', '𝄲', '𝄳', '𝄴', '𝄵', '𝄶', '𝄷', '𝄸', '𝄹', '𝄺', '𝄻', '𝄼', '𝄽', '𝄾', '𝄿', '𝅀', '𝅁', '𝅂', '𝅃', '𝅄', '𝅅', '𝅆', '𝅇', '𝅈', '𝅉', '𝅊', '𝅋', '𝅌', '𝅍', '𝅎', '𝅏', '𝅐', '𝅑', '𝅒', '𝅓', '𝅔', '𝅕', '𝅖', '𝅗', '𝅘', '𝅙', '𝅚', '𝅛', '𝅜', '𝅝', '𝅗𝅥', '𝅘𝅥', '𝅘𝅥𝅮', '𝅘𝅥𝅯', '𝅘𝅥𝅰', '𝅘𝅥𝅱', '𝅘𝅥𝅲', '𝅥', '𝅦', '𝅧', '𝅨', '𝅩', '𝅪', '𝅫', '𝅬', '𝅭', '𝅮', '𝅯', '𝅰', '𝅱', '𝅲', '𝅳', '𝅴', '𝅵', '𝅶', '𝅷', '𝅸', '𝅹', '𝅺', '𝅻', '𝅼', '𝅽', '𝅾', '𝅿', '𝆀', '𝆁', '𝆂', '𝆃', '𝆄', '𝆅', '𝆆', '𝆇', '𝆈', '𝆉', '𝆊', '𝆋', '𝆌', '𝆍', '𝆎', '𝆏', '𝆐', '𝆑', '𝆒', '𝆓', '𝆔', '𝆕', '𝆖', '𝆗', '𝆘', '𝆙', '𝆚', '𝆛', '𝆜', '𝆝', '𝆞', '𝆟', '𝆠', '𝆡', '𝆢', '𝆣', '𝆤', '𝆥', '𝆦', '𝆧', '𝆨', '𝆩', '𝆪', '𝆫', '𝆬', '𝆭', '𝆮', '𝆯', '𝆰', '𝆱', '𝆲', '𝆳', '𝆴', '𝆵', '𝆶', '𝆷', '𝆸', '𝆹', '𝆺', '𝆹𝅥', '𝆺𝅥', '𝆹𝅥𝅮', '𝆺𝅥𝅮', '𝆹𝅥𝅯', '𝆺𝅥𝅯', '𝇁', '𝇂', '𝇃', '𝇄', '𝇅', '𝇆', '𝇇', '𝇈', '𝇉', '𝇊', '𝇋', '𝇌', '𝇍', '𝇎', '𝇏', '𝇐', '𝇑', '𝇒', '𝇓', '𝇔', '𝇕', '𝇖', '𝇗', '𝇘', '𝇙', '𝇚', '𝇛', '𝇜', '𝇝', '𝇞', '𝇟', '𝇠', '𝇡', '𝇢', '𝇣', '𝇤', '𝇥', '𝇦', '𝇧', '𝇨', '𝇩', '𝇪', '𝇫', '𝇬', '𝇭', '𝇮', '𝇯', '𝇰', '𝇱', '𝇲', '𝇳', '𝇴', '𝇵', '𝇶', '𝇷', '𝇸', '𝇹', '𝇺', '𝇻', '𝇼', '𝇽', '𝇾', '𝇿'];

// Usar símbolos mais comuns e visíveis
const COMMON_SYMBOLS = ['♪', '♫', '♬', '♭', '♯', '♮', '𝄞', '𝄢', '𝄡', '𝄪', '𝄫'];

export default function FallingMusicSymbols({ isPlaying }: FallingMusicSymbolsProps) {
  const [symbols, setSymbols] = useState<MusicSymbol[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPlaying) {
      setSymbols([]);
      return;
    }

    const createSymbol = (): MusicSymbol => {
      const symbolIndex = Math.floor(Math.random() * COMMON_SYMBOLS.length);
      const now = Date.now();
      const uniqueId = now + Math.random() * 1000000; // ID único para cada símbolo
      const rotationOptions: ('left' | 'right' | 'none')[] = ['left', 'right', 'none'];
      return {
        id: uniqueId,
        symbol: COMMON_SYMBOLS[symbolIndex],
        left: Math.random() * 100, // 0-100%
        delay: Math.random() * 2, // 0-2s - delay inicial variado
        duration: 3 + Math.random() * 7, // 3-10s - maior variação de duração
        size: 1.2 + Math.random() * 1.8, // 1.2-3rem
        createdAt: now,
        rotationDirection: rotationOptions[Math.floor(Math.random() * rotationOptions.length)],
        usePulse: Math.random() < 0.15, // 15% de chance de usar animação pulsante
        colorVariant: Math.floor(Math.random() * 5), // 0-4 para diferentes cores
      };
    };

    // Função para criar um novo símbolo
    const createNextSymbol = () => {
      setSymbols(prev => {
        const now = Date.now();
        // Remover símbolos que já completaram sua animação
        const activeSymbols = prev.filter(s => {
          const age = now - s.createdAt;
          const totalAnimationTime = (s.delay + s.duration) * 1000; // Tempo total em ms
          return age < totalAnimationTime + 500; // Manter por 500ms após animação
        });

        // Limitar número máximo de símbolos simultâneos
        const maxSymbols = 25;
        if (activeSymbols.length >= maxSymbols) {
          return activeSymbols;
        }

        // Adicionar novo símbolo
        return [...activeSymbols, createSymbol()];
      });
    };

    // Criar primeiro símbolo imediatamente
    createNextSymbol();

    // Criar múltiplos intervalos independentes para garantir que símbolos apareçam em momentos diferentes
    const intervals: NodeJS.Timeout[] = [];
    
    // Criar 3-5 intervalos independentes com diferentes frequências
    const numIntervals = 4;
    for (let i = 0; i < numIntervals; i++) {
      const baseInterval = 400 + i * 150; // Intervalos base: 400ms, 550ms, 700ms, 850ms
      const interval = setInterval(() => {
        createNextSymbol();
      }, baseInterval + Math.random() * 200); // Adicionar variação aleatória
      intervals.push(interval);
    }

    // Também criar símbolos com timeouts aleatórios para mais variação
    const createRandomSymbol = () => {
      createNextSymbol();
      const nextDelay = 200 + Math.random() * 600;
      const timeout = setTimeout(createRandomSymbol, nextDelay);
      intervals.push(timeout);
    };
    
    // Iniciar criação aleatória após um delay inicial variado
    const initialTimeout = setTimeout(createRandomSymbol, 300 + Math.random() * 400);
    intervals.push(initialTimeout);

    return () => {
      intervals.forEach(id => {
        clearInterval(id);
        clearTimeout(id);
      });
    };
  }, [isPlaying]);

  if (!isPlaying || symbols.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="falling-music-symbols">
      {symbols.map(symbol => {
        // Determinar animação baseada na direção de rotação e efeito pulsante
        let animationName = 'fall-down';
        if (symbol.usePulse) {
          animationName = 'fall-down-pulse';
        } else if (symbol.rotationDirection === 'left') {
          animationName = 'fall-down-rotate-left';
        } else if (symbol.rotationDirection === 'right') {
          animationName = 'fall-down-rotate-right';
        }

        // Determinar cor baseada na variante
        const colorStyles = {
          0: {
            color: 'rgba(74, 144, 226, 0.8)',
            textShadow: '0 0 15px rgba(74, 144, 226, 0.9), 0 0 25px rgba(74, 144, 226, 0.6), 0 0 35px rgba(74, 144, 226, 0.4)',
            filter: 'drop-shadow(0 0 5px rgba(74, 144, 226, 0.5))',
          },
          1: {
            color: 'rgba(74, 222, 128, 0.8)',
            textShadow: '0 0 15px rgba(74, 222, 128, 0.9), 0 0 25px rgba(74, 222, 128, 0.6), 0 0 35px rgba(74, 222, 128, 0.4)',
            filter: 'drop-shadow(0 0 5px rgba(74, 222, 128, 0.5))',
          },
          2: {
            color: 'rgba(255, 215, 0, 0.8)',
            textShadow: '0 0 15px rgba(255, 215, 0, 0.9), 0 0 25px rgba(255, 215, 0, 0.6), 0 0 35px rgba(255, 215, 0, 0.4)',
            filter: 'drop-shadow(0 0 5px rgba(255, 215, 0, 0.5))',
          },
          3: {
            color: 'rgba(255, 107, 107, 0.8)',
            textShadow: '0 0 15px rgba(255, 107, 107, 0.9), 0 0 25px rgba(255, 107, 107, 0.6), 0 0 35px rgba(255, 107, 107, 0.4)',
            filter: 'drop-shadow(0 0 5px rgba(255, 107, 107, 0.5))',
          },
          4: {
            color: 'rgba(168, 85, 247, 0.8)',
            textShadow: '0 0 15px rgba(168, 85, 247, 0.9), 0 0 25px rgba(168, 85, 247, 0.6), 0 0 35px rgba(168, 85, 247, 0.4)',
            filter: 'drop-shadow(0 0 5px rgba(168, 85, 247, 0.5))',
          },
        };

        const colorStyle = colorStyles[symbol.colorVariant as keyof typeof colorStyles] || colorStyles[0];

        return (
          <div
            key={symbol.id}
            className="music-symbol"
            style={{
              left: `${symbol.left}%`,
              animationDelay: `${symbol.delay}s`,
              animationDuration: `${symbol.duration}s`,
              animationName: animationName,
              fontSize: `${symbol.size}rem`,
              ...colorStyle,
            }}
          >
            {symbol.symbol}
          </div>
        );
      })}
    </div>
  );
}
