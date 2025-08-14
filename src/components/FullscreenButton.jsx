import React, { useCallback, memo } from "react";

const FullscreenButton = memo(function FullscreenButton({ currentMediaFile }) {
  const handleFullscreen = useCallback(() => {
    // video finding - look for the active container first
    const activeContainer = document.querySelector(
      '.media-item-container[style*="translate"]',
    );
    let activeVideo = null;

    if (activeContainer) {
      activeVideo = activeContainer.querySelector("video");
    }

    // Fallback to viewport position check
    if (!activeVideo) {
      const containers = document.querySelectorAll(".media-item-container");
      for (const container of containers) {
        const rect = container.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        if (
          rect.top <= viewportHeight / 2 &&
          rect.bottom >= viewportHeight / 2
        ) {
          const video = container.querySelector("video");
          if (video) {
            activeVideo = video;
            break;
          }
        }
      }
    }

    if (!activeVideo) return;

    // Use the most compatible fullscreen API
    if (activeVideo.requestFullscreen) {
      activeVideo.requestFullscreen();
    } else if (activeVideo.webkitRequestFullscreen) {
      activeVideo.webkitRequestFullscreen();
    } else if (activeVideo.msRequestFullscreen) {
      activeVideo.msRequestFullscreen();
    } else if (activeVideo.webkitEnterFullscreen) {
      activeVideo.webkitEnterFullscreen();
    }
  }, []);

  return (
    <button
      onClick={handleFullscreen}
      className="nav-button bg-black-shades-700 text-gray-200 border-none p-2 rounded-xl cursor-pointer text-lg transition-all duration-200 ease-in-out hover:bg-white hover:bg-opacity-20 active:scale-95 min-w-10 min-h-10"
    >
      ⛶
    </button>
  );
});

export default FullscreenButton;
