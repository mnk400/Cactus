import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  memo,
} from "react";
import { useAudio, useVideoElement } from "../context/MediaContext";

const MediaItem = memo(function MediaItem({ mediaFile, isActive, preload }) {
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

  // Publish the active video element to context so the dock's progress and
  // the video controls (rendered in App) can reach it.
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

  // An image the browser already holds is complete the moment it is in the
  // DOM, and onLoad may never fire for it. Checking before paint shows it at
  // once, so a gallery-to-feed zoom lands on the sharp photo, not a fade.
  useLayoutEffect(() => {
    const img = imgRef.current;
    // Reading the DOM before paint is what a layout effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (img?.complete && img.naturalWidth > 0) setIsLoading(false);
  }, [mediaFile?.file_path]);

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
  };
  const wrapperClass = "media-item";
  const wrapperStyle = aspectRatio ? { "--ar": aspectRatio } : undefined;

  const src = `/media?path=${encodeURIComponent(mediaFile.file_path)}`;

  if (mediaFile.media_type === "image") {
    return (
      <div className={wrapperClass} data-ar={aspectRatio} style={wrapperStyle}>
        <div className="media-canvas" style={canvasStyle}>
          <img
            ref={imgRef}
            src={src}
            alt="Media content"
            className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${isLoading ? "opacity-0" : "opacity-100"}`}
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
    return (
      <div className={wrapperClass} data-ar={aspectRatio} style={wrapperStyle}>
        <div className="media-canvas" style={canvasStyle}>
          <VideoPlayer
            src={src}
            preload={preload}
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
    <div className={wrapperClass}>
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
  preload,
  mediaFile,
  isActive,
  onLoadingChange,
  isLoading,
  videoRef,
}) {
  const [showOverlay, setShowOverlay] = useState(false);
  const { isMuted, setMuted } = useAudio();
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
      // Sound on: try it. A browser that won't autoplay with sound (no tap
      // on this page yet) refuses, and we fall back to muted.
      if (!isMuted) {
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
  }, [isActive, videoRef, isMuted, setMuted]);

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
        preload={preload}
        className={`h-full w-full cursor-pointer ${isLoading ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
        onClick={togglePlayPause}
        onError={() => console.error("Video load error:", mediaFile.file_path)}
      />

      {/* Paused: a play mark, and the frame stays at full brightness. */}
      {showOverlay && isActive && !isLoading && (
        <div className="play-mark pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
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
