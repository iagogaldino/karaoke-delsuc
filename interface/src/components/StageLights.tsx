import './StageLights.css';

interface StageLightsProps {
  isPlaying: boolean;
  variant?: 'lyrics' | 'video';
}

export default function StageLights({ isPlaying, variant = 'lyrics' }: StageLightsProps) {
  if (!isPlaying) return null;

  return (
    <div className={`stage-lights stage-lights-${variant}`}>
      <div className="light-spot light-spot-1"></div>
      <div className="light-spot light-spot-2"></div>
      <div className="light-spot light-spot-3"></div>
      <div className="light-spot light-spot-4"></div>
    </div>
  );
}
