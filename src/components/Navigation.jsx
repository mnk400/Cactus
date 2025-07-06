import React from 'react'
import FullscreenButton from './FullscreenButton'
import { isVideo } from '../utils/helpers'

function Navigation({
  onPrevious,
  onNext,
  onToggleSettings,
  directoryName,
  showNavButtons,
  currentMediaFile
}) {
  // Extract just the directory name for the navigation bar display
  const shortDirectoryName = directoryName 
    ? directoryName.split('/').pop() || directoryName.split('/').slice(-2, -1)[0] || 'Root'
    : ''
  return (
    <div 
      className="navigation absolute left-1/2 transform -translate-x-1/2 flex items-center justify-end gap-2 z-20 p-2 bg-black bg-opacity-80 rounded-2xl w-11/12 max-w-xl backdrop-blur-md transition-all duration-300 bottom-6"
    >
      {showNavButtons && (
        <>
          <button
            onClick={onPrevious}
            className="nav-button bg-black bg-opacity-40 text-gray-200 border-none p-2 rounded-xl cursor-pointer text-lg transition-all duration-200 ease-in-out hover:bg-white hover:bg-opacity-20 active:scale-95 min-w-10 min-h-10"
          >
            ↑
          </button>
          <button
            onClick={onNext}
            className="nav-button bg-black bg-opacity-40 text-gray-200 border-none p-2 rounded-xl cursor-pointer text-lg transition-all duration-200 ease-in-out hover:bg-white hover:bg-opacity-20 active:scale-95 min-w-10 min-h-10"
          >
            ↓
          </button>
        </>
      )}
      
      <button
        onClick={onToggleSettings}
        className="nav-button bg-black bg-opacity-40 text-gray-200 border-none p-2 rounded-xl cursor-pointer text-lg transition-all duration-200 ease-in-out hover:bg-white hover:bg-opacity-20 active:scale-95 min-w-10 min-h-10"
      >
        ⋯
      </button>
      
      {isVideo(currentMediaFile) && (
        <FullscreenButton />
      )}
      
      <div className="directory-name text-gray-200 text-base ml-auto px-4 whitespace-nowrap overflow-hidden text-ellipsis">
        {shortDirectoryName}
      </div>
    </div>
  )
}

export default Navigation
