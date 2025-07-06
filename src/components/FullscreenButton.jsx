import React from 'react'

function FullscreenButton() {
  const handleFullscreen = () => {
    const videoElement = document.querySelector('.media-item video')
    if (!videoElement) return

    if (videoElement.requestFullscreen) {
      videoElement.requestFullscreen()
    } else if (videoElement.webkitRequestFullscreen) {
      videoElement.webkitRequestFullscreen()
    } else if (videoElement.msRequestFullscreen) {
      videoElement.msRequestFullscreen()
    } else if (videoElement.webkitEnterFullscreen) {
      videoElement.webkitEnterFullscreen()
    }
  }

  return (
    <button
      onClick={handleFullscreen}
      className="nav-button bg-black bg-opacity-40 text-gray-200 border-none p-2 rounded-xl cursor-pointer text-lg transition-all duration-200 ease-in-out hover:bg-white hover:bg-opacity-20 active:scale-95 min-w-10 min-h-10"
    >
      ⛶
    </button>
  )
}

export default FullscreenButton
