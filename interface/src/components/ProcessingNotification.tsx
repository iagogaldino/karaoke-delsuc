import { ProcessingStatus } from '../types/index.js';
import './ProcessingNotification.css';

interface ProcessingNotificationProps {
  activeProcessings: { [fileId: string]: { status: ProcessingStatus; songId?: string; musicName?: string } };
  songs: Array<{ id: string; name: string; displayName?: string }>;
}

export default function ProcessingNotification({ activeProcessings, songs }: ProcessingNotificationProps) {
  // Obter todos os processamentos ativos com informações da música
  const activeProcessingsList = Object.entries(activeProcessings)
    .filter(([_, processing]) => 
      processing.status.status !== 'completed' && 
      processing.status.status !== 'error' &&
      processing.songId
    )
    .map(([fileId, processing]) => {
      const song = songs.find(s => s.id === processing.songId);
      return {
        fileId,
        songId: processing.songId!,
        musicName: song?.displayName || song?.name || processing.musicName || 'Processando...',
        status: processing.status
      };
    });

  if (activeProcessingsList.length === 0) {
    return null;
  }

  return (
    <div className="processing-notifications">
      {activeProcessingsList.map(({ fileId, songId, musicName, status }) => (
        <div key={fileId} className="processing-notification">
          <div className="processing-notification-title">{musicName}</div>
          <div className="processing-notification-progress">
            <div 
              className="processing-notification-progress-bar"
              style={{ width: `${status.progress}%` }}
            >
              <span className="processing-notification-progress-text">
                {status.step || 'Processando...'}
              </span>
            </div>
            <span className="processing-notification-progress-text-outside">
              {status.step || 'Processando...'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
