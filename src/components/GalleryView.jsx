import React, {
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";

function GalleryView({
  mediaFiles,
  currentIndex,
  onSelectMedia,
  scrollPosition,
  setScrollPosition,
  style,
}) {
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const isVisible = style?.display !== "none";

  // Track scroll position for virtualization only
  const [actualScrollTop, setActualScrollTop] = useState(0);

  // Responsive column sizing for masonry layout
  const getMasonryConfig = useCallback(() => {
    if (!containerSize.width) return { columnWidth: 250, gap: 16, padding: 20, columns: 1 };

    const isMobile = containerSize.width < 768;
    const gap = isMobile ? 12 : 16;
    const padding = isMobile ? 16 : 20;

    // Calculate optimal column width and count
    const availableWidth = containerSize.width - padding * 2;
    const minColumnWidth = isMobile ? 150 : 200;
    const maxColumnWidth = isMobile ? 250 : 300;

    let columns = Math.floor(availableWidth / (minColumnWidth + gap));
    columns = Math.max(2, Math.min(columns, isMobile ? 3 : 6)); // 2-3 cols mobile, 2-6 desktop

    const columnWidth = Math.min(
      maxColumnWidth,
      Math.floor((availableWidth - gap * (columns - 1)) / columns)
    );

    return { columnWidth, gap, padding, columns };
  }, [containerSize.width]);

  const { columnWidth, gap: GAP, padding: PADDING, columns } = getMasonryConfig();

  // Calculate item height based on aspect ratio with some randomization for variety
  const calculateItemHeight = useCallback((file, width) => {
    // Use file hash to generate consistent but varied heights
    const hash = file.file_hash || file.file_path;
    let hashNum = 0;
    for (let i = 0; i < Math.min(hash.length, 8); i++) {
      hashNum += hash.charCodeAt(i);
    }

    // Create aspect ratios that feel natural (portrait, square, landscape)
    const aspectRatios = [0.75, 0.8, 1.0, 1.2, 1.33, 1.5]; // More portrait/square heavy
    const aspectRatio = aspectRatios[hashNum % aspectRatios.length];

    return Math.floor(width / aspectRatio);
  }, []);

  // Masonry layout calculation with virtualization
  const masonryLayout = useMemo(() => {
    if (!containerSize.width || !mediaFiles.length || !columns) {
      return {
        items: [],
        totalHeight: 0,
        visibleRange: { start: 0, end: 0 },
        columnHeights: []
      };
    }

    const items = [];
    const columnHeights = new Array(columns).fill(PADDING);

    // Calculate positions for all items
    mediaFiles.forEach((file, index) => {
      const height = calculateItemHeight(file, columnWidth);

      // Find shortest column
      const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));

      const x = PADDING + shortestColumnIndex * (columnWidth + GAP);
      const y = columnHeights[shortestColumnIndex];

      items.push({
        index,
        file,
        x,
        y,
        width: columnWidth,
        height,
        isSelected: index === currentIndex,
      });

      // Update column height
      columnHeights[shortestColumnIndex] += height + GAP;
    });

    const totalHeight = Math.max(...columnHeights) + PADDING;

    // Calculate visible range with buffer
    const buffer = 500; // pixels buffer
    const visibleStart = Math.max(0, actualScrollTop - buffer);
    const visibleEnd = actualScrollTop + containerSize.height + buffer;

    const visibleItems = items.filter(item =>
      item.y + item.height >= visibleStart && item.y <= visibleEnd
    );

    const visibleRange = {
      start: visibleItems.length > 0 ? visibleItems[0].index : 0,
      end: visibleItems.length > 0 ? visibleItems[visibleItems.length - 1].index : 0
    };

    return {
      items: visibleItems,
      allItems: items,
      totalHeight,
      visibleRange,
      columnHeights
    };
  }, [
    containerSize,
    mediaFiles,
    currentIndex,
    actualScrollTop,
    columns,
    columnWidth,
    GAP,
    PADDING,
    calculateItemHeight
  ]);

  // Handle container resize and visibility changes
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current && isVisible) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({
          width: rect.width,
          height: rect.height,
        });
      }
    };

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && isVisible) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
      if (isVisible) {
        updateSize();
      }
    }

    return () => resizeObserver.disconnect();
  }, [isVisible]);

  // Simple scroll position save/restore - only when switching views
  useEffect(() => {
    if (!isVisible && containerRef.current && setScrollPosition) {
      // Save scroll position when leaving gallery view
      setScrollPosition(containerRef.current.scrollTop);
    }
  }, [isVisible, setScrollPosition]);

  // Restore scroll position only once when becoming visible
  useEffect(() => {
    if (isVisible && containerRef.current && scrollPosition > 0) {
      containerRef.current.scrollTop = scrollPosition;
    }
  }, [isVisible]); // Only depend on isVisible, not scrollPosition

  // Track scroll position for virtualization - simple and non-interfering
  useEffect(() => {
    if (!isVisible || !containerRef.current) return;

    const handleScroll = () => {
      if (containerRef.current) {
        setActualScrollTop(containerRef.current.scrollTop);
      }
    };

    const container = containerRef.current;
    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [isVisible]);

  return (
    <div
      ref={containerRef}
      className="gallery-view overflow-auto h-full bg-black"
      style={style}
    >
      <div className="relative" style={{ height: masonryLayout.totalHeight }}>
        {masonryLayout.items.map((item) => (
          <GalleryItem
            key={item.file.file_hash}
            file={item.file}
            index={item.index}
            x={item.x}
            y={item.y}
            width={item.width}
            height={item.height}
            isSelected={item.isSelected}
            onSelect={onSelectMedia}
          />
        ))}
      </div>
    </div>
  );
}

// Optimized gallery item component with memoization for masonry layout
const GalleryItem = React.memo(
  ({ file, index, x, y, width, height, isSelected, onSelect }) => {
    const [mediaLoaded, setMediaLoaded] = useState(false);
    const [mediaError, setMediaError] = useState(false);
    const [isVideo, setIsVideo] = useState(false);
    const [mediaTypeChecked, setMediaTypeChecked] = useState(false);
    const mediaRef = useRef(null);

    const handleClick = useCallback(() => {
      onSelect(index);
    }, [index, onSelect]);

    const handleMediaLoad = useCallback(() => {
      setMediaLoaded(true);
    }, []);

    const handleMediaError = useCallback(() => {
      setMediaError(true);
    }, []);

    // Check if thumbnail is a video by making a HEAD request
    useEffect(() => {
      const checkMediaType = async () => {
        setMediaTypeChecked(false);
        setMediaLoaded(false);
        setMediaError(false);

        try {
          const response = await fetch(`/thumbnails?hash=${file.file_hash}`, {
            method: 'HEAD'
          });

          const contentType = response.headers.get('content-type');
          const isVideoContent = contentType && contentType.startsWith('video/');

          setIsVideo(isVideoContent);
          setMediaTypeChecked(true);
        } catch (error) {
          setIsVideo(false);
          setMediaTypeChecked(true);
        }
      };

      checkMediaType();
    }, [file.file_hash]);

    // Reset states when file changes
    useEffect(() => {
      setMediaLoaded(false);
      setMediaError(false);
    }, [file.file_hash]);

    return (
      <div
        className={`absolute rounded-lg overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] border-2 ${isSelected
          ? "border-blue-500 shadow-lg shadow-blue-500/30 scale-[1.02]"
          : "border-transparent hover:border-gray-600"
          }`}
        style={{
          left: x,
          top: y,
          width: width,
          height: height,
        }}
        onClick={handleClick}
      >
        {!mediaTypeChecked ? (
          <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
          </div>
        ) : !mediaError ? (
          <>
            {!mediaLoaded && (
              <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
              </div>
            )}
            {isVideo ? (
              <video
                ref={mediaRef}
                src={`/thumbnails?hash=${file.file_hash}`}
                className={`w-full h-full object-cover transition-opacity duration-300 ${mediaLoaded ? "opacity-100" : "opacity-0"
                  }`}
                onLoadedData={handleMediaLoad}
                onError={handleMediaError}
                muted
                loop
                autoPlay
                playsInline
              />
            ) : (
              <img
                ref={mediaRef}
                src={`/thumbnails?hash=${file.file_hash}`}
                alt={`media-${index}`}
                className={`w-full h-full object-cover transition-opacity duration-300 ${mediaLoaded ? "opacity-100" : "opacity-0"
                  }`}
                onLoad={handleMediaLoad}
                onError={handleMediaError}
                loading="lazy"
                decoding="async"
              />
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
            <div className="text-gray-500 text-xs">Failed to load</div>
          </div>
        )}
      </div>
    );
  },
);

GalleryItem.displayName = "GalleryItem";

export default GalleryView;
