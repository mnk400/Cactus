import React, { useState, useEffect } from 'react'
import MediaViewer from './components/MediaViewer'
import Navigation from './components/Navigation'
import LoadingMessage from './components/LoadingMessage'
import ErrorMessage from './components/ErrorMessage'
import { useMediaFiles } from './hooks/useMediaFiles'
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation'
import { useIOSBottomBar } from './hooks/useIOSBottomBar'

function App() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentMediaType, setCurrentMediaType] = useState('all')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  
  const {
    mediaFiles,
    loading,
    error,
    fetchMediaFiles,
    filterMedia,
    rescanDirectory,
    isScanning
  } = useMediaFiles()

  const { isBottomBarVisible } = useIOSBottomBar()

  // Initialize media files on mount
  useEffect(() => {
    fetchMediaFiles('all')
  }, [])

  // Reset currentIndex when mediaFiles change to prevent out-of-bounds access
  useEffect(() => {
    if (mediaFiles.length > 0 && currentIndex >= mediaFiles.length) {
      setCurrentIndex(0)
    }
  }, [mediaFiles, currentIndex])

  // Keyboard navigation
  useKeyboardNavigation((direction) => {
    if (mediaFiles.length > 0) {
      setCurrentIndex(prev => 
        (prev + direction + mediaFiles.length) % mediaFiles.length
      )
    }
  })

  const handleNavigation = (direction) => {
    if (mediaFiles.length > 0) {
      setCurrentIndex(prev => 
        (prev + direction + mediaFiles.length) % mediaFiles.length
      )
    }
  }

  const handleMediaTypeChange = async (mediaType) => {
    if (mediaType === currentMediaType) return
    
    setCurrentMediaType(mediaType)
    setCurrentIndex(0)
    await filterMedia(mediaType)
    setIsSettingsOpen(false)
  }

  const handleRescan = async () => {
    await rescanDirectory()
    await fetchMediaFiles(currentMediaType)
    setIsSettingsOpen(false)
  }

  // Safely get current media file and directory name
  const currentMediaFile = mediaFiles.length > 0 && currentIndex < mediaFiles.length 
    ? mediaFiles[currentIndex] 
    : null
    
  const directoryName = currentMediaFile 
    ? currentMediaFile.split('/').slice(0, -1).pop() || 'Root'
    : ''

  return (
    <div className="container flex flex-col h-screen w-full max-w-full shadow-2xl overflow-hidden">
      <div className="media-container flex-1 relative overflow-hidden bg-black">
        {loading && <LoadingMessage message={loading} />}
        {error && <ErrorMessage message={error} />}
        
        {!loading && !error && mediaFiles.length > 0 && currentMediaFile && (
          <MediaViewer
            mediaFiles={mediaFiles}
            currentIndex={currentIndex}
            onNavigate={handleNavigation}
            isBottomBarVisible={isBottomBarVisible}
          />
        )}

        {!loading && !error && mediaFiles.length === 0 && (
          <div className="h-full w-full flex justify-center items-center text-gray-500 text-center p-5">
            <div>
              <p className="text-lg mb-2">No media files found</p>
              <p className="text-sm">Try rescanning the directory or check if the directory contains supported media files.</p>
            </div>
          </div>
        )}

        <Navigation
          onPrevious={() => handleNavigation(-1)}
          onNext={() => handleNavigation(1)}
          onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)}
          directoryName={directoryName}
          isSettingsOpen={isSettingsOpen}
          currentMediaType={currentMediaType}
          onMediaTypeChange={handleMediaTypeChange}
          onRescan={handleRescan}
          isScanning={isScanning}
          showNavButtons={mediaFiles.length > 0}
          isBottomBarVisible={isBottomBarVisible}
          currentMediaFile={currentMediaFile}
        />
      </div>
    </div>
  )
}

export default App
