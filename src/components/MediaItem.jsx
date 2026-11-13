import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { useAudio, useVideoElement } from "../context/MediaContext";

const MediaItem = memo(function MediaItem({
  mediaFile,
  index,
  isActive,
  getPreloadedMedia,
}) {
  const mediaRef = useRef(null);
  const videoRef = useRef(null);
  const imgRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [trackedFilePath, setTrackedFilePath] = useState(mediaFile?.file_path);

  // Reset loading state when media file changes (during render, not in effect)
  if (mediaFile?.file_path !== trackedFilePath) {
    setTrackedFilePath(mediaFile?.file_path);
    setIsLoading(true);
  }

  // Memoized loading state handler
  const handleLoadingChange = useCallback((loading) => {
    setIsLoading(loading);
  }, []);

  // Publish the active video element to context so the hairline progress bar
  // and top-right controls pill (rendered in App) can reach it.
  const { setVideoElement } = useVideoElement();
  const isVideoActive =
    isActive && !isLoading && mediaFile?.media_type === "video";
  useEffect(() => {
    if (!isVideoActive) return;
    const el = videoRef.current;
    setVideoElement(el);
    return () => {
      setVideoElement((curr) => (curr === el ? null : curr));
    };
  }, [isVideoActive, setVideoElement]);

  // Check if media is already preloaded when component becomes active
  useEffect(() => {
    if (!isActive || !mediaFile) return;

    const preloadedMedia = getPreloadedMedia(index);
    if (preloadedMedia) {
      // For videos, check if they're sufficiently buffered
      if (
        mediaFile.media_type === "video" &&
        preloadedMedia.tagName === "VIDEO"
      ) {
        if (preloadedMedia.readyState >= 3) {
          // HAVE_FUTURE_DATA or higher
          queueMicrotask(() => setIsLoading(false));
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
        queueMicrotask(() => setIsLoading(false));
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

  // Check if image is already loaded (e.g., from browser cache)
  // This handles cases where onLoad doesn't fire for cached images
  useEffect(() => {
    if (mediaFile?.media_type !== "image") return;

    // Use setTimeout to ensure the check runs after React flushes the DOM
    const timer = setTimeout(() => {
      const img = imgRef.current;
      if (img?.complete && img.naturalWidth > 0) {
        setIsLoading(false);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [mediaFile?.file_path, mediaFile?.media_type]);

  // Don't render anything if no media file
  if (!mediaFile) {
    return null;
  }
  const thumbnailUrl = `/thumbnails?hash=${mediaFile.file_hash}`;
  const aspectRatio =
    mediaFile.width && mediaFile.height
      ? mediaFile.width / mediaFile.height
      : undefined;
  // Whether the item fills the stage or shows whole is a CSS class the feed
  // toggles on this wrapper from data-ar (see index.css and applyFit).
  const canvasStyle = {
    backgroundImage: `url(${thumbnailUrl})`,
    viewTransitionName: isActive ? "media-active" : undefined,
  };
  const wrapperClass = "media-item absolute inset-0";
  const wrapperStyle = aspectRatio ? { "--ar": aspectRatio } : undefined;

  if (mediaFile.media_type === "image") {
    const preloadedImg = getPreloadedMedia(index);
    const imgSrc = preloadedImg
      ? preloadedImg.src
      : `/media?path=${encodeURIComponent(mediaFile.file_path)}`;
    // Already decoded by the preloader: show it at once, so a gallery-to-feed
    // morph lands on the sharp photo rather than its thumbnail.
    const hidden = isLoading && !preloadedImg?.complete;

    return (
      <div
        ref={mediaRef}
        className={wrapperClass}
        data-ar={aspectRatio}
        style={wrapperStyle}
      >
        <div className="media-canvas" style={canvasStyle}>
          <img
            ref={imgRef}
            src={imgSrc}
            alt="Media content"
            className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${hidden ? "opacity-0" : "opacity-100"}`}
            onLoad={() => setIsLoading(false)}
            onError={(e) => {
              console.error("Failed to load image:", mediaFile.file_path);
              setIsLoading(false);
              e.target.style.display = "none";
            }}
          />
        </div>
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
        className={wrapperClass}
        data-ar={aspectRatio}
        style={wrapperStyle}
      >
        <div className="media-canvas" style={canvasStyle}>
          <VideoPlayer
            src={videoSrc}
            mediaFile={mediaFile}
            isActive={isActive}
            onLoadingChange={handleLoadingChange}
            isLoading={isLoading}
            videoRef={videoRef}
          />
        </div>
      </div>
    );
  }

  // Fallback for unknown media types
  return (
    <div ref={mediaRef} className={wrapperClass}>
      <div className="flex h-full items-center justify-center p-6 text-center text-[13px] text-white/45">
        <div>
          <p className="m-0">can&rsquo;t show this file</p>
          <p className="m-0 mt-1 break-all text-xs text-white/30">
            {mediaFile.file_path}
          </p>
        </div>
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
  const [showOverlay, setShowOverlay] = useState(false);
  const { isMuted, hasUserInteracted, setMuted } = useAudio();
  const [autoplayFailed, setAutoplayFailed] = useState(false);

  // Memoized event handlers
  const handlePlay = useCallback(() => {
    setShowOverlay(false);
  }, []);

  const handlePause = useCallback(() => {
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
        video
          .play()
          .then(() => {
            // Success! Video is playing with sound
            setAutoplayFailed(false);
          })
          .catch((err) => {
            // Autoplay with sound failed, fall back to muted
            console.log(
              "Autoplay with sound failed, falling back to muted:",
              err.message,
            );
            video.muted = true;
            setAutoplayFailed(true);
            setMuted(true);
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
  }, [isActive, videoRef, isMuted, hasUserInteracted, setMuted]);

  // Sync mute state when user toggles it or when component starts
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // The video element should be muted if the global setting is muted,
    // OR if we're active and autoplay failed (meaning the browser forced it to be muted).
    video.muted = isMuted || (isActive && autoplayFailed);
  }, [isMuted, isActive, autoplayFailed, videoRef]);

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        controls={false}
        autoPlay={false} // We handle autoplay manually for better control
        loop
        muted={isMuted}
        playsInline
        preload="auto"
        className={`h-full w-full cursor-pointer ${isLoading ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
        onClick={togglePlayPause}
        onError={() => console.error("Video load error:", mediaFile.file_path)}
      />

      {/* Paused: a play mark, and the frame stays at full brightness. */}
      {showOverlay && isActive && !isLoading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="surface rounded-full p-4 text-white">
            <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
    </>
  );
});

export default MediaItem;
