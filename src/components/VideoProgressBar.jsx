import React, { useState, useEffect, useRef } from 'react'
import { isVideo } from '../utils/helpers'

function VideoProgressBar({ isBottomBarVisible, currentMediaFile }) {
  const [progress, setProgress] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const progressBarRef = useRef(null)
  const videoRef = useRef(null)

  useEffect(() => {
    // Show progress bar only for videos
    if (isVideo(currentMediaFile)) {
      setIsVisible(true)
      
      // Find the current video element
      const videoElement = document.querySelector('.media-item video')
      videoRef.current = videoElement
      
      if (videoElement) {
        const handleTimeUpdate = () => {
          const progress = (videoElement.currentTime / videoElement.duration) * 100
          setProgress(isNaN(progress) ? 0 : progress)
        }

        videoElement.addEventListener('timeupdate', handleTimeUpdate)
        
        return () => {
          videoElement.removeEventListener('timeupdate', handleTimeUpdate)
        }
      }
    } else {
      setIsVisible(false)
      setProgress(0)
    }
  }, [currentMediaFile])

  const handleProgressClick = (e) => {
    if (!videoRef.current) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = (e.clientX - rect.left) / rect.width
    videoRef.current.currentTime = pos * videoRef.current.duration
  }

  if (!isVisible) return null

  const bottomClass = isBottomBarVisible ? 'bottom-[150px]' : 'bottom-[90px]'

  return (
    <div 
      ref={progressBarRef}
      className={`video-progress-container absolute left-1/2 transform -translate-x-1/2 w-11/12 max-w-[570px] h-5 bg-black bg-opacity-80 backdrop-blur-md rounded-lg overflow-hidden z-[19] cursor-pointer ${bottomClass}`}
      onClick={handleProgressClick}
    >
      <div 
        className="video-progress-bar h-full bg-white rounded-lg transition-all duration-100 ease-linear"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

export default VideoProgressBar
