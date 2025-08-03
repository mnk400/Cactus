import React, { useState, useEffect, useRef } from "react";

function VideoProgressBar({ videoElement }) {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    // Clean up previous video element
    if (videoRef.current && videoRef.current !== videoElement) {
      setProgress(0);
    }

    if (videoElement) {
      setIsVisible(true);
      videoRef.current = videoElement;

      const handleTimeUpdate = () => {
        // Double-check that this is still the current video element
        if (videoRef.current === videoElement) {
          const progress =
            (videoElement.currentTime / videoElement.duration) * 100;
          setProgress(isNaN(progress) ? 0 : progress);
        }
      };

      const handleLoadedMetadata = () => {
        // Reset progress when new video loads
        if (videoRef.current === videoElement) {
          const progress =
            (videoElement.currentTime / videoElement.duration) * 100;
          setProgress(isNaN(progress) ? 0 : progress);
        }
      };

      videoElement.addEventListener("timeupdate", handleTimeUpdate);
      videoElement.addEventListener("loadedmetadata", handleLoadedMetadata);

      // Set initial progress
      handleLoadedMetadata();

      return () => {
        videoElement.removeEventListener("timeupdate", handleTimeUpdate);
        videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
      };
    } else {
      setIsVisible(false);
      setProgress(0);
      videoRef.current = null;
    }
  }, [videoElement]);

  const handleProgressClick = (e) => {
    if (!videoRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pos * videoRef.current.duration;
  };

  if (!isVisible) return null;

  return (
    <div
      className="video-progress-container w-full h-3 bg-black-shades-600 rounded-full overflow-hidden cursor-pointer"
      onClick={handleProgressClick}
    >
      <div
        className="video-progress-bar h-full bg-white rounded-full transition-width duration-100 ease-linear"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export default VideoProgressBar;
