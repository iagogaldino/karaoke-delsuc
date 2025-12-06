import { useEffect, useRef, useState } from 'react';
import './LyricsDisplay.css';

interface Lyric {
  time: number;
  text: string;
}

interface LyricsDisplayProps {
  lyrics: Lyric[];
  currentTime: number;
}

export default function LyricsDisplay({ lyrics, currentTime }: LyricsDisplayProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // Encontrar linha ativa baseada no tempo atual
  useEffect(() => {
    if (lyrics.length === 0) return;

    // Encontrar a última linha que já passou
    let newActiveIndex = -1;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= lyrics[i].time) {
        newActiveIndex = i;
        break;
      }
    }

    if (newActiveIndex !== activeIndex) {
      setActiveIndex(newActiveIndex);
    }
  }, [currentTime, lyrics, activeIndex]);

  // Scroll automático para linha ativa
  useEffect(() => {
    if (activeRef.current && lyricsRef.current) {
      const container = lyricsRef.current;
      const activeElement = activeRef.current;

      const containerRect = container.getBoundingClientRect();
      const activeRect = activeElement.getBoundingClientRect();

      const offsetTop = activeRect.top - containerRect.top;
      const scrollPosition = container.scrollTop + offsetTop - containerRect.height / 2 + activeRect.height / 2;

      container.scrollTo({
        top: scrollPosition,
        behavior: 'smooth'
      });
    }
  }, [activeIndex]);

  if (lyrics.length === 0) {
    return (
      <div className="lyrics-display">
        <h3>Letras</h3>
        <p className="no-lyrics">Nenhuma letra disponível</p>
      </div>
    );
  }

  return (
    <div className="lyrics-display">
      <h3>Letras</h3>
      <div className="lyrics-container" ref={lyricsRef}>
        {lyrics.map((lyric, index) => {
          const isActive = index === activeIndex;
          const isPast = index < activeIndex;
          const isFuture = index > activeIndex;

          return (
            <div
              key={index}
              ref={isActive ? activeRef : null}
              className={`lyric-line ${isActive ? 'active' : ''} ${isPast ? 'past' : ''} ${isFuture ? 'future' : ''}`}
            >
              {lyric.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}

