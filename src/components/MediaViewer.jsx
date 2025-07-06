import React, { useState, useEffect } from 'react'
import MediaItem from './MediaItem'
import VideoProgressBar from './VideoProgressBar'
import TagList from './TagList'
import TagInput from './TagInput'
import { useTouchGestures } from '../hooks/useTouchGestures'
import { useMediaPreloader } from '../hooks/useMediaPreloader'
import useTags from '../hooks/useTags'

function MediaViewer({ mediaFiles, currentIndex, onNavigate }) {
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [direction, setDirection] = useState(0)
  const [prevIndex, setPrevIndex] = useState(currentIndex)
  const [showTagInput, setShowTagInput] = useState(false)
  const [mediaTags, setMediaTags] = useState([])
  
  const { getPreloadedMedia } = useMediaPreloader(mediaFiles, currentIndex)
  const { tags, getMediaTags, addTagsToMedia, removeTagFromMedia } = useTags()
  
  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  } = useTouchGestures((dir) => {
    if (!isTransitioning && !showTagInput) {
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

  // Load tags for current media file
  useEffect(() => {
    const loadMediaTags = async () => {
      if (mediaFiles[currentIndex]) {
        try {
          const tags = await getMediaTags(mediaFiles[currentIndex]);
          setMediaTags(tags);
        } catch (error) {
          console.error('Failed to load media tags:', error);
          setMediaTags([]);
        }
      }
    };

    loadMediaTags();
  }, [currentIndex, mediaFiles, getMediaTags]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setShowTagInput(true);
      }
      if (e.key === 'Escape') {
        setShowTagInput(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const handleAddTags = async (tagNames) => {
    if (mediaFiles[currentIndex]) {
      try {
        await addTagsToMedia(mediaFiles[currentIndex], tagNames);
        // Reload tags for current media
        const updatedTags = await getMediaTags(mediaFiles[currentIndex]);
        setMediaTags(updatedTags);
      } catch (error) {
        console.error('Failed to add tags:', error);
      }
    }
  };

  const handleRemoveTag = async (tagId) => {
    if (mediaFiles[currentIndex]) {
      try {
        // We need the file hash for removal, let's get it from the API
        const response = await fetch(`/api/media-path/tags?path=${encodeURIComponent(mediaFiles[currentIndex])}`);
        const data = await response.json();
        
        if (data.fileHash) {
          await removeTagFromMedia(data.fileHash, tagId);
          // Reload tags for current media
          const updatedTags = await getMediaTags(mediaFiles[currentIndex]);
          setMediaTags(updatedTags);
        }
      } catch (error) {
        console.error('Failed to remove tag:', error);
      }
    }
  };

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
          
          {/* Tag Display and Controls */}
          <div className="absolute top-4 left-4 right-4 z-10">
            <div className="flex justify-between items-start">
              {/* Current Tags */}
              <div className="flex-1 mr-4">
                {mediaTags.length > 0 && (
                  <TagList 
                    tags={mediaTags} 
                    showRemove={true}
                    onRemoveTag={handleRemoveTag}
                    className="mb-2"
                  />
                )}
              </div>
              
              {/* Tag Button */}
              <button
                onClick={() => setShowTagInput(true)}
                className="bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 transition-all"
                title="Add tags (T)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </button>
            </div>
            
            {/* Tag Input */}
            {showTagInput && (
              <div className="mt-4 bg-black bg-opacity-75 p-4 rounded-lg">
                <TagInput
                  availableTags={tags}
                  onAddTags={handleAddTags}
                  onClose={() => setShowTagInput(false)}
                  placeholder="Add tags to this media..."
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default MediaViewer
