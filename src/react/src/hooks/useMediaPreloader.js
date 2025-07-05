import { useRef, useEffect } from 'react'
import { isImage, isVideo } from '../utils/helpers'

export function useMediaPreloader(mediaFiles, currentIndex) {
  const preloadedMedia = useRef(new Map())

  const preloadMedia = (indices) => {
    indices.forEach(index => {
      if (index < 0 || index >= mediaFiles.length || preloadedMedia.current.has(index)) {
        return
      }

      const mediaFile = mediaFiles[index]
      
      if (isImage(mediaFile)) {
        const img = new Image()
        img.src = `/media?path=${encodeURIComponent(mediaFile)}`
        img.onload = () => {
          preloadedMedia.current.set(index, img)
          console.log(`Preloaded image at index ${index}`)
        }
        img.onerror = () => {
          console.warn(`Failed to preload image at index ${index}`)
        }
      } else if (isVideo(mediaFile)) {
        const video = document.createElement('video')
        video.src = `/media?path=${encodeURIComponent(mediaFile)}`
        video.preload = 'metadata'
        video.setAttribute('playsinline', '')
        video.muted = true
        video.onloadedmetadata = () => {
          preloadedMedia.current.set(index, video)
          console.log(`Preloaded video at index ${index}`)
        }
        video.onerror = () => {
          console.warn(`Failed to preload video at index ${index}`)
        }
      }
    })
  }

  const cleanupPreloadedMedia = () => {
    const keepIndices = new Set([
      currentIndex - 2,
      currentIndex - 1,
      currentIndex,
      currentIndex + 1,
      currentIndex + 2
    ])

    for (const [index, element] of preloadedMedia.current.entries()) {
      if (!keepIndices.has(index)) {
        if (element.tagName === 'VIDEO') {
          element.src = ''
          element.load()
        }
        preloadedMedia.current.delete(index)
        console.log(`Cleaned up preloaded media at index ${index}`)
      }
    }
  }

  // Preload adjacent media when currentIndex changes
  useEffect(() => {
    if (mediaFiles.length === 0) return

    const preloadIndices = [
      (currentIndex + 1) % mediaFiles.length,
      (currentIndex + 2) % mediaFiles.length,
      (currentIndex - 1 + mediaFiles.length) % mediaFiles.length
    ]
    
    preloadMedia(preloadIndices)
    cleanupPreloadedMedia()
  }, [mediaFiles, currentIndex])

  // Clear preloaded media when mediaFiles change
  useEffect(() => {
    preloadedMedia.current.clear()
  }, [mediaFiles])

  const getPreloadedMedia = (index) => {
    return preloadedMedia.current.get(index)
  }

  return { getPreloadedMedia }
}
