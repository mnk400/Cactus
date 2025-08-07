import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";

function GalleryView({ mediaFiles, currentIndex, onSelectMedia, scrollPosition, setScrollPosition, style }) {
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const isVisible = style?.display !== 'none';

  // Use scrollPosition as the single source of truth
  const currentScrollTop = scrollPosition || 0;

  // Track actual scroll position for virtualization
  const [actualScrollTop, setActualScrollTop] = useState(currentScrollTop);

  // Responsive item sizing - ensure at least 2 rows on mobile
  const getResponsiveItemSize = useCallback(() => {
    if (!containerSize.width || !containerSize.height) return { itemSize: 256, gap: 16, padding: 20 };

    const isMobile = containerSize.width < 768;
    const gap = isMobile ? 12 : 16;
    const padding = isMobile ? 16 : 20;

    if (isMobile) {
      // On mobile, calculate item size to fit at least 2 rows comfortably
      const availableHeight = containerSize.height - (padding * 2);
      const minRows = 2;
      const maxItemSize = Math.floor((availableHeight - (gap * (minRows - 1))) / minRows);

      const availableWidth = containerSize.width - (padding * 2);
      const minItemsPerRow = 2;
      const maxItemSizeByWidth = Math.floor((availableWidth - (gap * (minItemsPerRow - 1))) / minItemsPerRow);

      const itemSize = Math.min(maxItemSize, maxItemSizeByWidth, 200); // Cap at 200px for mobile
      return { itemSize: Math.max(itemSize, 120), gap, padding }; // Minimum 120px
    }

    return { itemSize: 256, gap, padding };
  }, [containerSize]);

  const { itemSize: ITEM_SIZE, gap: GAP, padding: PADDING } = getResponsiveItemSize();

  // Calculate grid dimensions using the actual scroll position
  const { itemsPerRow, totalRows, visibleRange, totalHeight } = useMemo(() => {
    if (!containerSize.width || !mediaFiles.length) {
      return { itemsPerRow: 0, totalRows: 0, visibleRange: { start: 0, end: 0 }, totalHeight: 0 };
    }

    const availableWidth = containerSize.width - (PADDING * 2);
    const itemsPerRow = Math.max(1, Math.floor((availableWidth + GAP) / (ITEM_SIZE + GAP)));
    const totalRows = Math.ceil(mediaFiles.length / itemsPerRow);
    const rowHeight = ITEM_SIZE + GAP;
    const totalHeight = totalRows * rowHeight + PADDING * 2;

    // Calculate visible range with buffer using actual scroll position
    const visibleHeight = containerSize.height;
    const buffer = 3;
    const startRow = Math.max(0, Math.floor(actualScrollTop / rowHeight) - buffer);
    const endRow = Math.min(totalRows - 1, Math.ceil((actualScrollTop + visibleHeight) / rowHeight) + buffer);

    const startIndex = startRow * itemsPerRow;
    const endIndex = Math.min(mediaFiles.length - 1, (endRow + 1) * itemsPerRow - 1);

    return {
      itemsPerRow,
      totalRows,
      visibleRange: { start: startIndex, end: endIndex },
      totalHeight
    };
  }, [containerSize, actualScrollTop, mediaFiles.length, ITEM_SIZE, GAP, PADDING]);

  // Handle container resize and visibility changes
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current && isVisible) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({
          width: rect.width,
          height: rect.height
        });
      }
    };

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && isVisible) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
      // Force size update when component becomes visible
      if (isVisible) {
        updateSize();
      }
    }

    return () => resizeObserver.disconnect();
  }, [isVisible]);

  // Calculate scroll position to center the selected item when returning to gallery
  const calculateScrollPositionForItem = useCallback((index) => {
    if (!containerSize.width || !containerSize.height || !mediaFiles.length) return 0;

    const availableWidth = containerSize.width - (PADDING * 2);
    const itemsPerRow = Math.max(1, Math.floor((availableWidth + GAP) / (ITEM_SIZE + GAP)));
    const rowHeight = ITEM_SIZE + GAP;

    const row = Math.floor(index / itemsPerRow);
    const itemY = PADDING + row * rowHeight;

    // Center the item vertically in the viewport
    const viewportCenter = containerSize.height / 2;
    const itemCenter = itemY + ITEM_SIZE / 2;

    return Math.max(0, itemCenter - viewportCenter);
  }, [containerSize, mediaFiles.length, ITEM_SIZE, GAP, PADDING]);

  // Restore scroll position when gallery becomes visible
  useEffect(() => {
    if (containerRef.current && isVisible) {
      if (currentScrollTop === 0 && currentIndex > 0) {
        // If no scroll position is saved, calculate one based on the selected item
        const calculatedPosition = calculateScrollPositionForItem(currentIndex);
        containerRef.current.scrollTop = calculatedPosition;
        setActualScrollTop(calculatedPosition);
        if (setScrollPosition) {
          setScrollPosition(calculatedPosition);
        }
      } else {
        // Use the saved scroll position
        containerRef.current.scrollTop = currentScrollTop;
        setActualScrollTop(currentScrollTop);
      }
    }
  }, [isVisible, currentIndex, currentScrollTop, calculateScrollPositionForItem, setScrollPosition]);

  // Track scroll position for virtualization without interfering with scrolling
  useEffect(() => {
    if (!isVisible || !containerRef.current) return;

    let ticking = false;

    const updateScrollPosition = () => {
      if (containerRef.current) {
        const scrollTop = containerRef.current.scrollTop;
        setActualScrollTop(scrollTop);
      }
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateScrollPosition);
        ticking = true;
      }
    };

    const container = containerRef.current;
    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [isVisible]);

  // Calculate centering offset
  const centeringOffset = useMemo(() => {
    if (!containerSize.width || !itemsPerRow) return 0;

    const gridWidth = itemsPerRow * ITEM_SIZE + (itemsPerRow - 1) * GAP;
    const availableWidth = containerSize.width - (PADDING * 2);

    return Math.max(0, (availableWidth - gridWidth) / 2);
  }, [containerSize.width, itemsPerRow, ITEM_SIZE, GAP, PADDING]);

  // Generate visible items
  const visibleItems = useMemo(() => {
    const items = [];
    for (let i = visibleRange.start; i <= visibleRange.end && i < mediaFiles.length; i++) {
      const file = mediaFiles[i];
      const row = Math.floor(i / itemsPerRow);
      const col = i % itemsPerRow;

      const x = PADDING + centeringOffset + col * (ITEM_SIZE + GAP);
      const y = PADDING + row * (ITEM_SIZE + GAP);

      items.push({
        index: i,
        file,
        x,
        y,
        isSelected: i === currentIndex
      });
    }
    return items;
  }, [visibleRange, mediaFiles, itemsPerRow, currentIndex, centeringOffset, PADDING, ITEM_SIZE, GAP]);

  return (
    <div
      ref={containerRef}
      className="gallery-view overflow-auto h-full bg-black"
      style={style}
    >
      <div
        className="relative"
        style={{ height: totalHeight }}
      >
        {visibleItems.map(({ index, file, x, y, isSelected }) => (
          <GalleryItem
            key={file.file_hash}
            file={file}
            index={index}
            x={x}
            y={y}
            size={ITEM_SIZE}
            isSelected={isSelected}
            onSelect={onSelectMedia}
          />
        ))}
      </div>
    </div>
  );
}

// Optimized gallery item component with memoization
const GalleryItem = React.memo(({ file, index, x, y, size, isSelected, onSelect }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const imgRef = useRef(null);

  const handleClick = useCallback(() => {
    onSelect(index);
  }, [index, onSelect]);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  // Reset states when file changes
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [file.file_hash]);

  return (
    <div
      className={`absolute rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:scale-105 border-4 ${isSelected ? "border-blue-500 shadow-lg shadow-blue-500/50" : "border-transparent hover:border-gray-600"
        }`}
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        transform: isSelected ? 'scale(1.02)' : 'scale(1)',
      }}
      onClick={handleClick}
    >
      {!imageError ? (
        <>
          {!imageLoaded && (
            <div
              className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center"
            >
              <div className="w-8 h-8 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
            </div>
          )}
          <img
            ref={imgRef}
            src={`/thumbnails?hash=${file.file_hash}`}
            alt={`media-${index}`}
            className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading="lazy"
            decoding="async"
          />
        </>
      ) : (
        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
          <div className="text-gray-500 text-sm">Failed to load</div>
        </div>
      )}
    </div>
  );
});

GalleryItem.displayName = 'GalleryItem';

export default GalleryView;
