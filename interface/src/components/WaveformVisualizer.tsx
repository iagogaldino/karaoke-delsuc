import { useEffect, useRef, useState } from 'react';
import './WaveformVisualizer.css';

interface WaveformVisualizerProps {
  waveformData: {
    sample_rate: number;
    duration: number;
    num_samples: number;
    preview?: number[];
    totalChunks?: number;
  } | null;
  currentTime: number;
  isPlaying: boolean;
  songId: string | null;
}

export default function WaveformVisualizer({
  waveformData,
  currentTime,
  songId
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformRef = useRef<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar waveform completa via SSE
  useEffect(() => {
    if (!waveformData || !songId) return;

    const streamUrl = songId ? `/api/waveform/stream?song=${songId}` : '/api/waveform/stream';
    const eventSource = new EventSource(streamUrl);
    const fullWaveform: number[] = [];

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'metadata') {
          // Metadados recebidos
          console.log('Waveform metadata received');
        } else if (data.type === 'chunk') {
          // Chunk recebido - adicionar ao array completo
          fullWaveform.push(...data.data);
          waveformRef.current = [...fullWaveform];
          drawWaveform();
        } else if (data.type === 'end') {
          // Stream completo
          eventSource.close();
          setIsLoading(false);
          console.log('Waveform loaded completely');
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
      setIsLoading(false);
    };

    return () => {
      eventSource.close();
    };
  }, [waveformData, songId]);

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas || waveformRef.current.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const waveform = waveformRef.current;

    // Limpar canvas
    ctx.clearRect(0, 0, width, height);

    // Calcular pontos para desenhar
    const pointsPerPixel = Math.ceil(waveform.length / width);
    const centerY = height / 2;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;

    ctx.beginPath();

    for (let x = 0; x < width; x++) {
      const startIdx = Math.floor(x * pointsPerPixel);
      const endIdx = Math.min(startIdx + pointsPerPixel, waveform.length);

      if (startIdx >= waveform.length) break;

      // Encontrar valor máximo e mínimo neste intervalo
      let max = 0;
      let min = 0;
      for (let i = startIdx; i < endIdx; i++) {
        const value = Math.abs(waveform[i]);
        if (value > max) max = value;
        if (-value < min) min = -value;
      }

      const y1 = centerY - (max * centerY);
      const y2 = centerY - (min * centerY);

      if (x === 0) {
        ctx.moveTo(x, y1);
      } else {
        ctx.lineTo(x, y1);
      }
      ctx.lineTo(x, y2);
    }

    ctx.stroke();

    // Desenhar indicador de tempo atual
    if (waveformData) {
      const progress = currentTime / waveformData.duration;
      const xPos = progress * width;

      ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xPos, 0);
      ctx.lineTo(xPos, height);
      ctx.stroke();
    }
  };

  useEffect(() => {
    drawWaveform();
  }, [currentTime, waveformData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = 150;
        drawWaveform();
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  if (!waveformData) {
    return <div className="waveform-loading">Carregando waveform...</div>;
  }

  return (
    <div className="waveform-container">
      <h3>Waveform</h3>
      {isLoading && (
        <div className="waveform-loading">
          Carregando waveform completa... ({waveformRef.current.length.toLocaleString()} / {waveformData.num_samples.toLocaleString()} pontos)
        </div>
      )}
      <canvas ref={canvasRef} className="waveform-canvas" />
    </div>
  );
}

