import './StageLights.css';

interface StageLightsProps {
  isPlaying: boolean;
  variant?: 'lyrics' | 'video' | 'top';
}

export default function StageLights({ isPlaying, variant = 'lyrics' }: StageLightsProps) {
  // Holofotes no topo sempre visíveis quando variant é 'top'
  if (variant === 'top') {
    return (
      <div className="stage-lights stage-lights-top">
        <div className="top-spotlight top-spotlight-1">
          <div className="spotlight-head"></div>
          <div className="spotlight-base"></div>
        </div>
        <div className="top-spotlight top-spotlight-2">
          <div className="spotlight-head"></div>
          <div className="spotlight-base"></div>
        </div>
        <div className="top-spotlight top-spotlight-3">
          <div className="spotlight-head"></div>
          <div className="spotlight-base"></div>
        </div>
        <div className="top-spotlight top-spotlight-4">
          <div className="spotlight-head"></div>
          <div className="spotlight-base"></div>
        </div>
        <div className="top-spotlight top-spotlight-5">
          <div className="spotlight-head"></div>
          <div className="spotlight-base"></div>
        </div>
        <div className="top-spotlight top-spotlight-6">
          <div className="spotlight-head"></div>
          <div className="spotlight-base"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`stage-lights stage-lights-${variant}`}>
      <div className="light-spot light-spot-1"></div>
      <div className="light-spot light-spot-2"></div>
      <div className="light-spot light-spot-3"></div>
      <div className="light-spot light-spot-4"></div>
    </div>
  );
}
