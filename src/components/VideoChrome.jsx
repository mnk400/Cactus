import React, { memo, useCallback, useEffect, useState } from "react";
import VideoProgressBar from "./VideoProgressBar";
import { useAudio } from "../context/MediaContext";

const VideoChrome = memo(function VideoChrome({ videoRef }) {
  const { isMuted, toggleMute } = useAudio();

  // Track when the <video> DOM node populates the ref so VideoProgressBar
  // gets a live element (refs alone don't trigger re-renders).
  const [videoElement, setVideoElement] = useState(videoRef.current);
  useEffect(() => {
    setVideoElement(videoRef.current);
  }, [videoRef]);
  const handleFullscreen = useCallback(
    (e) => {
      e.stopPropagation();
      const video = videoRef.current;
      if (!video) return;

      if (video.requestFullscreen) video.requestFullscreen();
      else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen();
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
      else if (video.msRequestFullscreen) video.msRequestFullscreen();
    },
    [videoRef],
  );

  const handleMute = useCallback(
    (e) => {
      e.stopPropagation();
      toggleMute();
    },
    [toggleMute],
  );

  const stop = useCallback((e) => e.stopPropagation(), []);

  return (
    <div
      className="pointer-events-auto absolute inset-x-0 bottom-3 z-20 flex items-center gap-2 px-3"
      onClick={stop}
      onMouseDown={stop}
      onTouchStart={stop}
    >
      <button
        onClick={handleMute}
        title={isMuted ? "Unmute (M)" : "Mute (M)"}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-black/60 text-white shadow-sm backdrop-blur-md transition-all duration-150 hover:bg-black/80 active:scale-95"
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
      <div className="min-w-0 flex-1">
        <VideoProgressBar videoElement={videoElement} variant="pill" />
      </div>
      <button
        onClick={handleFullscreen}
        title="Fullscreen (F)"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-black/60 text-white shadow-sm backdrop-blur-md transition-all duration-150 hover:bg-black/80 active:scale-95"
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
  );
});

export default VideoChrome;
