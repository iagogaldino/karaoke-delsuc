import { PlayerScore } from '../types/index.js';
import { formatNumber } from '../utils/formatters.js';
import './ResultsScreen.css';

interface ResultsScreenProps {
  score: PlayerScore;
  maxPossiblePoints: number;
  onBack: () => void;
}

export default function ResultsScreen({
  score,
  maxPossiblePoints,
  onBack
}: ResultsScreenProps) {
  const percentage = maxPossiblePoints > 0 
    ? Math.round((score.points / maxPossiblePoints) * 100) 
    : 0;

  const getMessage = () => {
    if (percentage >= 90) {
      return '🎉 Excelente! Você foi incrível!';
    } else if (percentage >= 70) {
      return '👏 Muito bom! Continue praticando!';
    } else if (percentage >= 50) {
      return '👍 Bom trabalho! Você está melhorando!';
    } else if (percentage >= 30) {
      return '💪 Continue tentando! Você consegue!';
    } else {
      return '🎵 Boa tentativa! Pratique mais!';
    }
  };

  const getEmoji = () => {
    if (percentage >= 90) return '🏆';
    if (percentage >= 70) return '⭐';
    if (percentage >= 50) return '👍';
    if (percentage >= 30) return '💪';
    return '🎵';
  };

  const getTitleColor = () => {
    if (percentage >= 90) return '#4ade80';
    if (percentage >= 70) return '#60a5fa';
    if (percentage >= 50) return '#fbbf24';
    if (percentage >= 30) return '#f97316';
    return '#ef4444';
  };

  return (
    <div className="results-screen">
      <div className="results-container">
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
            {formatNumber(score.points)}
            <span className="main-score-max"> / {formatNumber(maxPossiblePoints)}</span>
          </div>
          <div className="main-score-percentage" style={{ color: getTitleColor() }}>
            {percentage}%
          </div>
        </div>

        <div className="results-actions">
          <button className="results-btn results-btn-primary" onClick={onBack}>
            <i className="fas fa-home"></i>
            Voltar ao Início
          </button>
        </div>
      </div>
    </div>
  );
}
