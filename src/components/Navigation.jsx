import { useState, useEffect, useCallback, memo } from "react";
import VideoProgressBar from "./VideoProgressBar";
import useDisplayName from "../hooks/useDisplayName";
import { useCurrentMedia, useMediaData } from "../context/MediaContext";

const Navigation = memo(function Navigation({
  onToggleSettings,
  onToggleTagInput,
  directoryName,
  isFavorited,
  onToggleFavorite,
}) {
  const { currentMediaFile } = useCurrentMedia();
  const { toggleGallery, settings, setFilters } = useMediaData();

  const { galleryView: isGalleryView, pathFilter: activeFilter } = settings;
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
      // Use setTimeout to avoid synchronous setState in effect
      timeouts.push(setTimeout(findActiveVideo, 0));
      timeouts.push(setTimeout(findActiveVideo, 50));
      timeouts.push(setTimeout(findActiveVideo, 200));
      return () => {
        timeouts.forEach(clearTimeout);
      };
    } else {
      queueMicrotask(() => setVideoElement(null));
    }
  }, [currentMediaFile, findActiveVideo]);

  // Use provider-based display name computation
  const { displayName } = useDisplayName(currentMediaFile, directoryName);
  const isVideoPlaying = currentMediaFile?.media_type === "video";

  return (
    <div
      className={`navigation fixed bottom-0 left-0 flex flex-col justify-end z-20 bg-black-shades-1000 transition-all duration-300 pt-3`}
      style={{
        right: "var(--settings-drawer-width, 0px)",
        width: "calc(100% - var(--settings-drawer-width, 0px))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))",
      }}
    >
      <div
        className={`w-full overflow-hidden transition-all duration-300 px-4 ${isVideoPlaying && !isGalleryView ? "max-h-8 mb-2" : "max-h-0"}`}
      >
        <VideoProgressBar videoElement={videoElement} />
      </div>
      <div className="w-full flex items-center justify-between px-4 gap-2">
        <div className="flex items-center gap-2">
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
            onClick={toggleGallery}
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

        </div>

        {activeFilter ? (
          <div
            className="inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-medium text-white shadow-sm bg-red-500 cursor-pointer hover:bg-red-600 transition-all duration-200 active:scale-95"
            title={`Active filter: ${activeFilter}`}
          >
            <span className="max-w-[200px] truncate">{activeFilter}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFilters({ pathFilter: "" });
              }}
              className="ml-2 text-white hover:text-gray-200 focus:outline-none transition-colors duration-150 hover:bg-white hover:bg-opacity-20 rounded-lg w-5 h-5 flex items-center justify-center text-lg leading-none"
              aria-label="Clear filter"
            >
              ×
            </button>
          </div>
        ) : (
          <div
            className="media-source-info text-gray-200 text-base whitespace-nowrap overflow-hidden text-ellipsis cursor-pointer hover:text-blue-400 transition-colors duration-200 active:scale-95"
            title={`Click to filter by: ${displayName}`}
            onClick={() => setFilters({ pathFilter: displayName })}
          >
            {displayName}
          </div>
        )}
      </div>
    </div>
  );
});

export default Navigation;
