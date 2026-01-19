import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { isMobile } from "../utils/helpers";

// Natural easing curves for human-like motion
const slideVariants = {
  // Gallery view animations - slides in from top
  galleryEnter: {
    y: "-100%",
    opacity: 0.8,
  },
  galleryCenter: {
    y: "0%",
    opacity: 1,
  },
  galleryExit: {
    y: "-100%",
    opacity: 0.0,
  },
  // Media viewer animations - slides in from bottom
  mediaEnter: {
    y: "100%",
    opacity: 0.8,
  },
  mediaCenter: {
    y: "0%",
    opacity: 1,
  },
  mediaExit: {
    y: "100%",
    opacity: 0.8,
  },
  // Settings animations - slides up from bottom (mobile)
  settingsEnter: {
    y: "100%",
    opacity: 0.8,
  },
  settingsCenter: {
    y: "0%",
    opacity: 1,
  },
  settingsExit: {
    y: "100%",
    opacity: 0.8,
  },
  // Settings animations - slides in from right (desktop)
  settingsEnterDesktop: {
    x: "100%",
    opacity: 0.8,
  },
  settingsCenterDesktop: {
    x: "0%",
    opacity: 1,
  },
  settingsExitDesktop: {
    x: "100%",
    opacity: 0.8,
  },
};

// Smooth, natural spring transition - feels more human
const springTransition = {
  type: "spring",
  stiffness: 300,
  damping: 32,
  mass: 0.7,
  restDelta: 0.001,
  restSpeed: 0.001,
};

function ViewTransition({ isGalleryView, isSettingsOpen, children }) {
  // Handle settings mode (single child)
  if (isSettingsOpen !== undefined) {
    const isDesktop = !isMobile();

    // On desktop, always render (SettingsPanel handles its own animation and visibility)
    if (isDesktop) {
      return <>{children}</>;
    }

    // On mobile, use full-screen slide animation
    return (
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            className="fixed inset-0 z-50"
            initial="settingsEnter"
            animate="settingsCenter"
            exit="settingsExit"
            variants={slideVariants}
            transition={springTransition}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Handle gallery/media mode (two children)
  const [galleryView, mediaViewer] = React.Children.toArray(children);

  // Add slight delay for more natural feel when switching views
  const getTransition = React.useCallback(
    (isEntering) => ({
      ...springTransition,
      delay: isEntering ? 0.02 : 0, // Tiny delay for entering view
    }),
    [],
  );

  return (
    <div className="view-transition-container relative w-full h-full overflow-hidden">
      {/* Gallery View */}
      <motion.div
        key="gallery"
        className="absolute inset-0 w-full h-full"
        initial={false}
        animate={isGalleryView ? "galleryCenter" : "galleryExit"}
        variants={slideVariants}
        transition={getTransition(isGalleryView)}
        style={{
          pointerEvents: isGalleryView ? "auto" : "none",
          zIndex: isGalleryView ? 2 : 1,
        }}
      >
        {galleryView}
      </motion.div>

      {/* Media Viewer */}
      <motion.div
        key="media"
        className="absolute inset-0 w-full h-full"
        initial={false}
        animate={!isGalleryView ? "mediaCenter" : "mediaExit"}
        variants={slideVariants}
        transition={getTransition(!isGalleryView)}
        style={{
          pointerEvents: !isGalleryView ? "auto" : "none",
          zIndex: !isGalleryView ? 2 : 1,
        }}
      >
        {mediaViewer}
      </motion.div>
    </div>
  );
}

export default ViewTransition;
