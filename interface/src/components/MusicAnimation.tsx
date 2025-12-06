import './MusicAnimation.css';

export default function MusicAnimation() {
  return (
    <div className="music-animation">
      {/* Notas musicais flutuantes */}
      <div className="music-note note-1">
        <i className="fas fa-music"></i>
      </div>
      <div className="music-note note-2">
        <i className="fas fa-music"></i>
      </div>
      <div className="music-note note-3">
        <i className="fas fa-music"></i>
      </div>
      <div className="music-note note-4">
        <i className="fas fa-music"></i>
      </div>
      <div className="music-note note-5">
        <i className="fas fa-music"></i>
      </div>
      <div className="music-note note-6">
        <i className="fas fa-music"></i>
      </div>

      {/* Ondas sonoras */}
      <div className="sound-wave wave-1"></div>
      <div className="sound-wave wave-2"></div>
      <div className="sound-wave wave-3"></div>
      <div className="sound-wave wave-4"></div>
      <div className="sound-wave wave-5"></div>

      {/* Partituras flutuantes */}
      <div className="staff staff-1">
        <div className="staff-line"></div>
        <div className="staff-line"></div>
        <div className="staff-line"></div>
        <div className="staff-line"></div>
        <div className="staff-line"></div>
      </div>
      <div className="staff staff-2">
        <div className="staff-line"></div>
        <div className="staff-line"></div>
        <div className="staff-line"></div>
        <div className="staff-line"></div>
        <div className="staff-line"></div>
      </div>
    </div>
  );
}

