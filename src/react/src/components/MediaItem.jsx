import React, { useState, useEffect, useRef } from 'react'
import { isImage, isVideo } from '../utils/helpers'

function MediaItem({ 
  mediaFile, 
  index, 
  direction, 
  isTransitioning, 
  setIsTransitioning,
  getPreloadedMedia 
}) {
  const [opacity, setOpacity] = useState(0)
  const [transform, setTransform] = useState('translateY(20px)')
  const mediaRef = useRef(null)

  useEffect(() => {
    setIsTransitioning(true)
    
    // Set initial position based on direction
    if (direction > 0) {
      setTransform('translateY(40%)')
    } else if (direction < 0) {
      setTransform('translateY(-40%)')
    } else {
      setTransform('translateY(20px)')
    }
    setOpacity(0)

    // Start animation after a brief delay
    const timer = setTimeout(() => {
      setOpacity(1)
      setTransform('translateY(0)')
      
      // End transition after animation completes
      setTimeout(() => {
        setIsTransitioning(false)
      }, 300)
    }, 50)

    return () => clearTimeout(timer)
  }, [index, direction, setIsTransitioning]) // Changed from mediaFile to index

  const mediaStyle = {
    opacity,
    transform,
    transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  }

  if (isImage(mediaFile)) {
    const preloadedImg = getPreloadedMedia(index)
    const imgSrc = preloadedImg ? preloadedImg.src : `/media?path=${encodeURIComponent(mediaFile)}`

    return (
      <div 
        className="media-item relative h-full w-full flex justify-center items-center absolute top-0 left-0"
        style={mediaStyle}
      >
        <img
          ref={mediaRef}
          src={imgSrc}
          alt="Media content"
          className="max-h-full max-w-full object-cover"
        />
      </div>
    )
  }

  if (isVideo(mediaFile)) {
    const preloadedVideo = getPreloadedMedia(index)
    const videoSrc = preloadedVideo ? preloadedVideo.src : `/media?path=${encodeURIComponent(mediaFile)}`

    return (
      <div 
        className="media-item relative h-full w-full flex justify-center items-center absolute top-0 left-0"
        style={mediaStyle}
      >
        <VideoPlayer
          ref={mediaRef}
          src={videoSrc}
          mediaFile={mediaFile}
        />
      </div>
    )
  }

  return null
}

const VideoPlayer = React.forwardRef(({ src, mediaFile }, ref) => {
  const [isPaused, setIsPaused] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handlePlay = () => {
      setIsPaused(false)
      setShowOverlay(false)
    }

    const handlePause = () => {
      setIsPaused(true)
      setShowOverlay(true)
    }

    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)

    return () => {
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
    }
  }, [])

  const togglePlayPause = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      video.play()
    } else {
      video.pause()
    }
  }

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
        className={`max-h-full max-w-full object-cover cursor-pointer ${isPaused ? 'filter brightness-50' : ''}`}
        onClick={togglePlayPause}
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
  )
})

VideoPlayer.displayName = 'VideoPlayer'

export default MediaItem
