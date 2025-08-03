import React from "react";

function FullscreenButton({ currentMediaFile }) {
  const handleFullscreen = () => {
    // Find the currently active video element by checking viewport position
    const containers = document.querySelectorAll('.media-item-container');
    let activeVideo = null;
    
    for (const container of containers) {
      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      // Check if container is in the center of viewport (currently active)
      if (rect.top <= viewportHeight / 2 && rect.bottom >= viewportHeight / 2) {
        const video = container.querySelector('video');
        if (video) {
          activeVideo = video;
          break;
        }
      }
    }
    
    if (!activeVideo) return;

    if (activeVideo.requestFullscreen) {
      activeVideo.requestFullscreen();
    } else if (activeVideo.webkitRequestFullscreen) {
      activeVideo.webkitRequestFullscreen();
    } else if (activeVideo.msRequestFullscreen) {
      activeVideo.msRequestFullscreen();
    } else if (activeVideo.webkitEnterFullscreen) {
      activeVideo.webkitEnterFullscreen();
    }
  };

  return (
    <button
      onClick={handleFullscreen}
      className="nav-button bg-black-shades-700 text-gray-200 border-none p-2 rounded-xl cursor-pointer text-lg transition-all duration-200 ease-in-out hover:bg-white hover:bg-opacity-20 active:scale-95 min-w-10 min-h-10"
    >
      ⛶
    </button>
  );
}

export default FullscreenButton;
