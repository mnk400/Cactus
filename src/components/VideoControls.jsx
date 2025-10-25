import React from "react";

const VideoControls = ({
  isMuted,
  onToggleMute,
  showHint = false,
  className = "",
}) => {
  return (
    <div className={`video-controls ${className}`}>
      <button
        onClick={(e) => {
          e.stopPropagation(); // Prevent triggering video play/pause
          onToggleMute();
        }}
        className={`
          audio-toggle-btn flex items-center justify-center
          w-8 h-8 rounded-lg transition-all duration-200
          ${
            isMuted
              ? "bg-black-shades-800 bg-opacity-60 hover:bg-opacity-80 text-gray-500"
              : "bg-black-shades-700 bg-opacity-80 hover:bg-opacity-100 text-gray-200"
          }
          shadow-md hover:shadow-lg backdrop-blur-sm
        `}
        title={isMuted ? "Unmute video" : "Mute video"}
        aria-label={isMuted ? "Unmute video" : "Mute video"}
      >
        {isMuted ? (
          // Muted/no speaker icon
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3.63 3.63a.996.996 0 000 1.41L7.29 8.7 7 9H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91-.36.15-.58.53-.58.92 0 .72.73 1.18 1.39.91.8-.33 1.55-.77 2.22-1.31l4.18 4.18a.996.996 0 101.41-1.41L5.05 3.63c-.39-.39-1.02-.39-1.42 0zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-3.83-2.4-7.11-5.78-8.4-.59-.23-1.22.23-1.22.86v.19c0 .38.25.71.61.85C17.18 6.54 19 9.06 19 12zm-8.71-6.29l-.17.17L12 7.76V6.41c0-.89-1.08-1.33-1.71-.7zM16.5 12A4.5 4.5 0 0014 7.97v1.79l2.48 2.48c.01-.08.02-.16.02-.24z" />
          </svg>
        ) : (
          // Unmuted/speaker icon
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 10v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71V6.41c0-.89-1.08-1.33-1.71-.71L7 9H4c-.55 0-1 .45-1 1zm13.5 2A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 4.45v.2c0 .38.25.71.6.85C17.18 6.53 19 9.06 19 12s-1.82 5.47-4.4 6.5c-.36.14-.6.47-.6.85v.2c0 .63.63 1.07 1.21.85C18.6 19.11 21 15.84 21 12s-2.4-7.11-5.79-8.4c-.58-.23-1.21.22-1.21.85z" />
          </svg>
        )}
      </button>

      {showHint && (
        <div
          className="audio-hint absolute top-10 left-0 
                       bg-black bg-opacity-90 text-white text-xs px-2 py-1 rounded
                       whitespace-nowrap pointer-events-none z-30"
        >
          {isMuted ? "Tap to enable audio" : "Audio enabled"}
        </div>
      )}
    </div>
  );
};

export default VideoControls;
