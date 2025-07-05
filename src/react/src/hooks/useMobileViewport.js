import { useEffect } from 'react'

export function useMobileViewport() {
  useEffect(() => {
    // Fix for mobile viewport height issues
    const setViewportHeight = () => {
      // Get the actual viewport height
      const vh = window.innerHeight * 0.01
      document.documentElement.style.setProperty('--vh', `${vh}px`)
      
      // Force a reflow to ensure the height is applied
      document.body.style.height = `${window.innerHeight}px`
      
      // For iOS Safari, handle the dynamic viewport
      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        document.documentElement.style.setProperty('--actual-height', `${window.innerHeight}px`)
      }
    }

    // Set initial height
    setViewportHeight()

    // Update on resize and orientation change
    window.addEventListener('resize', setViewportHeight)
    window.addEventListener('orientationchange', () => {
      // Delay to allow for orientation change to complete
      setTimeout(setViewportHeight, 100)
    })

    // iOS specific handling
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      // Handle iOS viewport changes when keyboard appears/disappears
      window.addEventListener('focusin', setViewportHeight)
      window.addEventListener('focusout', setViewportHeight)
      
      // Prevent zoom on double tap
      let lastTouchEnd = 0
      document.addEventListener('touchend', (event) => {
        const now = (new Date()).getTime()
        if (now - lastTouchEnd <= 300) {
          event.preventDefault()
        }
        lastTouchEnd = now
      }, false)
    }

    return () => {
      window.removeEventListener('resize', setViewportHeight)
      window.removeEventListener('orientationchange', setViewportHeight)
      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        window.removeEventListener('focusin', setViewportHeight)
        window.removeEventListener('focusout', setViewportHeight)
      }
    }
  }, [])
}
