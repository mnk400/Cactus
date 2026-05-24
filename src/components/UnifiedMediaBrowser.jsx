import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { VirtuosoMasonry } from "@virtuoso.dev/masonry";
import MediaItem from "./MediaItem";
import SlideshowOverlay from "./SlideshowOverlay";
import { useMediaPreloader } from "../hooks/useMediaPreloader";
import { useSlideshow } from "../hooks/useSlideshow";
import {
  useCurrentMedia,
  useMediaData,
  useSlideshowState,
} from "../context/MediaContext";

const getAspectRatio = (file) => {
  if (file?.width && file?.height) return file.width / file.height;
  return 1.2;
};

const getColumnCount = (width) => {
  if (width < 520) return 2;
  if (width < 860) return 3;
  if (width < 1180) return 4;
  if (width < 1500) return 5;
  return 6;
};

const estimateGalleryOffset = (mediaFiles, index, columnCount, galleryWidth) => {
  if (!mediaFiles.length || index <= 0 || !galleryWidth) return 0;

  const scrollerPadding = 14 * 2;
  const cellPadding = 8;
  const columnWidth = Math.max(
    120,
    (galleryWidth - scrollerPadding) / Math.max(1, columnCount),
  );
  const contentWidth = Math.max(80, columnWidth - cellPadding);
  const columnHeights = new Array(columnCount).fill(0);
  let selectedTop = 0;

  for (let i = 0; i <= index && i < mediaFiles.length; i++) {
    const file = mediaFiles[i];
    const shortestColumn = columnHeights.indexOf(Math.min(...columnHeights));
    const itemHeight = contentWidth / getAspectRatio(file) + cellPadding;

    if (i === index) {
      selectedTop = columnHeights[shortestColumn];
      break;
    }

    columnHeights[shortestColumn] += itemHeight;
  }

  return Math.max(0, selectedTop - window.innerHeight * 0.35);
};

const createCurrentIndexStore = (initial) => {
  const listeners = new Set();
  let value = initial;
  return {
    setValue(next) {
      if (next === value) return;
      value = next;
      listeners.forEach((l) => l());
    },
    getSnapshot() {
      return value;
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
};

const GalleryItem = memo(function GalleryItem({ data, index, context }) {
  const { currentIndexStore, onSelectMedia, isGalleryView } = context;
  const getSelectedSnapshot = useCallback(
    () => currentIndexStore.getSnapshot() === index,
    [currentIndexStore, index],
  );
  const isSelected = useSyncExternalStore(
    currentIndexStore.subscribe,
    getSelectedSnapshot,
  );
  const isActive = isSelected && isGalleryView;
  const aspectRatio = getAspectRatio(data);

  return (
    <button
      type="button"
      className="unified-gallery-cell"
      onClick={() => onSelectMedia(index)}
      aria-label={`Open ${data.displayName || `media ${index + 1}`}`}
    >
      <div
        className={`unified-gallery-tile ${isSelected ? "is-selected" : ""} ${isActive ? "is-active" : ""}`}
        style={{ aspectRatio }}
      >
        <img
          src={`/thumbnails?hash=${data.file_hash}`}
          alt=""
          className="unified-gallery-image"
          loading="lazy"
          decoding="async"
          draggable={false}
        />
        {data.media_type === "video" && (
          <span className="unified-video-badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        )}
      </div>
    </button>
  );
});

const GalleryItemContent = ({ data, index, context }) => (
  <div data-gallery-index={index}>
    <GalleryItem data={data} index={index} context={context} />
  </div>
);

const UnifiedMediaBrowser = memo(function UnifiedMediaBrowser() {
  const { currentIndex, currentMediaFile } = useCurrentMedia();
  const { mediaFiles, navigate, selectMedia, setCurrentIndex, settings } =
    useMediaData();
  const { slideshowActive, slideshowSpeed, stopSlideshow } =
    useSlideshowState();
  const isGalleryView = settings.galleryView;
  const feedRef = useRef(null);
  const galleryRef = useRef(null);
  const scrollFrameRef = useRef(null);
  const galleryScrollFrameRef = useRef(null);
  const previousGalleryViewRef = useRef(null);
  const isProgrammaticScrollRef = useRef(false);
  const didUpdateIndexFromFeedRef = useRef(false);
  const [feedHeight, setFeedHeight] = useState(0);
  const [galleryWidth, setGalleryWidth] = useState(0);
  const columnCount = getColumnCount(galleryWidth);

  const { getPreloadedMedia } = useMediaPreloader(mediaFiles, currentIndex);

  const { startTime: slideshowStartTime } = useSlideshow({
    isActive: slideshowActive && !isGalleryView,
    speed: slideshowSpeed,
    currentMediaFile,
    navigate,
  });

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;

    const updateSize = () => {
      setFeedHeight(feed.clientHeight || window.innerHeight);
    };

    const observer = new ResizeObserver(updateSize);
    observer.observe(feed);
    updateSize();

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery) return;

    const observer = new ResizeObserver(([entry]) => {
      setGalleryWidth(entry.contentRect.width);
    });
    observer.observe(gallery);
    setGalleryWidth(gallery.clientWidth);

    return () => observer.disconnect();
  }, []);

  // useLayoutEffect so the scroll commits BEFORE the browser snapshots the new
  // state during a view transition — otherwise the morph lands at the wrong
  // position.
  useLayoutEffect(() => {
    if (isGalleryView || !feedRef.current || !feedHeight) return;

    if (didUpdateIndexFromFeedRef.current) {
      didUpdateIndexFromFeedRef.current = false;
      return;
    }

    const targetTop = currentIndex * feedHeight;
    if (Math.abs(feedRef.current.scrollTop - targetTop) < 2) return;

    const viewJustToggled = previousGalleryViewRef.current !== isGalleryView;
    isProgrammaticScrollRef.current = true;
    feedRef.current.scrollTo({
      top: targetTop,
      behavior: viewJustToggled ? "auto" : "smooth",
    });

    const timer = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 350);

    return () => clearTimeout(timer);
  }, [currentIndex, feedHeight, isGalleryView]);

  useLayoutEffect(() => {
    if (!isGalleryView || !galleryRef.current) return;
    // Only auto-scroll the selected tile into view when the user is entering
    // gallery view. Once they're in the gallery, their scroll position is
    // authoritative — clicking a visible tile shouldn't yank the scroller.
    if (previousGalleryViewRef.current === isGalleryView) return;

    const targetOffset = estimateGalleryOffset(
      mediaFiles,
      currentIndex,
      columnCount,
      galleryWidth,
    );

    let attempts = 0;
    const scrollSelectedIntoView = () => {
      attempts++;
      const scroller = galleryRef.current?.querySelector(
        ".unified-gallery-scroll",
      );
      const selected = galleryRef.current?.querySelector(
        `[data-gallery-index="${currentIndex}"]`,
      );

      if (selected) {
        selected.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: attempts === 1 ? "auto" : "smooth",
        });
        return;
      }

      if (scroller) {
        scroller.scrollTop = Math.min(
          targetOffset,
          Math.max(0, scroller.scrollHeight - scroller.clientHeight),
        );
      }

      if (attempts < 30) {
        galleryScrollFrameRef.current = requestAnimationFrame(
          scrollSelectedIntoView,
        );
      }
    };

    galleryScrollFrameRef.current = requestAnimationFrame(
      scrollSelectedIntoView,
    );

    return () => {
      if (galleryScrollFrameRef.current) {
        cancelAnimationFrame(galleryScrollFrameRef.current);
      }
    };
  }, [columnCount, currentIndex, galleryWidth, isGalleryView, mediaFiles]);

  useEffect(() => {
    previousGalleryViewRef.current = isGalleryView;
  }, [isGalleryView]);

  const handleFeedScroll = useCallback(() => {
    if (isGalleryView || !feedRef.current || !feedHeight) return;
    if (scrollFrameRef.current) return;

    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      if (isProgrammaticScrollRef.current || !feedRef.current) return;

      const nextIndex = Math.round(feedRef.current.scrollTop / feedHeight);
      const boundedIndex = Math.max(
        0,
        Math.min(nextIndex, mediaFiles.length - 1),
      );

      if (boundedIndex !== currentIndex) {
        didUpdateIndexFromFeedRef.current = true;
        setCurrentIndex(boundedIndex);
      }
    });
  }, [
    currentIndex,
    feedHeight,
    isGalleryView,
    mediaFiles.length,
    setCurrentIndex,
  ]);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current);
      if (galleryScrollFrameRef.current)
        cancelAnimationFrame(galleryScrollFrameRef.current);
    };
  }, []);

  const visibleRange = useMemo(() => {
    if (mediaFiles.length === 0) return { start: 0, end: 0 };
    return {
      start: Math.max(0, currentIndex - 2),
      end: Math.min(mediaFiles.length, currentIndex + 3),
    };
  }, [currentIndex, mediaFiles.length]);

  const currentIndexStoreRef = useRef(null);
  if (currentIndexStoreRef.current === null) {
    currentIndexStoreRef.current = createCurrentIndexStore(currentIndex);
  }
  useEffect(() => {
    currentIndexStoreRef.current.setValue(currentIndex);
  }, [currentIndex]);

  const masonryContext = useMemo(
    () => ({
      currentIndexStore: currentIndexStoreRef.current,
      onSelectMedia: selectMedia,
      isGalleryView,
    }),
    [isGalleryView, selectMedia],
  );

  const initialItemCount = Math.min(
    mediaFiles.length,
    Math.max(80, currentIndex + columnCount * 12),
  );

  return (
    <div className="unified-media-browser">
      <div
        className="unified-feed-layer"
        style={{
          opacity: isGalleryView ? 0 : 1,
          pointerEvents: isGalleryView ? "none" : "auto",
        }}
      >
        <div
          ref={feedRef}
          className="unified-feed-scroll"
          onScroll={handleFeedScroll}
        >
          {mediaFiles.map((mediaFile, actualIndex) => {
            const itemHeight = feedHeight || window.innerHeight;
            const shouldRenderMedia =
              actualIndex >= visibleRange.start &&
              actualIndex < visibleRange.end;
            const isActive = !isGalleryView && actualIndex === currentIndex;

            return (
              <section
                key={mediaFile.file_hash}
                className={`unified-feed-item ${isActive ? "is-active" : ""}`}
                data-feed-index={actualIndex}
                style={{ height: `${itemHeight}px` }}
              >
                {shouldRenderMedia && (
                  <div className="unified-feed-card">
                    <MediaItem
                      mediaFile={mediaFile}
                      index={actualIndex}
                      isActive={isActive}
                      getPreloadedMedia={getPreloadedMedia}
                      slideshowStartTime={
                        actualIndex === currentIndex ? slideshowStartTime : 0
                      }
                      isSlideshow={slideshowActive}
                    />
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      <div
        ref={galleryRef}
        className="unified-gallery-layer"
        style={{
          opacity: isGalleryView ? 1 : 0,
          pointerEvents: isGalleryView ? "auto" : "none",
        }}
      >
        <VirtuosoMasonry
          className="unified-gallery-scroll"
          data={mediaFiles}
          columnCount={columnCount}
          context={masonryContext}
          initialItemCount={initialItemCount}
          ItemContent={GalleryItemContent}
        />
      </div>

      {slideshowActive && !isGalleryView && (
        <SlideshowOverlay onExit={stopSlideshow} />
      )}
    </div>
  );
});

export default UnifiedMediaBrowser;
