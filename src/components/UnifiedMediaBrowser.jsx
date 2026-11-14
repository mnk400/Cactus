import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { flushSync } from "react-dom";
import MediaItem from "./MediaItem";
import Gallery, { TILE_RADIUS } from "./Gallery";
import { useMediaPreloader } from "../hooks/useMediaPreloader";
import { useCurrentMedia, useMediaData } from "../context/MediaContext";

const ZOOM_STIFFNESS = 340; // critically damped, settles in about 0.4s
const GRID_GROW = 0.06; // the grid starts this much larger as it zooms out

const lerp = (from, to, t) => from + (to - from) * t;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Fill the item's box (the stage, less the card's margin) when that crops
// under 8% of the item; otherwise show all of it. Written straight to the DOM
// (classes on each item) so a resize does not re-render the feed.
const applyFit = (feed) => {
  feed.querySelectorAll("[data-ar]").forEach((item) => {
    if (!item.clientHeight) return;
    const stage = item.clientWidth / item.clientHeight;
    const ar = Number(item.dataset.ar);
    item.classList.toggle(
      "fills",
      Math.min(ar, stage) / Math.max(ar, stage) > 0.92,
    );
  });
};

const UnifiedMediaBrowser = memo(function UnifiedMediaBrowser() {
  const { currentIndex } = useCurrentMedia();
  const { mediaFiles, selectMedia, setCurrentIndex, settings } = useMediaData();
  const isGalleryView = settings.galleryView;
  const rootRef = useRef(null);
  const feedLayerRef = useRef(null);
  const galleryLayerRef = useRef(null);
  const flyerRef = useRef(null);
  const galleryRef = useRef(null);
  const feedRef = useRef(null);
  const zoomRef = useRef(null);
  const scrollFrameRef = useRef(null);
  // The view the screen shows (or is zooming to): galleryView as of the
  // last commit, until the zoom trigger below catches up.
  const shownViewRef = useRef(isGalleryView);
  const isProgrammaticScrollRef = useRef(false);
  const didUpdateIndexFromFeedRef = useRef(false);
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const filesRef = useRef(mediaFiles);
  filesRef.current = mediaFiles;

  const { getPreloadedMedia } = useMediaPreloader(mediaFiles, currentIndex);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;

    // Feed items are sized in CSS (100% of the stage). When the stage
    // changes shape (fold, rotate) we put the current item back in place and
    // redo the fit, before the browser paints.
    const sync = () => {
      if (!feed.clientHeight) return;
      feed.scrollTop = currentIndexRef.current * feed.clientHeight;
      applyFit(feed);
    };

    const observer = new ResizeObserver(sync);
    observer.observe(feed);

    return () => observer.disconnect();
  }, []);

  // A layout effect, so the feed is on the new item before the zoom below
  // measures where that item sits.
  useLayoutEffect(() => {
    const feedHeight = feedRef.current?.clientHeight;
    if (isGalleryView || !feedHeight) return;

    if (didUpdateIndexFromFeedRef.current) {
      didUpdateIndexFromFeedRef.current = false;
      return;
    }

    const targetTop = currentIndex * feedHeight;
    if (Math.abs(feedRef.current.scrollTop - targetTop) < 2) return;

    const viewJustToggled = shownViewRef.current !== isGalleryView;
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

  // Newly mounted items need their fit too.
  useLayoutEffect(() => {
    if (feedRef.current?.clientHeight) applyFit(feedRef.current);
  }, [currentIndex, mediaFiles]);

  // The zoom between feed and gallery. One photo (the flyer) travels
  // between the item's place in the feed and its tile, while the feed fades
  // and the grid settles in around it. One progress value p (0 = feed,
  // 1 = gallery) is carried by a spring and written straight to the DOM.
  // Reversing mid-way just turns the spring around.
  //
  // Nothing about the two ends is remembered: every frame reads both from
  // their sources (the feed canvas as laid out, the tile from the gallery's
  // layout), in the stage's coordinates. So a resize, a scroll or a late
  // video size mid-zoom is simply followed. A zoom belongs to one item in
  // one list; if either changes, the zoom ends where it was heading.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const feedLayer = feedLayerRef.current;
    const galleryLayer = galleryLayerRef.current;
    const flyer = flyerRef.current;
    const [flyerImg, flyerFrame] = flyer.children;
    const at = +isGalleryView;
    // shot: which item is zooming, its feed canvas (hidden while the flyer
    // stands in for it) and that canvas's corner radius.
    const s = { p: at, v: 0, target: at, raf: 0, last: 0, shot: null };

    // The feed end: the picture as shown, relative to the stage.
    const feedRect = (canvas) => {
      const box = root.getBoundingClientRect();
      if (!canvas?.isConnected) {
        return { left: 0, top: 0, width: box.width, height: box.height };
      }
      const r = canvas.getBoundingClientRect();
      return {
        left: r.left - box.left,
        top: r.top - box.top,
        width: r.width,
        height: r.height,
      };
    };

    const paint = () => {
      const { p, shot } = s;
      if (!shot) {
        feedLayer.style.opacity = clamp01(1 - p);
        galleryLayer.style.opacity = clamp01(p);
        galleryLayer.style.transform = "";
        galleryLayer.style.willChange = "";
        flyer.style.display = "none";
        return;
      }
      // Read everything first, then write.
      const a = feedRect(shot.canvas);
      const b = { ...(galleryRef.current?.rectOf(shot.index) ?? a) };
      // A tile far out of view travels from just past the edge, so the
      // photo is on screen for the whole zoom instead of arriving at the end.
      b.top = Math.max(-b.height, Math.min(root.clientHeight, b.top));
      shot.travel = Math.max(
        1,
        Math.abs(a.left - b.left),
        Math.abs(a.top - b.top),
        Math.abs(a.width - b.width),
        Math.abs(a.height - b.height),
      );
      feedLayer.style.opacity = clamp01(1 - p);
      galleryLayer.style.opacity = clamp01(p);
      galleryLayer.style.willChange = "transform, opacity";
      galleryLayer.style.transformOrigin = `${b.left + b.width / 2}px ${b.top + b.height / 2}px`;
      galleryLayer.style.transform = `scale(${1 + GRID_GROW * (1 - p)})`;
      flyer.style.display = "block";
      flyer.style.width = `${lerp(a.width, b.width, p)}px`;
      flyer.style.height = `${lerp(a.height, b.height, p)}px`;
      flyer.style.transform = `translate(${lerp(a.left, b.left, p)}px, ${lerp(a.top, b.top, p)}px)`;
      flyer.style.borderRadius = `${lerp(shot.radius, TILE_RADIUS, clamp01(p))}px`;
    };

    // What the flyer shows: the thumbnail at once; over it the full photo
    // when it is ready, or the video's current frame.
    const dress = (file, canvas) => {
      flyer.style.backgroundImage = `url(/thumbnails?hash=${file.file_hash})`;
      const img = canvas?.querySelector("img");
      flyerImg.onload = () => (flyerImg.style.opacity = "1");
      if (img?.src) {
        flyerImg.style.opacity = img.complete && img.naturalWidth ? "1" : "0";
        flyerImg.src = img.currentSrc || img.src;
      } else {
        flyerImg.style.opacity = "0";
        flyerImg.removeAttribute("src");
      }
      const video = canvas?.querySelector("video");
      flyerFrame.style.display = "none";
      if (video?.readyState >= 2 && video.videoWidth) {
        const scale = Math.min(1, 1280 / video.videoWidth);
        flyerFrame.width = Math.round(video.videoWidth * scale);
        flyerFrame.height = Math.round(video.videoHeight * scale);
        try {
          flyerFrame
            .getContext("2d")
            .drawImage(video, 0, 0, flyerFrame.width, flyerFrame.height);
          flyerFrame.style.display = "block";
        } catch {
          // A frame we cannot read: the thumbnail stands in.
        }
      }
    };

    const begin = (index, target) => {
      const file = filesRef.current[index];
      if (!file) return null;
      if (target === 1) galleryRef.current?.reveal(index);
      const canvas = root.querySelector(
        `[data-feed-index="${index}"] .media-canvas`,
      );
      // Read once: the corners do not change during a zoom.
      const radius = canvas
        ? parseFloat(getComputedStyle(canvas).borderTopLeftRadius) || 0
        : 0;
      dress(file, canvas);
      if (canvas) canvas.style.visibility = "hidden";
      galleryRef.current?.setHidden(index);
      return { index, files: filesRef.current, canvas, radius };
    };

    // From a frame callback the un-hide must commit in this frame, with the
    // flyer's removal; inside React's commit (an effect) a plain update does.
    const settle = ({ fromFrame }) => {
      const { shot } = s;
      s.shot = null;
      if (fromFrame) flushSync(() => galleryRef.current?.setHidden(null));
      else galleryRef.current?.setHidden(null);
      if (shot?.canvas) shot.canvas.style.visibility = "";
      paint();
    };

    const finish = () => {
      cancelAnimationFrame(s.raf);
      Object.assign(s, { p: s.target, v: 0, raf: 0 });
      settle({ fromFrame: false });
    };

    const tick = (now) => {
      const dt = s.last
        ? Math.min(0.032, Math.max(0, (now - s.last) / 1000))
        : 0.016;
      s.last = now;
      const k = ZOOM_STIFFNESS;
      s.v += (-k * (s.p - s.target) - 2 * Math.sqrt(k) * s.v) * dt;
      s.p += s.v * dt;
      // Settled within half a pixel of the end, however far the photo goes.
      const travel = s.shot?.travel ?? 1;
      const settled =
        Math.abs(s.p - s.target) * travel < 0.5 && Math.abs(s.v) * travel < 10;
      if (settled) {
        Object.assign(s, { p: s.target, v: 0, raf: 0 });
        settle({ fromFrame: true });
        return;
      }
      paint();
      s.raf = requestAnimationFrame(tick);
    };

    zoomRef.current = {
      to(target, index) {
        s.target = target;
        if (!s.shot) {
          if (s.p === target) return;
          const reduceMotion = matchMedia(
            "(prefers-reduced-motion: reduce)",
          ).matches;
          if (!reduceMotion) s.shot = begin(index, target);
          if (!s.shot) {
            s.p = target;
            paint();
            return;
          }
        }
        paint();
        if (!s.raf) {
          s.last = 0;
          s.raf = requestAnimationFrame(tick);
        }
      },
      // The item or the list changed under a zoom: end it now.
      check(index, files) {
        if (s.shot && (s.shot.index !== index || s.shot.files !== files)) {
          finish();
        }
      },
    };

    paint();
    return () => cancelAnimationFrame(s.raf);
    // Built once; reads everything that changes through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Before the trigger below, so a zoom for another item ends first.
  useLayoutEffect(() => {
    zoomRef.current.check(currentIndex, mediaFiles);
  }, [currentIndex, mediaFiles]);

  useLayoutEffect(() => {
    if (shownViewRef.current === isGalleryView) return;
    shownViewRef.current = isGalleryView;
    zoomRef.current.to(isGalleryView ? 1 : 0, currentIndexRef.current);
  }, [isGalleryView]);

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
    };
  }, []);

  const visibleRange = useMemo(() => {
    if (mediaFiles.length === 0) return { start: 0, end: 0 };
    return {
      start: Math.max(0, currentIndex - 2),
      end: Math.min(mediaFiles.length, currentIndex + 3),
    };
  }, [currentIndex, mediaFiles.length]);

  return (
    <div
      ref={rootRef}
      className="relative h-full w-full overflow-x-clip isolate"
    >
      <div
        ref={feedLayerRef}
        className="absolute inset-0 z-[1]"
        inert={isGalleryView ? "" : undefined}
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

      {/* Over the ambient blur, like the feed: the grid has no backdrop. */}
      <div
        ref={galleryLayerRef}
        className="absolute inset-0 z-[2]"
        inert={isGalleryView ? undefined : ""}
      >
        <Gallery
          ref={galleryRef}
          files={mediaFiles}
          currentIndex={currentIndex}
          onSelect={selectMedia}
        />
      </div>

      <div ref={flyerRef} className="zoom-flyer z-[3]" aria-hidden="true">
        <img alt="" draggable={false} />
        <canvas />
      </div>
    </div>
  );
});

export default UnifiedMediaBrowser;
