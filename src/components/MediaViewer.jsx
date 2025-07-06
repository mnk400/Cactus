import React, { useState, useEffect } from 'react'
import MediaItem from './MediaItem'
import VideoProgressBar from './VideoProgressBar'
import { useTouchGestures } from '../hooks/useTouchGestures'
import { useMediaPreloader } from '../hooks/useMediaPreloader'

function MediaViewer({ mediaFiles, currentIndex, onNavigate }) {
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [direction, setDirection] = useState(0)
  const [prevIndex, setPrevIndex] = useState(currentIndex)
  
  const { getPreloadedMedia } = useMediaPreloader(mediaFiles, currentIndex)
  
  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  } = useTouchGestures((dir) => {
    if (!isTransitioning) {
      setDirection(dir)
      onNavigate(dir)
    }
  })

  // Track direction when index changes
  useEffect(() => {
    if (currentIndex !== prevIndex) {
      const diff = currentIndex - prevIndex
      // Handle wrap-around cases
      if (Math.abs(diff) > 1) {
        // Wrapped around
        if (diff > 0) {
          setDirection(-1) // Wrapped from end to beginning (previous)
        } else {
          setDirection(1) // Wrapped from beginning to end (next)
        }
      } else {
        setDirection(diff > 0 ? 1 : -1)
      }
      setPrevIndex(currentIndex)
    }
  }, [currentIndex, prevIndex])

  const currentMediaFile = mediaFiles[currentIndex]

  return (
    <div 
      className="media-wrapper h-full w-full relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {currentMediaFile && (
        <>
          <MediaItem
            mediaFile={currentMediaFile}
            index={currentIndex}
            direction={direction}
            isTransitioning={isTransitioning}
            setIsTransitioning={setIsTransitioning}
            getPreloadedMedia={getPreloadedMedia}
          />
          <VideoProgressBar 
            currentMediaFile={currentMediaFile}
          />
        </>
      )}
    </div>
  )
}

export default MediaViewer
