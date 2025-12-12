import { useEffect, useState } from 'react';
import { PlayerScore } from '../types/index.js';
import { formatNumber } from '../utils/formatters.js';
import './ResultsScreen.css';

interface ResultsScreenProps {
  score: PlayerScore;
  maxPossiblePoints: number;
  userName?: string;
  userPhoto?: string;
  isLoading?: boolean;
  onBack: () => void;
}

// Função de easing easeOutCubic
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function ResultsScreen({
  score,
  maxPossiblePoints,
  userName,
  userPhoto,
  isLoading = false,
  onBack
}: ResultsScreenProps) {
  const [timeRemaining, setTimeRemaining] = useState(60); // 60 segundos = 1 minuto
  const [animatedScore, setAnimatedScore] = useState(0);
  const [animatedPercentage, setAnimatedPercentage] = useState(0);

  const percentage = maxPossiblePoints > 0 
    ? Math.round((score.points / maxPossiblePoints) * 100) 
    : 0;

  // Animar pontuação quando não estiver carregando e houver pontuação
  useEffect(() => {
    if (!isLoading && score.points > 0) {
      // Resetar para começar animação do zero apenas uma vez
      if (animatedScore === 0 && animatedPercentage === 0) {
        const duration = 2500; // 2.5 segundos
        const startTime = Date.now();
        const startScore = 0;
        const endScore = score.points;
        const startPercentage = 0;
        const endPercentage = percentage;

        const animate = () => {
          const now = Date.now();
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          const easedProgress = easeOutCubic(progress);
          
          const currentScore = Math.round(startScore + (endScore - startScore) * easedProgress);
          const currentPercentage = Math.round(startPercentage + (endPercentage - startPercentage) * easedProgress);
          
          setAnimatedScore(currentScore);
          setAnimatedPercentage(currentPercentage);

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            // Garantir valores finais
            setAnimatedScore(endScore);
            setAnimatedPercentage(endPercentage);
          }
        };

        // Pequeno delay antes de começar animação
        setTimeout(() => {
          requestAnimationFrame(animate);
        }, 300);
      }
    }
  }, [isLoading, score.points, percentage, animatedScore, animatedPercentage]);

  // Redirecionamento automático após 1 minuto (apenas quando não estiver carregando)
  useEffect(() => {
    if (isLoading) return; // Não iniciar timer se ainda estiver carregando

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onBack();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [onBack, isLoading]);

  const getMessage = () => {
    const currentPercentage = isLoading ? 0 : animatedPercentage;
    if (currentPercentage >= 90) {
      return '🎉 Excelente! Você foi incrível!';
    } else if (currentPercentage >= 70) {
      return '👏 Muito bom! Continue praticando!';
    } else if (currentPercentage >= 50) {
      return '👍 Bom trabalho! Você está melhorando!';
    } else if (currentPercentage >= 30) {
      return '💪 Continue tentando! Você consegue!';
    } else {
      return '🎵 Boa tentativa! Pratique mais!';
    }
  };

  const getEmoji = () => {
    const currentPercentage = isLoading ? 0 : animatedPercentage;
    if (currentPercentage >= 90) return '🏆';
    if (currentPercentage >= 70) return '⭐';
    if (currentPercentage >= 50) return '👍';
    if (currentPercentage >= 30) return '💪';
    return '🎵';
  };

  const getTitleColor = () => {
    const currentPercentage = isLoading ? 0 : animatedPercentage;
    if (currentPercentage >= 90) return '#4ade80';
    if (currentPercentage >= 70) return '#60a5fa';
    if (currentPercentage >= 50) return '#fbbf24';
    if (currentPercentage >= 30) return '#f97316';
    return '#ef4444';
  };

  // Se estiver carregando, mostrar tela de loading
  if (isLoading) {
    return (
      <div className="results-screen">
        <div className="results-spotlights">
          <div className="results-spotlight results-spotlight-1"></div>
          <div className="results-spotlight results-spotlight-2"></div>
          <div className="results-spotlight results-spotlight-3"></div>
        </div>
        
        <div className="results-container">
          <div className="results-loading">
            <div className="results-loading-spinner"></div>
            <h2 className="results-loading-text">Processando gravação...</h2>
            <p className="results-loading-subtext">Aguarde enquanto geramos o LRC e calculamos sua pontuação</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="results-screen">
      {/* Holofotes de fundo com efeitos */}
      <div className="results-spotlights">
        <div className="results-spotlight results-spotlight-1"></div>
        <div className="results-spotlight results-spotlight-2"></div>
        <div className="results-spotlight results-spotlight-3"></div>
        <div className="results-spotlight results-spotlight-4"></div>
        <div className="results-spotlight results-spotlight-5"></div>
        <div className="results-spotlight results-spotlight-6"></div>
      </div>
      
      <div className="results-container">
        {/* Layout horizontal: foto + conteúdo principal lado a lado */}
        <div className="results-layout">
          {/* Coluna esquerda: Foto do usuário */}
          {(userName || userPhoto) && (
            <div className="results-user-section">
              {userPhoto && (() => {
                const fileName = userPhoto.includes('/') 
                  ? userPhoto.split('/').pop() 
                  : userPhoto;
                const photoUrl = `/music/users-photos/${fileName}`;
                
                return (
                  <img 
                    src={photoUrl} 
                    alt={userName || 'Usuário'} 
                    className="results-user-photo"
                    onError={(e) => {
                      const altPath = `/music/${userPhoto}`;
                      if (altPath !== photoUrl) {
                        e.currentTarget.src = altPath;
                      } else {
                        e.currentTarget.style.display = 'none';
                      }
                    }}
                  />
                );
              })()}
              {userName && (
                <div className="results-user-name">{userName}</div>
              )}
            </div>
          )}

          {/* Coluna direita: Conteúdo principal */}
          <div className="results-content-section">
            <div className="results-header">
              <div className="results-emoji" style={{ color: getTitleColor() }}>
                {getEmoji()}
              </div>
              <h1 className="results-title" style={{ color: getTitleColor() }}>
                Música Finalizada!
              </h1>
            </div>
            
            <div className="results-message">
              <p>{getMessage()}</p>
            </div>

            <div className="results-main-score">
              <div className="main-score-label">Pontuação Total</div>
              <div className="main-score-value" style={{ color: getTitleColor() }}>
                {formatNumber(animatedScore)}
                <span className="main-score-max"> / {formatNumber(maxPossiblePoints)}</span>
              </div>
              <div className="main-score-percentage" style={{ color: getTitleColor() }}>
                {animatedPercentage}%
              </div>
            </div>

            <div className="results-actions">
              <div className="results-auto-redirect">
                <p>Redirecionando automaticamente em {timeRemaining}s...</p>
              </div>
              <button className="results-btn results-btn-primary" onClick={onBack}>
                <i className="fas fa-home"></i>
                Voltar ao Início
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
