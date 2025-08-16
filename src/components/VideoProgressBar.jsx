import React, { useState, useEffect, useRef } from "react";

function VideoProgressBar({ videoElement }) {
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const videoRef = useRef(null);

  // Helper function to format time in MM:SS or HH:MM:SS format
  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds) || timeInSeconds < 0) return "0:00";

    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    // Clean up previous video element
    if (videoRef.current && videoRef.current !== videoElement) {
      setProgress(0);
    }

    if (videoElement) {
      setIsVisible(true);
      videoRef.current = videoElement;

      const handleTimeUpdate = () => {
        // Double-check that this is still the current video element and it's valid
        if (videoRef.current === videoElement && videoElement.duration) {
          const progress =
            (videoElement.currentTime / videoElement.duration) * 100;
          setProgress(
            isNaN(progress) ? 0 : Math.min(100, Math.max(0, progress)),
          );
          setCurrentTime(videoElement.currentTime);
          setDuration(videoElement.duration);
        }
      };

      const handleLoadedMetadata = () => {
        // Reset progress when new video loads
        if (videoRef.current === videoElement && videoElement.duration) {
          const progress =
            (videoElement.currentTime / videoElement.duration) * 100;
          setProgress(
            isNaN(progress) ? 0 : Math.min(100, Math.max(0, progress)),
          );
          setCurrentTime(videoElement.currentTime);
          setDuration(videoElement.duration);
        }
      };

      const handleDurationChange = () => {
        // Handle duration changes
        if (videoRef.current === videoElement) {
          handleTimeUpdate();
        }
      };

      const handleLoadStart = () => {
        // Reset progress when video starts loading
        setProgress(0);
        setCurrentTime(0);
        setDuration(0);
      };

      // Add event listeners
      videoElement.addEventListener("timeupdate", handleTimeUpdate);
      videoElement.addEventListener("loadedmetadata", handleLoadedMetadata);
      videoElement.addEventListener("durationchange", handleDurationChange);
      videoElement.addEventListener("loadstart", handleLoadStart);

      // Set initial progress if video is already loaded
      if (videoElement.duration) {
        handleTimeUpdate();
      }

      return () => {
        if (videoElement) {
          videoElement.removeEventListener("timeupdate", handleTimeUpdate);
          videoElement.removeEventListener(
            "loadedmetadata",
            handleLoadedMetadata,
          );
          videoElement.removeEventListener(
            "durationchange",
            handleDurationChange,
          );
          videoElement.removeEventListener("loadstart", handleLoadStart);
        }
      };
    } else {
      setIsVisible(false);
      setProgress(0);
      setCurrentTime(0);
      setDuration(0);
      videoRef.current = null;
    }
  }, [videoElement]);

  const handleProgressClick = (e) => {
    if (!videoRef.current || !videoRef.current.duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = pos * videoRef.current.duration;

    // Ensure the new time is valid
    if (
      !isNaN(newTime) &&
      newTime >= 0 &&
      newTime <= videoRef.current.duration
    ) {
      videoRef.current.currentTime = newTime;
    }
  };

  if (!isVisible) return null;

  const remainingTime = duration - currentTime;

  return (
    <div className="video-progress-wrapper w-full flex items-center gap-3">
      <span className="current-time text-sm text-white min-w-fit">
        {formatTime(currentTime)}
      </span>
      <div
        className="video-progress-container flex-1 h-3 bg-black-shades-600 rounded-full overflow-hidden cursor-pointer"
        onClick={handleProgressClick}
      >
        <div
          className="video-progress-bar h-full bg-white rounded-full transition-width duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="time-info flex gap-2 text-sm text-white min-w-fit">
        <span className="remaining-time">-{formatTime(remainingTime)}</span>
      </div>
    </div>
  );
}

export default VideoProgressBar;
