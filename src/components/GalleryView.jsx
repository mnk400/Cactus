import React, {
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import { useMedia } from "../context/MediaContext";

function GalleryView({
  scrollPosition,
  setScrollPosition,
  style,
}) {
  const { mediaFiles, currentIndex, selectMedia } = useMedia();
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const isVisible = style?.display !== "none";

  const [actualScrollTop, setActualScrollTop] = useState(0);

  const getMasonryConfig = useCallback(() => {
    if (!containerSize.width)
      return { columnWidth: 250, gap: 8, padding: 20, columns: 1 };

    const isMobile = containerSize.width < 768;
    const gap = isMobile ? 6 : 8;
    const padding = isMobile ? 16 : 20;

    const availableWidth = containerSize.width - padding * 2;
    const minColumnWidth = isMobile ? 150 : 200;
    const maxColumnWidth = isMobile ? 250 : 300;

    let columns = Math.floor(availableWidth / (minColumnWidth + gap));
    columns = Math.max(2, Math.min(columns, isMobile ? 3 : 6));

    const columnWidth = Math.min(
      maxColumnWidth,
      Math.floor((availableWidth - gap * (columns - 1)) / columns),
    );

    return { columnWidth, gap, padding, columns };
  }, [containerSize.width]);

  const {
    columnWidth,
    gap: GAP,
    padding: PADDING,
    columns,
  } = getMasonryConfig();

  const [imageDimensions, setImageDimensions] = useState(new Map());

  const calculateItemHeight = useCallback(
    (file, width) => {
      const dimensions = imageDimensions.get(file.file_hash);

      if (dimensions && dimensions.width && dimensions.height) {
        const aspectRatio = dimensions.width / dimensions.height;
        return Math.floor(width / aspectRatio);
      }

      return Math.floor(width / 1.2);
    },
    [imageDimensions],
  );

  const masonryLayout = useMemo(() => {
    if (!containerSize.width || !mediaFiles.length || !columns) {
      return {
        items: [],
        totalHeight: 0,
        visibleRange: { start: 0, end: 0 },
        columnHeights: [],
      };
    }

    const items = [];
    const columnHeights = new Array(columns).fill(PADDING);

    mediaFiles.forEach((file, index) => {
      const height = calculateItemHeight(file, columnWidth);
      const shortestColumnIndex = columnHeights.indexOf(
        Math.min(...columnHeights),
      );
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

      columnHeights[shortestColumnIndex] += height + GAP;
    });

    const totalHeight = Math.max(...columnHeights) + PADDING;

    const buffer = Math.min(300, containerSize.height * 0.5);
    const visibleStart = Math.max(0, actualScrollTop - buffer);
    const visibleEnd = actualScrollTop + containerSize.height + buffer;

    const visibleItems = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.y + item.height >= visibleStart && item.y <= visibleEnd) {
        visibleItems.push(item);
      } else if (item.y > visibleEnd) {
        break;
      }
    }

    return {
      items: visibleItems,
      totalHeight,
      visibleRange: {
        start: visibleItems.length > 0 ? visibleItems[0].index : 0,
        end:
          visibleItems.length > 0
            ? visibleItems[visibleItems.length - 1].index
            : 0,
      },
      renderedCount: visibleItems.length,
      totalCount: mediaFiles.length,
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
    calculateItemHeight,
  ]);

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

  useEffect(() => {
    if (!isVisible && containerRef.current && setScrollPosition) {
      setScrollPosition(containerRef.current.scrollTop);
    }
  }, [isVisible, setScrollPosition]);

  useEffect(() => {
    if (isVisible && containerRef.current && scrollPosition > 0) {
      containerRef.current.scrollTop = scrollPosition;
    }
  }, [isVisible, scrollPosition]);

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

  const handleDimensionsLoad = useCallback((fileHash, dimensions) => {
    setImageDimensions((prev) => {
      const newMap = new Map(prev);
      newMap.set(fileHash, dimensions);
      return newMap;
    });
  }, []);

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
            onSelect={selectMedia}
            onDimensionsLoad={handleDimensionsLoad}
          />
        ))}
      </div>
    </div>
  );
}

// Gallery item with intersection observer lazy loading
const GalleryItem = React.memo(
  ({
    file,
    index,
    x,
    y,
    width,
    height,
    isSelected,
    onSelect,
    onDimensionsLoad,
  }) => {
    const [mediaLoaded, setMediaLoaded] = useState(false);
    const [mediaError, setMediaError] = useState(false);
    const [isVideo, setIsVideo] = useState(false);
    const [mediaTypeChecked, setMediaTypeChecked] = useState(false);
    const [inView, setInView] = useState(false);
    const mediaRef = useRef(null);
    const containerRef = useRef(null);

    const handleClick = useCallback(
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect(index);
      },
      [index, onSelect],
    );

    const handleMediaLoad = useCallback(() => {
      setMediaLoaded(true);

      if (mediaRef.current && onDimensionsLoad) {
        const element = mediaRef.current;
        if (element.tagName === "IMG") {
          onDimensionsLoad(file.file_hash, {
            width: element.naturalWidth,
            height: element.naturalHeight,
          });
        } else if (element.tagName === "VIDEO") {
          onDimensionsLoad(file.file_hash, {
            width: element.videoWidth,
            height: element.videoHeight,
          });
        }
      }
    }, [file.file_hash, onDimensionsLoad]);

    const handleMediaError = useCallback(() => {
      setMediaError(true);
    }, []);

    useEffect(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        },
        {
          rootMargin: "200px",
          threshold: 0.1,
        },
      );

      if (containerRef.current) {
        observer.observe(containerRef.current);
      }

      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      if (!inView) return;

      const checkMediaType = async () => {
        setMediaTypeChecked(false);
        setMediaLoaded(false);
        setMediaError(false);

        try {
          const response = await fetch(`/thumbnails?hash=${file.file_hash}`, {
            method: "HEAD",
          });

          const contentType = response.headers.get("content-type");
          const isVideoContent =
            contentType && contentType.startsWith("video/");

          setIsVideo(isVideoContent);
          setMediaTypeChecked(true);
        } catch (error) {
          setIsVideo(false);
          setMediaTypeChecked(true);
        }
      };

      checkMediaType();
    }, [file.file_hash, inView]);

    useEffect(() => {
      setMediaLoaded(false);
      setMediaError(false);
    }, [file.file_hash]);

    return (
      <div
        ref={containerRef}
        className={`gallery-item absolute rounded-md overflow-hidden cursor-pointer transition-all duration-200 border-2 ${isSelected
          ? "border-blue-500 shadow-lg shadow-blue-500/30"
          : "border-transparent hover:border-gray-600"
          }`}
        style={{
          transform: `translate3d(${x}px, ${y}px, 0)`,
          width: width,
          height: height,
          willChange: "transform",
        }}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick(e);
          }
        }}
      >
        {!inView ? (
          <div className="absolute inset-0 bg-black-shades-800 flex items-center justify-center">
            <div className="w-8 h-8 text-gray-600">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
              </svg>
            </div>
          </div>
        ) : !mediaTypeChecked ? (
          <div className="absolute inset-0 bg-black-shades-800 animate-pulse flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
          </div>
        ) : !mediaError ? (
          <>
            {!mediaLoaded && (
              <div className="absolute inset-0 bg-black-shades-800 animate-pulse flex items-center justify-center">
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
                style={{ pointerEvents: "none" }}
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
                style={{ pointerEvents: "none" }}
              />
            )}
          </>
        ) : (
          <div className="w-full h-full bg-black-shades-800 flex items-center justify-center">
            <div className="text-gray-500 text-xs">Failed to load</div>
          </div>
        )}

        {/* Video indicator - only show for actual video media types */}
        {mediaLoaded && !mediaError && file.media_type === 'video' && (
          <div className="absolute bottom-1 right-1 bg-black/60 rounded-full p-1 pointer-events-none">
            <svg
              className="w-3 h-3 text-white"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        )}
      </div>
    );
  },
);

GalleryItem.displayName = "GalleryItem";

export default GalleryView;
