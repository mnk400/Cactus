import React, {
  useEffect,
  useRef,
  useMemo,
  useState,
  useCallback,
} from "react";
import { motion } from "framer-motion";
import MediaItem from "./MediaItem";
import { useMediaPreloader } from "../hooks/useMediaPreloader";
import { useMedia } from "../context/MediaContext";

function MediaViewer({ showTagInput }) {
  const { mediaFiles, currentIndex, navigate } = useMedia();
  const containerRef = useRef(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [dragConstraints, setDragConstraints] = useState({ top: 0, bottom: 0 });

  const { getPreloadedMedia } = useMediaPreloader(mediaFiles, currentIndex);

  // Track container height
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const height = containerRef.current.clientHeight;
        setContainerHeight(height);

        // Set drag constraints based on content
        const totalHeight = mediaFiles.length * height;
        setDragConstraints({
          top: -(totalHeight - height),
          bottom: 0,
        });
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [mediaFiles.length]);

  // Virtual scrolling - minimal buffer for performance
  const visibleRange = useMemo(() => {
    if (mediaFiles.length === 0) {
      return { start: 0, end: 0 };
    }

    // Only render current item and immediate neighbors
    const start = Math.max(0, currentIndex - 1);
    const end = Math.min(mediaFiles.length, currentIndex + 2);

    return { start, end };
  }, [currentIndex, mediaFiles.length]);

  // Memoized pan handler
  const handlePanEnd = useCallback(
    (event, info) => {
      if (showTagInput) return;

      const { offset } = info;
      const distanceThreshold = 20;

      let direction = 0;

      // If over a certain distance, then navigate
      if (Math.abs(offset.y) > distanceThreshold) {
        direction = offset.y > 0 ? -1 : 1;
      }

      if (direction !== 0) {
        const targetIndex = Math.max(
          0,
          Math.min(currentIndex + direction, mediaFiles.length - 1),
        );
        if (targetIndex !== currentIndex) {
          navigate(direction);
        }
      }
    },
    [
      showTagInput,
      currentIndex,
      mediaFiles.length,
      navigate,
    ],
  );

  // Memoized wheel handler
  const handleWheel = useCallback(
    (event) => {
      if (showTagInput) return;

      const delta = event.deltaY;
      if (Math.abs(delta) > 50) {
        event.preventDefault();
        const direction = delta > 0 ? 1 : -1;
        const targetIndex = Math.max(
          0,
          Math.min(currentIndex + direction, mediaFiles.length - 1),
        );
        if (targetIndex !== currentIndex) {
          navigate(direction);
        }
      }
    },
    [showTagInput, currentIndex, mediaFiles.length, navigate],
  );

  // Add wheel event listener for desktop
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  return (
    <div
      ref={containerRef}
      className="media-wrapper h-full w-full overflow-hidden relative"
      style={{
        touchAction: "pan-y",
        userSelect: "none",
      }}
    >
      <motion.div
        drag="y"
        dragConstraints={dragConstraints}
        dragElastic={0.1}
        dragMomentum={false}
        onPanEnd={handlePanEnd}
        animate={{
          y: -currentIndex * (containerHeight || window.innerHeight),
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
          mass: 0.8,
        }}
        style={{
          height: `${mediaFiles.length * (containerHeight || window.innerHeight)}px`,
          position: "relative",
        }}
      >
        {/* Only render visible items */}
        {mediaFiles
          .slice(visibleRange.start, visibleRange.end)
          .map((mediaFile, virtualIndex) => {
            const actualIndex = visibleRange.start + virtualIndex;
            return (
              <motion.div
                key={`media-${actualIndex}`}
                className="media-item-container absolute w-full"
                style={{
                  height: `${containerHeight || window.innerHeight}px`,
                  top: `${actualIndex * (containerHeight || window.innerHeight)}px`,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <MediaItem
                  mediaFile={mediaFile}
                  index={actualIndex}
                  isActive={actualIndex === currentIndex}
                  getPreloadedMedia={getPreloadedMedia}
                />
              </motion.div>
            );
          })}
      </motion.div>
    </div>
  );
}

export default MediaViewer;
