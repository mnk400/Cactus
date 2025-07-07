import React, { useState, useEffect, useRef } from "react";
import { isImage, isVideo } from "../utils/helpers";

function MediaItem({
  mediaFile,
  index,
  direction,
  isTransitioning,
  setIsTransitioning,
  getPreloadedMedia,
}) {
  const mediaRef = useRef(null);

  useEffect(() => {
    if (!mediaFile || !mediaRef.current) return;

    const mediaItem = mediaRef.current;
    setIsTransitioning(true);

    // Set initial state exactly like original
    mediaItem.style.opacity = "0";
    if (direction > 0) {
      mediaItem.style.transform = "translateY(40%)";
    } else if (direction < 0) {
      mediaItem.style.transform = "translateY(-40%)";
    } else {
      mediaItem.style.transform = "translateY(20px)";
    }

    // Start animation exactly like original
    const startAnimation = () => {
      // Force reflow
      mediaItem.offsetHeight;

      requestAnimationFrame(() => {
        mediaItem.style.transition =
          "opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
        mediaItem.style.opacity = "1";
        mediaItem.style.transform = "translateY(0)";

        setTimeout(() => {
          setIsTransitioning(false);
          mediaItem.style.transition = "";
        }, 300);
      });
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(startAnimation, 10);
    return () => clearTimeout(timer);
  }, [index, direction, setIsTransitioning, mediaFile]);

  // Reset wrapper transform after navigation (like original)
  useEffect(() => {
    const timer = setTimeout(() => {
      const mediaWrapper = document.querySelector(".media-wrapper");
      if (mediaWrapper) {
        mediaWrapper.style.transform = "";
        mediaWrapper.style.opacity = "";
        mediaWrapper.style.transition = "";
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [index]);

  // Don't render anything if no media file
  if (!mediaFile) {
    return null;
  }

  if (isImage(mediaFile)) {
    const preloadedImg = getPreloadedMedia(index);
    const imgSrc = preloadedImg
      ? preloadedImg.src
      : `/media?path=${encodeURIComponent(mediaFile)}`;

    return (
      <div
        ref={mediaRef}
        className="media-item relative h-full w-full flex justify-center items-center absolute top-0 left-0"
      >
        <img
          src={imgSrc}
          alt="Media content"
          className="max-h-full max-w-full object-cover"
          onError={(e) => {
            console.error("Failed to load image:", mediaFile);
            e.target.style.display = "none";
          }}
        />
      </div>
    );
  }

  if (isVideo(mediaFile)) {
    const preloadedVideo = getPreloadedMedia(index);
    const videoSrc = preloadedVideo
      ? preloadedVideo.src
      : `/media?path=${encodeURIComponent(mediaFile)}`;

    return (
      <div
        ref={mediaRef}
        className="media-item relative h-full w-full flex justify-center items-center absolute top-0 left-0"
      >
        <VideoPlayer src={videoSrc} mediaFile={mediaFile} />
      </div>
    );
  }

  // Fallback for unknown media types
  return (
    <div
      ref={mediaRef}
      className="media-item relative h-full w-full flex justify-center items-center absolute top-0 left-0"
    >
      <div className="text-gray-500 text-center">
        <p>Unsupported media type</p>
        <p className="text-sm">{mediaFile}</p>
      </div>
    </div>
  );
}

const VideoPlayer = React.forwardRef(({ src, mediaFile }, ref) => {
  const [isPaused, setIsPaused] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsPaused(false);
      setShowOverlay(false);
    };

    const handlePause = () => {
      setIsPaused(true);
      setShowOverlay(true);
    };

    const handleError = () => {
      console.error("Failed to load video:", mediaFile);
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("error", handleError);
    };
  }, [mediaFile]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch((err) => {
        console.error("Failed to play video:", err);
      });
    } else {
      video.pause();
    }
  };

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        controls={false}
        autoPlay
        loop
        muted
        playsInline
        className={`max-h-full max-w-full object-cover cursor-pointer ${isPaused ? "filter brightness-50" : ""}`}
        onClick={togglePlayPause}
        onError={() => console.error("Video load error:", mediaFile)}
      />

      {showOverlay && (
        <div
          className="video-overlay absolute top-0 left-0 w-full h-full bg-black bg-opacity-30 flex justify-center items-center z-10 cursor-pointer"
          onClick={togglePlayPause}
        >
          <div className="pause-icon text-6xl text-white text-opacity-80">
            &#9616;&#9616;
          </div>
        </div>
      )}
    </>
  );
});

VideoPlayer.displayName = "VideoPlayer";

export default MediaItem;
