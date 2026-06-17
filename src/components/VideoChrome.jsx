import React, { memo, useCallback } from "react";
import { useAudio, useVideoElement } from "../context/MediaContext";

// Top-right controls pill mirroring MediaSourceBadge. Renders only while a
// video is the active media item.
const VideoChrome = memo(function VideoChrome() {
  const { isMuted, toggleMute } = useAudio();
  const { videoElement } = useVideoElement();

  const handleFullscreen = useCallback(
    (e) => {
      e.stopPropagation();
      const v = videoElement;
      if (!v) return;
      if (v.requestFullscreen) v.requestFullscreen();
      else if (v.webkitRequestFullscreen) v.webkitRequestFullscreen();
      else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
      else if (v.msRequestFullscreen) v.msRequestFullscreen();
    },
    [videoElement],
  );

  const handleMute = useCallback(
    (e) => {
      e.stopPropagation();
      toggleMute();
    },
    [toggleMute],
  );

  if (!videoElement) return null;

  return (
    <div
      className="pointer-events-none fixed right-0 top-0 z-20 flex justify-end px-4"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0.75rem))" }}
    >
      <div className="pointer-events-auto flex items-center overflow-hidden rounded-xl bg-black/60 shadow-sm backdrop-blur-md">
        <button
          type="button"
          onClick={handleMute}
          title={isMuted ? "Unmute (M)" : "Mute (M)"}
          className="flex h-8 w-8 items-center justify-center text-white transition-all duration-150 hover:bg-white/15 active:scale-95"
        >
          {isMuted ? (
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
              />
            </svg>
          ) : (
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8.5 8.5 0 010 11.9M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={handleFullscreen}
          title="Fullscreen (F)"
          className="flex h-8 w-8 items-center justify-center text-white transition-all duration-150 hover:bg-white/15 active:scale-95"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
        </button>
      </div>
    </div>
  );
});

export default VideoChrome;
