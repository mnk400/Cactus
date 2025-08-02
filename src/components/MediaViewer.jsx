import React, { useEffect, useRef, useCallback, useMemo, useState } from "react";
import MediaItem from "./MediaItem";
import { useMediaPreloader } from "../hooks/useMediaPreloader";

function MediaViewer({
  mediaFiles,
  currentIndex,
  onNavigate,
  showTagInput,
}) {
  const containerRef = useRef(null);
  const isScrollingProgrammatically = useRef(false);
  const [containerHeight, setContainerHeight] = useState(0);

  // Touch handling state
  const touchState = useRef({
    startY: 0,
    startTime: 0,
    lastY: 0,
    velocity: 0,
    isDragging: false,
    hasStartedDrag: false
  });

  const { getPreloadedMedia } = useMediaPreloader(mediaFiles, currentIndex);

  // Track container height for virtualization
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Virtual scrolling - only render visible items plus buffer
  const visibleRange = useMemo(() => {
    if (!containerHeight || mediaFiles.length === 0) {
      return { start: 0, end: Math.min(3, mediaFiles.length) };
    }

    const itemHeight = containerHeight;
    const scrollTop = currentIndex * itemHeight;
    const buffer = 2; // Render 2 items before and after visible area

    const start = Math.max(0, currentIndex - buffer);
    const end = Math.min(mediaFiles.length, currentIndex + buffer + 1);

    return { start, end };
  }, [currentIndex, containerHeight, mediaFiles.length]);

  // Scroll to current index when it changes externally (keyboard nav, etc.)
  useEffect(() => {
    if (!containerRef.current || touchState.current.isDragging) return;

    const container = containerRef.current;
    const targetScrollTop = currentIndex * container.clientHeight;
    const currentScrollTop = container.scrollTop;

    // Only scroll if we're not already at the target position
    if (Math.abs(currentScrollTop - targetScrollTop) > 10) {
      isScrollingProgrammatically.current = true;
      container.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });

      // Reset flag after scroll animation
      setTimeout(() => {
        isScrollingProgrammatically.current = false;
      }, 600);
    }
  }, [currentIndex]);

  // Navigate to specific index with smooth animation
  const navigateToIndex = useCallback((targetIndex, immediate = false, velocity = 0) => {
    if (!containerRef.current || targetIndex === currentIndex) return;

    const container = containerRef.current;
    const targetScrollTop = targetIndex * container.clientHeight;

    isScrollingProgrammatically.current = true;
    
    // For high velocity swipes, use a faster, more responsive animation
    if (!immediate && Math.abs(velocity) > 0.2) {
      // Add smooth-scroll class for enhanced CSS transitions
      container.classList.add('smooth-scroll');
      
      // Use a custom scroll with momentum-based timing
      const duration = Math.max(250, Math.min(400, 350 - Math.abs(velocity) * 100));
      
      // Smooth scroll with custom easing
      container.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });
      
      // Remove smooth-scroll class after animation
      setTimeout(() => {
        container.classList.remove('smooth-scroll');
        isScrollingProgrammatically.current = false;
      }, duration);
    } else {
      // Standard smooth scroll
      container.scrollTo({
        top: targetScrollTop,
        behavior: immediate ? 'auto' : 'smooth'
      });
      
      // Reset flag after animation
      const resetDelay = immediate ? 100 : 500;
      setTimeout(() => {
        isScrollingProgrammatically.current = false;
      }, resetDelay);
    }

    // Update parent state
    const direction = targetIndex - currentIndex;
    onNavigate(direction);
  }, [currentIndex, onNavigate]);

  // Handle scroll events to sync with current index
  const handleScroll = useCallback(() => {
    if (!containerRef.current || showTagInput || isScrollingProgrammatically.current || touchState.current.isDragging) return;

    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const itemHeight = container.clientHeight;

    // Calculate which item should be current based on scroll position
    const newIndex = Math.round(scrollTop / itemHeight);
    const clampedIndex = Math.max(0, Math.min(newIndex, mediaFiles.length - 1));

    if (clampedIndex !== currentIndex) {
      // Snap to the calculated index
      navigateToIndex(clampedIndex, true);
    }
  }, [currentIndex, mediaFiles.length, showTagInput, navigateToIndex]);

  // Enhanced touch handling for TikTok-like experience
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e) => {
      // Skip if touching navigation or settings
      if (e.target.closest(".navigation") || e.target.closest(".settings-panel")) {
        return;
      }

      const touch = e.touches[0];
      const currentTime = Date.now();
      touchState.current = {
        startY: touch.clientY,
        startTime: currentTime,
        lastY: touch.clientY,
        lastTime: currentTime,
        velocity: 0,
        isDragging: false,
        hasStartedDrag: false
      };

      // Add touch-active class to disable scroll snap during interaction
      container.classList.add('touch-active');
      container.classList.remove('touch-inactive');
    };

    const handleTouchMove = (e) => {
      if (showTagInput || !touchState.current.startY) return;

      const touch = e.touches[0];
      const currentY = touch.clientY;
      const currentTime = Date.now();
      const deltaY = touchState.current.lastY - currentY;
      const timeDelta = currentTime - touchState.current.startTime;

      // Calculate instantaneous velocity (more responsive)
      const instantTimeDelta = currentTime - (touchState.current.lastTime || touchState.current.startTime);
      if (instantTimeDelta > 0) {
        touchState.current.velocity = deltaY / Math.max(instantTimeDelta, 16); // Minimum 16ms for 60fps
      }

      // Determine if this is a significant drag
      const totalDelta = Math.abs(touchState.current.startY - currentY);
      if (totalDelta > 8 && !touchState.current.hasStartedDrag) {
        touchState.current.hasStartedDrag = true;
        touchState.current.isDragging = true;
      }

      // Update tracking values
      touchState.current.lastY = currentY;
      touchState.current.lastTime = currentTime;

      // Allow natural scrolling for small movements, prevent for larger ones
      if (touchState.current.hasStartedDrag && totalDelta > 15) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e) => {
      if (showTagInput || !touchState.current.startY) return;

      const endTouch = e.changedTouches[0];
      const totalDeltaY = touchState.current.startY - endTouch.clientY;
      const totalTime = Date.now() - touchState.current.startTime;
      const totalDistance = Math.abs(totalDeltaY);

      // Reset dragging state
      const wasDragging = touchState.current.isDragging;
      touchState.current.isDragging = false;
      touchState.current.hasStartedDrag = false;

      // Re-enable scroll snap after touch interaction
      container.classList.remove('touch-active');
      container.classList.add('touch-inactive');

      // Determine if we should navigate
      let shouldNavigate = false;
      let direction = 0;

      // High velocity swipe
      if (Math.abs(touchState.current.velocity) > 0.3 && totalDistance > 20) {
        shouldNavigate = true;
        direction = touchState.current.velocity > 0 ? 1 : -1;
      }
      // Medium velocity with reasonable distance
      else if (Math.abs(touchState.current.velocity) > 0.15 && totalDistance > 50) {
        shouldNavigate = true;
        direction = touchState.current.velocity > 0 ? 1 : -1;
      }
      // Significant distance moved (more than 1/4 of screen)
      else if (totalDistance > containerHeight / 4) {
        shouldNavigate = true;
        direction = totalDeltaY > 0 ? 1 : -1;
      }
      // Quick swipe with moderate distance
      else if (totalDistance > 60 && totalTime < 200) {
        shouldNavigate = true;
        direction = totalDeltaY > 0 ? 1 : -1;
      }

      if (shouldNavigate && wasDragging) {
        e.preventDefault();
        const targetIndex = Math.max(0, Math.min(currentIndex + direction, mediaFiles.length - 1));
        navigateToIndex(targetIndex);
      } else if (wasDragging) {
        // Snap back to current position if no navigation
        navigateToIndex(currentIndex);
      }

      // Reset touch state
      touchState.current.startY = 0;
    };

    const handleWheel = (e) => {
      if (showTagInput) return;

      const delta = e.deltaY;

      // Prevent default for large wheel movements to control navigation
      if (Math.abs(delta) > 50) {
        e.preventDefault();
        const direction = delta > 0 ? 1 : -1;
        const targetIndex = Math.max(0, Math.min(currentIndex + direction, mediaFiles.length - 1));
        navigateToIndex(targetIndex);
      }
    };

    // Throttled scroll handler for better performance
    let scrollTimeout;
    const throttledHandleScroll = () => {
      if (scrollTimeout) return;
      scrollTimeout = setTimeout(() => {
        handleScroll();
        scrollTimeout = null;
      }, 50);
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });
    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('scroll', throttledHandleScroll, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('scroll', throttledHandleScroll);

      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [currentIndex, mediaFiles.length, showTagInput, handleScroll, navigateToIndex, containerHeight]);

  return (
    <div
      ref={containerRef}
      className="media-wrapper h-full w-full overflow-y-auto overflow-x-hidden relative"
      style={{
        scrollSnapType: 'y mandatory',
        scrollBehavior: 'smooth',
        WebkitOverflowScrolling: 'touch', // Better iOS scrolling
        overscrollBehavior: 'contain' // Prevent pull-to-refresh
      }}
    >
      {/* Virtual container with full height */}
      <div
        style={{
          height: `${mediaFiles.length * (containerHeight || window.innerHeight)}px`,
          position: 'relative'
        }}
      >
        {/* Only render visible items */}
        {mediaFiles.slice(visibleRange.start, visibleRange.end).map((mediaFile, virtualIndex) => {
          const actualIndex = visibleRange.start + virtualIndex;
          return (
            <div
              key={`media-${actualIndex}`}
              className="media-item-container absolute w-full flex-shrink-0"
              style={{
                height: `${containerHeight || window.innerHeight}px`,
                top: `${actualIndex * (containerHeight || window.innerHeight)}px`,
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always'
              }}
            >
              <MediaItem
                mediaFile={mediaFile}
                index={actualIndex}
                isActive={actualIndex === currentIndex}
                getPreloadedMedia={getPreloadedMedia}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MediaViewer;
