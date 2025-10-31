import React, { useState, useEffect, useRef, useCallback } from "react";

function VideoProgressBar({ videoElement }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const videoRef = useRef(null);
  const progressBarRef = useRef(null);
  const animationRef = useRef(null);

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds) || timeInSeconds < 0) return "0:00";
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const updateProgress = useCallback(() => {
    if (!videoRef.current || !progressBarRef.current || isDragging) return;
    
    const progress = videoRef.current.duration ? 
      (videoRef.current.currentTime / videoRef.current.duration) * 100 : 0;
    
    progressBarRef.current.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    setCurrentTime(videoRef.current.currentTime);
  }, [isDragging]);

  const seekTo = useCallback((clientX) => {
    if (!videoRef.current?.duration) return;
    
    const rect = progressBarRef.current.parentElement.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newTime = pos * videoRef.current.duration;
    
    videoRef.current.currentTime = newTime;
    progressBarRef.current.style.width = `${pos * 100}%`;
    setCurrentTime(newTime);
  }, []);

  const handleStart = useCallback((e) => {
    setIsDragging(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    seekTo(clientX);
  }, [seekTo]);

  const handleMove = useCallback((e) => {
    if (isDragging) {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      seekTo(clientX);
    }
  }, [isDragging, seekTo]);

  const handleEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleMove);
      document.addEventListener('touchend', handleEnd);
      return () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', handleEnd);
      };
    }
  }, [isDragging, handleMove, handleEnd]);

  useEffect(() => {
    if (videoRef.current && videoRef.current !== videoElement) {
      if (progressBarRef.current) progressBarRef.current.style.width = '0%';
    }

    if (videoElement) {
      setIsVisible(true);
      videoRef.current = videoElement;

      const animate = () => {
        updateProgress();
        animationRef.current = requestAnimationFrame(animate);
      };

      const handleLoadedMetadata = () => {
        setDuration(videoElement.duration);
        setCurrentTime(videoElement.currentTime);
      };

      const handleLoadStart = () => {
        setCurrentTime(0);
        setDuration(0);
        if (progressBarRef.current) progressBarRef.current.style.width = '0%';
      };

      videoElement.addEventListener("loadedmetadata", handleLoadedMetadata);
      videoElement.addEventListener("loadstart", handleLoadStart);
      
      if (videoElement.duration) {
        setDuration(videoElement.duration);
        setCurrentTime(videoElement.currentTime);
      }

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        if (videoElement) {
          videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
          videoElement.removeEventListener("loadstart", handleLoadStart);
        }
      };
    } else {
      setIsVisible(false);
      setCurrentTime(0);
      setDuration(0);
      videoRef.current = null;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
  }, [videoElement, updateProgress]);

  if (!isVisible) return null;

  return (
    <div className="video-progress-wrapper w-full flex items-center gap-3">
      <span className="current-time text-sm text-white min-w-fit font-mono">
        {formatTime(currentTime)}
      </span>
      <div
        className="video-progress-container flex-1 h-3 bg-black-shades-600 rounded-full overflow-hidden cursor-pointer"
        onMouseDown={handleStart}
        onTouchStart={handleStart}
      >
        <div
          ref={progressBarRef}
          className="video-progress-bar h-full bg-white rounded-full"
          style={{ width: '0%' }}
        />
      </div>
      <div className="time-info flex gap-2 text-sm text-white min-w-fit">
        <span className="remaining-time font-mono">-{formatTime(duration - currentTime)}</span>
      </div>
    </div>
  );
}

export default VideoProgressBar;
