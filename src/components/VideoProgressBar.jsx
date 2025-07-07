import React, { useState, useEffect, useRef } from 'react';
import { isVideo } from '../utils/helpers';

function VideoProgressBar({ currentMediaFile }) {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (isVideo(currentMediaFile)) {
      setIsVisible(true);
      const videoElement = document.querySelector('.media-item video');
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
  }, [currentMediaFile]);

  const handleProgressClick = (e) => {
    if (!videoRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pos * videoRef.current.duration;
  };

  if (!isVisible) return null;

  return (
    <div
      className="video-progress-container absolute left-1/2 transform -translate-x-1/2 w-11/12 max-w-xl h-2 bg-black-shades-800 rounded-full overflow-hidden z-20 cursor-pointer bottom-32"
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