import React, { useState, useEffect } from "react";
import FullscreenButton from "./FullscreenButton";
import VideoProgressBar from "./VideoProgressBar";

function Navigation({
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

  useEffect(() => {
    if (currentMediaFile?.media_type === "video") {
      // Clear previous video element first
      setVideoElement(null);
      
      // Find the currently active video element with retries
      let attempts = 0;
      const maxAttempts = 10;
      
      const findActiveVideo = () => {
        // Look for video elements and find the one that's currently playing or can play
        const videoElements = document.querySelectorAll(".media-item video");
        let activeVideo = null;
        
        for (const video of videoElements) {
          // Check if this video is in the currently visible media item
          const mediaItem = video.closest('.media-item-container');
          if (mediaItem && !video.paused) {
            activeVideo = video;
            break;
          }
        }
        
        // If no playing video found, get the first video (fallback)
        if (!activeVideo && videoElements.length > 0) {
          // Try to find video by checking which container is at the current scroll position
          const containers = document.querySelectorAll('.media-item-container');
          for (const container of containers) {
            const rect = container.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            // Check if container is in the center of viewport
            if (rect.top <= viewportHeight / 2 && rect.bottom >= viewportHeight / 2) {
              const video = container.querySelector('video');
              if (video) {
                activeVideo = video;
                break;
              }
            }
          }
        }
        
        if (activeVideo) {
          setVideoElement(activeVideo);
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(findActiveVideo, 50);
        }
      };
      
      // Start searching immediately, then with a small delay as backup
      findActiveVideo();
      setTimeout(findActiveVideo, 100);
    } else {
      setVideoElement(null);
    }
  }, [currentMediaFile]);

  // Extract just the directory name for the navigation bar display
  const shortDirectoryName = directoryName
    ? directoryName.split("/").pop() ||
      directoryName.split("/").slice(-2, -1)[0] ||
      "Root"
    : "";
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

        {currentMediaFile?.media_type === "video" && <FullscreenButton currentMediaFile={currentMediaFile} />}

        <div className="directory-name text-gray-200 text-base ml-auto px-4 whitespace-nowrap overflow-hidden text-ellipsis">
          {shortDirectoryName}
        </div>
      </div>
    </div>
  );
}

export default Navigation;
