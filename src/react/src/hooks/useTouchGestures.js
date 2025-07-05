import { useRef, useCallback } from 'react'

export function useTouchGestures(onNavigate) {
  const touchState = useRef({
    startY: 0,
    currentY: 0,
    startX: 0,
    currentX: 0,
    isScrolling: false,
    touchStartTime: 0
  })

  const handleTouchStart = useCallback((e) => {
    if (e.target.closest('.navigation') || e.target.closest('.settings-panel')) {
      return
    }

    const touch = e.touches[0]
    touchState.current = {
      startY: touch.clientY,
      startX: touch.clientX,
      currentY: touch.clientY,
      currentX: touch.clientX,
      isScrolling: false,
      touchStartTime: Date.now()
    }
  }, [])

  const handleTouchMove = useCallback((e) => {
    const { startY, startX } = touchState.current
    if (!startY || !startX) return

    if (e.target.closest('.navigation') || e.target.closest('.settings-panel')) {
      return
    }

    const touch = e.touches[0]
    touchState.current.currentY = touch.clientY
    touchState.current.currentX = touch.clientX
    
    const deltaY = startY - touch.clientY
    const deltaX = startX - touch.clientX
    
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
      touchState.current.isScrolling = true
      e.preventDefault()
      
      // Apply visual feedback
      const resistance = 0.4
      const maxOffset = 100
      const offset = Math.max(-maxOffset, Math.min(maxOffset, -deltaY * resistance))
      
      const mediaWrapper = document.querySelector('.media-wrapper')
      if (mediaWrapper) {
        mediaWrapper.style.transform = `translateY(${offset}px)`
        
        const progress = Math.min(Math.abs(deltaY) / 150, 0.3)
        mediaWrapper.style.opacity = 1 - progress
      }
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    const { startY, startX, currentY, currentX, isScrolling, touchStartTime } = touchState.current
    
    if (!startY || !startX || !isScrolling) {
      touchState.current = { startY: 0, startX: 0, currentY: 0, currentX: 0, isScrolling: false, touchStartTime: 0 }
      return
    }

    const deltaY = startY - currentY
    const deltaX = startX - currentX
    const touchDuration = Date.now() - touchStartTime
    
    const swipeThreshold = 50
    const quickSwipeThreshold = 30
    const isQuickSwipe = touchDuration < 300
    
    const effectiveThreshold = isQuickSwipe ? quickSwipeThreshold : swipeThreshold
    
    const mediaWrapper = document.querySelector('.media-wrapper')
    
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > effectiveThreshold) {
      if (deltaY > 0) {
        onNavigate(1) // Swipe up = next
      } else {
        onNavigate(-1) // Swipe down = previous
      }
    } else if (mediaWrapper) {
      // Reset visual feedback
      mediaWrapper.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      mediaWrapper.style.transform = 'translateY(0)'
      mediaWrapper.style.opacity = '1'
      
      setTimeout(() => {
        mediaWrapper.style.transition = ''
      }, 400)
    }
    
    touchState.current = { startY: 0, startX: 0, currentY: 0, currentX: 0, isScrolling: false, touchStartTime: 0 }
  }, [onNavigate])

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  }
}
