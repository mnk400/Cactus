import React from 'react'
import FullscreenButton from './FullscreenButton'
import { isVideo } from '../utils/helpers'

function Navigation({
  onPrevious,
  onNext,
  onToggleSettings,
  onToggleTagInput,
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
      className="navigation absolute left-1/2 transform -translate-x-1/2 flex items-center justify-end gap-2 z-20 p-2 bg-black-shades-1000 rounded-2xl w-11/12 max-w-xl transition-all duration-300 bottom-6"
    >
      {showNavButtons && (
        <>
          <button
            onClick={onPrevious}
            className="nav-button bg-black-shades-700 text-gray-200 border-none p-2 rounded-xl cursor-pointer text-lg transition-all duration-200 ease-in-out hover:bg-white hover:bg-opacity-20 active:scale-95 min-w-10 min-h-10"
          >
            ↑
          </button>
          <button
            onClick={onNext}
            className="nav-button bg-black-shades-700 text-gray-200 border-none p-2 rounded-xl cursor-pointer text-lg transition-all duration-200 ease-in-out hover:bg-white hover:bg-opacity-20 active:scale-95 min-w-10 min-h-10"
          >
            ↓
          </button>
        </>
      )}
      
      <button
        onClick={onToggleTagInput}
        className="nav-button bg-black-shades-700 text-gray-200 border-none p-2 rounded-xl cursor-pointer transition-all duration-200 ease-in-out hover:bg-white hover:bg-opacity-20 active:scale-95 min-w-10 min-h-11 flex items-center justify-center"
        title="Add tags (T)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      </button>
      
      <button
        onClick={onToggleSettings}
        className="nav-button bg-black-shades-700 text-gray-200 border-none p-2 rounded-xl cursor-pointer text-lg transition-all duration-200 ease-in-out hover:bg-white hover:bg-opacity-20 active:scale-95 min-w-10 min-h-10"
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
