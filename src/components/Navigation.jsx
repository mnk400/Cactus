import React, { useState, useEffect, useCallback, memo } from "react";
import FullscreenButton from "./FullscreenButton";
import VideoProgressBar from "./VideoProgressBar";

const Navigation = memo(function Navigation({
  onToggleSettings,
  onToggleTagInput,
  directoryName,
  currentMediaFile,
  isFavorited,
  onToggleFavorite,
  onToggleGalleryView,
  isGalleryView,
}) {
  const [videoElement, setVideoElement] = useState(null);

  // Video element finder
  const findActiveVideo = useCallback(() => {
    if (currentMediaFile?.media_type !== "video") {
      setVideoElement(null);
      return;
    }

    // Method 1: Find by checking which container is in the center of viewport
    const containers = document.querySelectorAll(".media-item-container");
    const viewportHeight = window.innerHeight;
    const centerY = viewportHeight / 2;

    for (const container of containers) {
      const rect = container.getBoundingClientRect();
      // Check if container center is close to viewport center (within 100px tolerance)
      const containerCenterY = rect.top + rect.height / 2;
      if (Math.abs(containerCenterY - centerY) < 100) {
        const video = container.querySelector("video");
        if (video) {
          setVideoElement(video);
          return;
        }
      }
    }

    // Method 2: Find the video that's currently playing
    const allVideos = document.querySelectorAll(".media-item video");
    for (const video of allVideos) {
      if (!video.paused) {
        setVideoElement(video);
        return;
      }
    }

    // Method 3: Find any video in a visible container
    for (const container of containers) {
      const rect = container.getBoundingClientRect();
      if (rect.top < viewportHeight && rect.bottom > 0) {
        const video = container.querySelector("video");
        if (video) {
          setVideoElement(video);
          return;
        }
      }
    }

    setVideoElement(null);
  }, [currentMediaFile]);

  useEffect(() => {
    if (currentMediaFile?.media_type === "video") {
      const timeouts = [];

      findActiveVideo();

      timeouts.push(setTimeout(findActiveVideo, 50));
      timeouts.push(setTimeout(findActiveVideo, 200));

      return () => {
        timeouts.forEach(clearTimeout);
      };
    } else {
      setVideoElement(null);
    }
  }, [currentMediaFile, findActiveVideo]);

  // Also listen for video events to update the element reference
  useEffect(() => {
    if (currentMediaFile?.media_type === "video") {
      const handleVideoPlay = (event) => {
        if (event.target.tagName === "VIDEO") {
          setVideoElement(event.target);
        }
      };

      const handleVideoLoadedData = (event) => {
        if (event.target.tagName === "VIDEO") {
          // Only update if we don't already have a video element
          setVideoElement((prev) => prev || event.target);
        }
      };

      document.addEventListener("play", handleVideoPlay, true);
      document.addEventListener("loadeddata", handleVideoLoadedData, true);

      return () => {
        document.removeEventListener("play", handleVideoPlay, true);
        document.removeEventListener("loadeddata", handleVideoLoadedData, true);
      };
    }
  }, [currentMediaFile]);

  // Compute smart display name based on media source and available data
  const computeDisplayName = () => {
    if (!currentMediaFile) return "";
    
    // For SB (Stash) provider media
    if (currentMediaFile.file_hash?.startsWith('sb_')) {
      // For markers, prioritize scene info and performers
      if (currentMediaFile.sb_type === 'marker') {
        // Try performer names first
        if (currentMediaFile.sb_scene_performers?.length > 0) {
          const performers = currentMediaFile.sb_scene_performers.map(p => p.name).join(', ');
          return performers.length > 30 ? performers.substring(0, 27) + '...' : performers;
        }
        // Fall back to scene title
        if (currentMediaFile.sb_scene_title) {
          return currentMediaFile.sb_scene_title.length > 30 
            ? currentMediaFile.sb_scene_title.substring(0, 27) + '...' 
            : currentMediaFile.sb_scene_title;
        }
        // Fall back to studio name
        if (currentMediaFile.sb_scene_studio?.name) {
          return currentMediaFile.sb_scene_studio.name;
        }
      } else {
        // For regular images/videos, try performers first
        if (currentMediaFile.sb_performers?.length > 0) {
          const performers = currentMediaFile.sb_performers.map(p => p.name).join(', ');
          return performers.length > 30 ? performers.substring(0, 27) + '...' : performers;
        }
        // Fall back to studio name
        if (currentMediaFile.sb_studio?.name) {
          return currentMediaFile.sb_studio.name;
        }
        // Fall back to showing the image ID in a more user-friendly way
        if (currentMediaFile.sb_id) {
          return `Image #${currentMediaFile.sb_id}`;
        }
      }
      // Final fallback for SB: show "Stash Server"
      return "Stash Server";
    }
    
    // For local provider media, extract directory name from path
    if (directoryName) {
      return directoryName.split("/").pop() ||
        directoryName.split("/").slice(-2, -1)[0] ||
        "Root";
    }
    
    // Final fallback: try to extract from file path
    if (currentMediaFile.file_path) {
      const pathParts = currentMediaFile.file_path.split("/");
      return pathParts[pathParts.length - 2] || "Unknown";
    }
    
    return "";
  };

  const displayName = computeDisplayName();
  const isVideoPlaying = currentMediaFile?.media_type === "video";

  return (
    <div
      className={`navigation absolute left-1/2 transform -translate-x-1/2 flex flex-col items-center justify-end gap-2 z-20 p-2 bg-black-shades-1000 rounded-2xl w-11/12 max-w-xl transition-all duration-300 bottom-4 ${isVideoPlaying ? "py-2" : "py-0 pb-2"}`}
    >
      <div
        className={`w-full overflow-hidden transition-all duration-300 ${isVideoPlaying && !isGalleryView ? "max-h-8" : "max-h-0"}`}
      >
        <VideoProgressBar videoElement={videoElement} />
      </div>
      <div className="w-full flex items-center justify-end gap-2">
        <button
          onClick={onToggleFavorite}
          className="nav-button bg-black-shades-700 text-gray-200 border-none p-2 rounded-xl cursor-pointer transition-all duration-200 ease-in-out hover:bg-white hover:bg-opacity-20 active:scale-95 min-w-10 min-h-11 flex items-center justify-center"
          title={isFavorited ? "Remove from favorites" : "Add to favorites"}
        >
          {isFavorited ? (
            <svg
              className="w-4 h-4 text-red-400"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          ) : (
            <svg
              className="w-4 h-4 text-gray-200"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              />
            </svg>
          )}
        </button>

        <button
          onClick={onToggleTagInput}
          className="nav-button bg-black-shades-700 text-gray-200 border-none p-2 rounded-xl cursor-pointer transition-all duration-200 ease-in-out hover:bg-white hover:bg-opacity-20 active:scale-95 min-w-10 min-h-11 flex items-center justify-center"
          title="Add tags (T)"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
        </button>

        <button
          onClick={onToggleGalleryView}
          className="nav-button bg-black-shades-700 text-gray-200 border-none p-2 rounded-xl cursor-pointer transition-all duration-200 ease-in-out hover:bg-white hover:bg-opacity-20 active:scale-95 min-w-10 min-h-11 flex items-center justify-center"
          title="Gallery View"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        <button
          onClick={onToggleSettings}
          className="nav-button bg-black-shades-700 text-gray-200 border-none p-2 rounded-xl cursor-pointer text-lg transition-all duration-200 ease-in-out hover:bg-white hover:bg-opacity-20 active:scale-95 min-w-10 min-h-10"
        >
          ⋯
        </button>

        {currentMediaFile?.media_type === "video" && (
          <FullscreenButton currentMediaFile={currentMediaFile} />
        )}

        <div 
          className="media-source-info text-gray-200 text-base ml-auto px-4 whitespace-nowrap overflow-hidden text-ellipsis"
          title={displayName}
        >
          {displayName}
        </div>
      </div>
    </div>
  );
});

export default Navigation;
