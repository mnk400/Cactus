import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import VideoControls from "./VideoControls";
import { useVideoSettings } from "../hooks/useVideoSettings";

const MediaItem = memo(function MediaItem({
  mediaFile,
  index,
  isActive,
  getPreloadedMedia,
}) {
  const mediaRef = useRef(null);
  const videoRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);

  // Memoized loading state handler
  const handleLoadingChange = useCallback((loading) => {
    setIsLoading(loading);
  }, []);

  // Reset loading state when media file changes
  useEffect(() => {
    setIsLoading(true);
  }, [mediaFile?.file_path]);

  // Check if media is already preloaded when component becomes active
  useEffect(() => {
    if (!isActive || !mediaFile) return;

    const preloadedMedia = getPreloadedMedia(index);
    if (preloadedMedia) {
      // For videos, check if they're sufficiently buffered
      if (mediaFile.media_type === "video" && preloadedMedia.tagName === "VIDEO") {
        if (preloadedMedia.readyState >= 3) { // HAVE_FUTURE_DATA or higher
          setIsLoading(false);
        } else {
          // Wait for the video to buffer more
          const handleCanPlay = () => {
            setIsLoading(false);
            preloadedMedia.removeEventListener("canplay", handleCanPlay);
          };
          preloadedMedia.addEventListener("canplay", handleCanPlay);
          
          // Fallback timeout
          setTimeout(() => {
            setIsLoading(false);
            preloadedMedia.removeEventListener("canplay", handleCanPlay);
          }, 1000);
        }
      } else {
        setIsLoading(false);
      }
    }
  }, [isActive, index, getPreloadedMedia, mediaFile]);

  // Handle video play/pause based on visibility
  useEffect(() => {
    if (!mediaFile || mediaFile.media_type !== "video" || !videoRef.current)
      return;

    const videoElement = videoRef.current;

    if (isActive) {
      videoElement.play().catch((err) => {
        console.error("Failed to play video:", err);
      });
    } else {
      videoElement.pause();
    }
  }, [isActive, mediaFile]);

  // Don't render anything if no media file
  if (!mediaFile) {
    return null;
  }
  if (mediaFile.media_type === "image") {
    const preloadedImg = getPreloadedMedia(index);
    const imgSrc = preloadedImg
      ? preloadedImg.src
      : `/media?path=${encodeURIComponent(mediaFile.file_path)}`;

    return (
      <div
        ref={mediaRef}
        className="media-item relative h-full w-full flex justify-center items-center"
      >
        {isLoading && (
          <div className="absolute inset-0 bg-black flex items-center justify-center z-10">
            <div className="w-12 h-12 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
          </div>
        )}
        <img
          src={imgSrc}
          alt="Media content"
          className={`max-h-full max-w-full object-cover transition-opacity duration-300 ${isLoading ? "opacity-0" : "opacity-100"}`}
          onLoad={() => setIsLoading(false)}
          onError={(e) => {
            console.error("Failed to load image:", mediaFile.file_path);
            setIsLoading(false);
            e.target.style.display = "none";
          }}
        />
      </div>
    );
  }

  if (mediaFile.media_type === "video") {
    const preloadedVideo = getPreloadedMedia(index);
    const videoSrc = preloadedVideo
      ? preloadedVideo.src
      : `/media?path=${encodeURIComponent(mediaFile.file_path)}`;

    return (
      <div
        ref={mediaRef}
        className="media-item relative h-full w-full flex justify-center items-center"
      >
        <VideoPlayer
          src={videoSrc}
          mediaFile={mediaFile}
          isActive={isActive}
          onLoadingChange={handleLoadingChange}
          isLoading={isLoading}
          videoRef={videoRef}
        />
      </div>
    );
  }

  // Fallback for unknown media types
  return (
    <div
      ref={mediaRef}
      className="media-item relative h-full w-full flex justify-center items-center"
    >
      <div className="text-gray-500 text-center">
        <p>Unsupported media type</p>
        <p className="text-sm">{mediaFile.file_path}</p>
        <p className="text-sm">{mediaFile.media_type}</p>
      </div>
    </div>
  );
});

const VideoPlayer = memo(function VideoPlayer({
  src,
  mediaFile,
  isActive,
  onLoadingChange,
  isLoading,
  videoRef,
}) {
  const [isPaused, setIsPaused] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const { isMuted, hasUserInteracted, toggleMute, setMuted } = useVideoSettings();
  const [autoplayFailed, setAutoplayFailed] = useState(false);

  // Memoized event handlers
  const handlePlay = useCallback(() => {
    setIsPaused(false);
    setShowOverlay(false);
  }, []);

  const handlePause = useCallback(() => {
    setIsPaused(true);
    setShowOverlay(true);
  }, []);

  const handleLoadedData = useCallback(() => {
    onLoadingChange(false);
  }, [onLoadingChange]);

  const handleCanPlayThrough = useCallback(() => {
    // Video is ready to play without interruption
    onLoadingChange(false);
  }, [onLoadingChange]);

  const handleLoadStart = useCallback(() => {
    onLoadingChange(true);
  }, [onLoadingChange]);

  const handleError = useCallback(() => {
    console.error("Failed to load video:", mediaFile.file_path);
    onLoadingChange(false);
  }, [mediaFile.file_path, onLoadingChange]);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch((err) => {
        console.error("Failed to play video:", err);
      });
    } else {
      video.pause();
    }
  }, [videoRef]);

  // Handle mute toggle with immediate video element update
  const handleToggleMute = useCallback(() => {
    const video = videoRef.current;
    toggleMute(); // Update the state
    
    // Immediately update the video element
    if (video) {
      video.muted = !isMuted; // Use the opposite of current state since toggleMute will flip it
    }
  }, [toggleMute, isMuted, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Check if video is already loaded when component mounts
    const checkIfLoaded = () => {
      if (video.readyState >= 3) {
        // HAVE_FUTURE_DATA or higher - can play without stalling
        onLoadingChange(false);
      } else if (video.readyState >= 2) {
        // HAVE_CURRENT_DATA - has data but might stall
        // Give it a moment to buffer more, then allow playback
        setTimeout(() => {
          onLoadingChange(false);
        }, 200);
      }
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("canplaythrough", handleCanPlayThrough);
    video.addEventListener("loadstart", handleLoadStart);
    video.addEventListener("error", handleError);

    // Check initial state
    checkIfLoaded();

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("canplaythrough", handleCanPlayThrough);
      video.removeEventListener("loadstart", handleLoadStart);
      video.removeEventListener("error", handleError);
    };
  }, [
    handlePlay,
    handlePause,
    handleLoadedData,
    handleCanPlayThrough,
    handleLoadStart,
    handleError,
    onLoadingChange,
    videoRef,
  ]);

  // Auto play/pause based on visibility and handle autoplay policy
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      // If user has interacted and chosen to unmute, try unmuted playback
      if (hasUserInteracted && !isMuted) {
        video.muted = false;
        video.play().then(() => {
          // Success! Video is playing with sound
          setAutoplayFailed(false);
        }).catch((err) => {
          // Autoplay with sound failed, fall back to muted
          console.log("Autoplay with sound failed, falling back to muted:", err.message);
          video.muted = true;
          setAutoplayFailed(true);
          video.play().catch((mutedErr) => {
            console.error("Failed to play video even when muted:", mutedErr);
          });
        });
      } else {
        // Default behavior: start muted (safer for autoplay)
        video.muted = true;
        video.play().catch((err) => {
          console.error("Failed to play muted video:", err);
        });
      }
    } else {
      video.pause();
    }
  }, [isActive, videoRef, isMuted, hasUserInteracted]);

  // Sync mute state when user toggles it during playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isActive) return;
    
    video.muted = isMuted;
    setAutoplayFailed(false); // Reset autoplay failed state when user changes preference
  }, [isMuted, isActive]);

  return (
    <>
      {isLoading && (
        <div className="absolute inset-0 bg-black flex items-center justify-center z-10">
          <div className="w-12 h-12 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
        </div>
      )}
      <video
        ref={videoRef}
        src={src}
        controls={false}
        autoPlay={false} // We handle autoplay manually for better control
        loop
        muted={isMuted}
        playsInline
        preload="auto"
        className={`max-h-full max-w-full object-cover cursor-pointer ${isPaused ? "filter brightness-50" : ""} ${isLoading ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
        onClick={togglePlayPause}
        onError={() => console.error("Video load error:", mediaFile.file_path)}
      />

      {showOverlay && !isLoading && (
        <div
          className="video-overlay absolute top-0 left-0 w-full h-full bg-black bg-opacity-30 flex justify-center items-center z-10 cursor-pointer"
          onClick={togglePlayPause}
        >
          <div className="pause-icon text-6xl text-white text-opacity-80">
            &#9616;&#9616;
          </div>
        </div>
      )}

      {/* Audio controls - small button in top-left */}
      {!isLoading && (
        <div className="absolute top-4 left-4 z-20">
          <VideoControls
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            showHint={isMuted && !hasUserInteracted}
          />
        </div>
      )}
    </>
  );
});

export default MediaItem;
