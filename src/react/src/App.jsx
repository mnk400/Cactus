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

  const currentMediaFile = mediaFiles[currentIndex]
  const directoryName = currentMediaFile 
    ? currentMediaFile.split('/').slice(0, -1).pop() || 'Root'
    : ''

  return (
    <div className="container flex flex-col h-screen w-full max-w-full shadow-2xl overflow-hidden">
      <div className="media-container flex-1 relative overflow-hidden bg-black">
        {loading && <LoadingMessage message={loading} />}
        {error && <ErrorMessage message={error} />}
        
        {!loading && !error && mediaFiles.length > 0 && (
          <MediaViewer
            mediaFiles={mediaFiles}
            currentIndex={currentIndex}
            onNavigate={handleNavigation}
            isBottomBarVisible={isBottomBarVisible}
          />
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
