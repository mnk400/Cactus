import React, { useState, useEffect, useRef } from "react";

function MediaItem({
  mediaFile,
  index,
  isActive,
  getPreloadedMedia,
}) {
  const mediaRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);

  // Reset loading state when media file changes
  useEffect(() => {
    setIsLoading(true);
  }, [mediaFile?.file_path]);

  // Handle video play/pause based on visibility
  useEffect(() => {
    if (!mediaFile || mediaFile.media_type !== "video") return;

    const videoElement = mediaRef.current?.querySelector('video');
    if (!videoElement) return;

    if (isActive) {
      videoElement.play().catch(err => {
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
          className={`max-h-full max-w-full object-cover transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
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
          onLoadingChange={setIsLoading}
          isLoading={isLoading}
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
}

const VideoPlayer = ({ src, mediaFile, isActive, onLoadingChange, isLoading }) => {
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

    const handleLoadedData = () => {
      onLoadingChange(false);
    };

    const handleLoadStart = () => {
      onLoadingChange(true);
    };

    const handleError = () => {
      console.error("Failed to load video:", mediaFile.file_path);
      onLoadingChange(false);
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("loadstart", handleLoadStart);
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("loadstart", handleLoadStart);
      video.removeEventListener("error", handleError);
    };
  }, [mediaFile, onLoadingChange]);

  // Auto play/pause based on visibility
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.play().catch(err => {
        console.error("Failed to play video:", err);
      });
    } else {
      video.pause();
    }
  }, [isActive]);

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
      {isLoading && (
        <div className="absolute inset-0 bg-black flex items-center justify-center z-10">
          <div className="w-12 h-12 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
        </div>
      )}
      <video
        ref={videoRef}
        src={src}
        controls={false}
        autoPlay={isActive}
        loop
        muted
        playsInline
        className={`max-h-full max-w-full object-cover cursor-pointer ${isPaused ? "filter brightness-50" : ""} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
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
    </>
  );
};

export default MediaItem;
