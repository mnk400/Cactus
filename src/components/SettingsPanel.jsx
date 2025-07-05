import React from 'react'

function SettingsPanel({ 
  isOpen, 
  currentMediaType, 
  onMediaTypeChange, 
  onRescan, 
  isScanning 
}) {
  if (!isOpen) return null

  const getButtonClass = (mediaType) => {
    const baseClass = "media-type-btn flex-1 border-none py-2 px-3 rounded-xl cursor-pointer text-sm transition-colors duration-200 ease-in-out hover:bg-black-shades-600"
    
    if (currentMediaType === mediaType) {
      return `${baseClass} bg-black-shades-700 text-gray-200 font-bold`
    }
    return `${baseClass} bg-black-shades-800 text-gray-200`
  }

  return (
    <div className="settings-panel absolute bottom-20 left-0 bg-black bg-opacity-90 rounded-3xl p-4 text-gray-200 z-10 backdrop-blur-md flex flex-col gap-2.5 w-full box-border text-center">
      <h3 className="mt-0 text-gray-200 text-lg mb-2.5">Settings</h3>
      
      <div className="setting-group flex flex-col gap-2 mb-2.5">
        <label className="text-sm text-gray-400 text-left">Media Type:</label>
        <div className="media-type-selector flex gap-1 justify-between">
          <button
            onClick={() => onMediaTypeChange('all')}
            className={getButtonClass('all')}
          >
            All
          </button>
          <button
            onClick={() => onMediaTypeChange('photos')}
            className={getButtonClass('photos')}
          >
            Photos
          </button>
          <button
            onClick={() => onMediaTypeChange('videos')}
            className={getButtonClass('videos')}
          >
            Videos
          </button>
        </div>
      </div>
      
      <button
        onClick={onRescan}
        disabled={isScanning}
        className={`nav-button w-full justify-center border-none p-2 rounded-xl cursor-pointer text-lg transition-colors duration-200 ease-in-out active:scale-95 ${
          isScanning 
            ? 'bg-black-shades-700 text-gray-400 cursor-not-allowed opacity-50' 
            : 'bg-black-shades-600 hover:bg-black-shades-500 text-gray-200'
        }`}
      >
        {isScanning ? 'Scanning...' : 'Rescan Directory'}
      </button>
    </div>
  )
}

export default SettingsPanel
