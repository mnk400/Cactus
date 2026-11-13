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
import { useMediaPreloader } from "../hooks/useMediaPreloader";
import { useCurrentMedia, useMediaData } from "../context/MediaContext";

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

const estimateGalleryOffset = (
  mediaFiles,
  index,
  columnCount,
  galleryWidth,
) => {
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

// Fill the stage when that crops under 8% of the item; otherwise show all of
// it. Written straight to the DOM (classes on each item) so a resize does not
// re-render the feed.
const applyFit = (feed) => {
  const stage = feed.clientWidth / feed.clientHeight;
  feed.querySelectorAll("[data-ar]").forEach((item) => {
    const ar = Number(item.dataset.ar);
    item.classList.toggle(
      "fills",
      Math.min(ar, stage) / Math.max(ar, stage) > 0.92,
    );
  });
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
      className={`block w-full cursor-pointer rounded-[12px] border-0 bg-transparent p-1 text-left text-inherit outline-offset-[-2px] ${
        isSelected ? "outline outline-2 outline-white/90" : ""
      }`}
      onClick={() => onSelectMedia(index)}
      aria-label={`Open ${data.displayName || `media ${index + 1}`}`}
    >
      <div
        className="relative w-full overflow-hidden rounded-lg bg-white/[0.04]"
        style={{
          aspectRatio,
          viewTransitionName: isActive ? "media-active" : undefined,
        }}
      >
        <img
          src={`/thumbnails?hash=${data.file_hash}`}
          alt=""
          className="block h-full w-full object-cover pointer-events-none"
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />
        {data.media_type === "video" && (
          <span
            className="absolute right-1.5 bottom-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white pointer-events-none"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-[15px] w-[15px]"
            >
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
  const { currentIndex } = useCurrentMedia();
  const {
    mediaFiles,
    selectMedia,
    setCurrentIndex,
    settings,
    galleryScrollFnRef,
  } = useMediaData();
  const isGalleryView = settings.galleryView;
  const feedRef = useRef(null);
  const galleryRef = useRef(null);
  const scrollFrameRef = useRef(null);
  const galleryScrollFrameRef = useRef(null);
  const previousGalleryViewRef = useRef(null);
  const isProgrammaticScrollRef = useRef(false);
  const didUpdateIndexFromFeedRef = useRef(false);
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const [galleryWidth, setGalleryWidth] = useState(0);
  const columnCount = getColumnCount(galleryWidth);

  const { getPreloadedMedia } = useMediaPreloader(mediaFiles, currentIndex);

  // Scroll the gallery so `index`'s tile is mounted and centered, resolving
  // once it's in place. Registered on a context ref so the gallery-open view
  // transition can pre-mount its morph target before snapshotting. Uses the
  // aspect-ratio estimate (not scrollHeight, which is unreliable for
  // not-yet-rendered rows) to reach far tiles.
  const scrollGalleryToIndex = useCallback(
    (index) =>
      new Promise((resolve) => {
        const gallery = galleryRef.current;
        if (!gallery) {
          resolve();
          return;
        }
        const targetOffset = estimateGalleryOffset(
          mediaFiles,
          index,
          columnCount,
          galleryWidth,
        );
        let attempts = 0;
        const run = () => {
          attempts += 1;
          const scroller = gallery.querySelector(".unified-gallery-scroll");
          const selected = gallery.querySelector(
            `[data-gallery-index="${index}"]`,
          );
          if (selected) {
            selected.scrollIntoView({
              block: "center",
              inline: "nearest",
              behavior: "auto",
            });
            requestAnimationFrame(() => resolve());
            return;
          }
          if (scroller) {
            scroller.scrollTop = Math.min(
              targetOffset,
              Math.max(0, scroller.scrollHeight - scroller.clientHeight),
            );
          }
          if (attempts < 12) requestAnimationFrame(run);
          else resolve();
        };
        requestAnimationFrame(run);
      }),
    [mediaFiles, columnCount, galleryWidth],
  );

  useEffect(() => {
    if (!galleryScrollFnRef) return;
    galleryScrollFnRef.current = scrollGalleryToIndex;
    return () => {
      galleryScrollFnRef.current = null;
    };
  }, [galleryScrollFnRef, scrollGalleryToIndex]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;

    // Feed items are sized in CSS (100% of the stage). When the stage
    // changes shape (fold, rotate, sheet moving) we put the current item back
    // in place and redo the fit, before the browser paints.
    const sync = () => {
      if (!feed.clientHeight) return;
      feed.scrollTop = currentIndexRef.current * feed.clientHeight;
      applyFit(feed);
    };

    const observer = new ResizeObserver(sync);
    observer.observe(feed);

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
    const feedHeight = feedRef.current?.clientHeight;
    if (isGalleryView || !feedHeight) return;

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
  }, [currentIndex, isGalleryView]);

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

  // Newly mounted items need their fit too.
  useLayoutEffect(() => {
    if (feedRef.current?.clientHeight) applyFit(feedRef.current);
  }, [currentIndex, mediaFiles]);

  const handleFeedScroll = useCallback(() => {
    if (isGalleryView || scrollFrameRef.current) return;

    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const feedHeight = feedRef.current?.clientHeight;
      if (isProgrammaticScrollRef.current || !feedHeight) return;

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
  }, [currentIndex, isGalleryView, mediaFiles.length, setCurrentIndex]);

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

  // Keep this small regardless of currentIndex — Virtuoso renders all
  // `initialItemCount` items eagerly (no virtualization), so scaling with
  // currentIndex causes thousands of <img> tags to mount on deep links. The
  // scroll-into-view effect below already handles landing on far-off items
  // by setting scrollTop and retrying until Virtuoso mounts the target.
  const initialItemCount = Math.min(mediaFiles.length, columnCount * 12);

  return (
    <div className="relative h-full w-full overflow-hidden isolate">
      <div
        className="absolute inset-0 z-[1]"
        style={{
          opacity: isGalleryView ? 0 : 1,
          pointerEvents: isGalleryView ? "none" : "auto",
        }}
      >
        <div
          ref={feedRef}
          className="h-full w-full overflow-y-auto overflow-x-hidden overscroll-contain snap-y snap-mandatory scrollbar-hide [-webkit-overflow-scrolling:touch]"
          onScroll={handleFeedScroll}
        >
          {mediaFiles.map((mediaFile, actualIndex) => {
            const shouldRenderMedia =
              actualIndex >= visibleRange.start &&
              actualIndex < visibleRange.end;
            const isActive = !isGalleryView && actualIndex === currentIndex;

            return (
              <section
                key={mediaFile.file_hash}
                // `scroll-snap-stop: always` guarantees the scroller lands on
                // exactly one item, so Math.round(scrollTop / feedHeight) is
                // always a valid index.
                className={`unified-feed-item h-full w-full snap-start [scroll-snap-stop:always] ${
                  isActive ? "is-active" : ""
                }`}
                data-feed-index={actualIndex}
              >
                {shouldRenderMedia && (
                  <div className="unified-feed-card relative h-full w-full overflow-hidden">
                    <MediaItem
                      mediaFile={mediaFile}
                      index={actualIndex}
                      isActive={isActive}
                      getPreloadedMedia={getPreloadedMedia}
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
        className="absolute inset-0 z-[2] bg-black"
        style={{
          opacity: isGalleryView ? 1 : 0,
          pointerEvents: isGalleryView ? "auto" : "none",
        }}
      >
        <VirtuosoMasonry
          // `unified-gallery-scroll` is a JS query hook for scroll restoration.
          // Room below the last row for the dock goes on the columns, not the
          // scroller: the masonry sizes its visible window from the scroller's
          // content box, so scroller padding hides tiles near the edges.
          className="unified-gallery-scroll h-full w-full overflow-y-auto overflow-x-hidden px-3.5 scrollbar-hide [-webkit-overflow-scrolling:touch] [&>[data-testid=virtuoso-list]]:mb-24"
          data={mediaFiles}
          columnCount={columnCount}
          context={masonryContext}
          initialItemCount={initialItemCount}
          ItemContent={GalleryItemContent}
        />
      </div>
    </div>
  );
});

export default UnifiedMediaBrowser;
