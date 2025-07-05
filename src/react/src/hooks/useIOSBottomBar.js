import { useState, useEffect } from 'react'

export function useIOSBottomBar() {
  const [isBottomBarVisible, setIsBottomBarVisible] = useState(false)
  const [lastWindowHeight, setLastWindowHeight] = useState(window.innerHeight)

  useEffect(() => {
    const handleIOSBottomBar = () => {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
      if (!isIOS) return
      
      const currentWindowHeight = window.innerHeight
      
      if (currentWindowHeight < lastWindowHeight - 50) {
        setIsBottomBarVisible(true)
      } else if (currentWindowHeight >= lastWindowHeight - 10 || currentWindowHeight > lastWindowHeight) {
        setIsBottomBarVisible(false)
      }
      
      setLastWindowHeight(currentWindowHeight)
    }

    window.addEventListener('resize', handleIOSBottomBar)
    window.addEventListener('scroll', handleIOSBottomBar)
    window.addEventListener('orientationchange', () => {
      setTimeout(handleIOSBottomBar, 300)
    })

    // Initial check
    setTimeout(handleIOSBottomBar, 500)

    return () => {
      window.removeEventListener('resize', handleIOSBottomBar)
      window.removeEventListener('scroll', handleIOSBottomBar)
      window.removeEventListener('orientationchange', handleIOSBottomBar)
    }
  }, [lastWindowHeight])

  return { isBottomBarVisible }
}
