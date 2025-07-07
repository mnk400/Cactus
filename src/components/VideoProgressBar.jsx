import React, { useState, useEffect, useRef } from 'react';
import { isVideo } from '../utils/helpers';

function VideoProgressBar({ videoElement }) {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoElement) {
      setIsVisible(true);
      videoRef.current = videoElement;

      if (videoElement) {
        const handleTimeUpdate = () => {
          const progress = (videoElement.currentTime / videoElement.duration) * 100;
          setProgress(isNaN(progress) ? 0 : progress);
        };

        videoElement.addEventListener('timeupdate', handleTimeUpdate);
        return () => {
          videoElement.removeEventListener('timeupdate', handleTimeUpdate);
        };
      }
    } else {
      setIsVisible(false);
      setProgress(0);
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