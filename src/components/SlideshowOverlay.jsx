import { useState, useEffect, useRef, useCallback, memo } from "react";
import { isMobile } from "../utils/helpers";

const SlideshowOverlay = memo(function SlideshowOverlay({ onExit }) {
  const [showControls, setShowControls] = useState(true);
  const hideTimerRef = useRef(null);
  const mobile = isMobile();

  const resetHideTimer = useCallback(() => {
    if (mobile) return; // Always show on mobile
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2000);
  }, [mobile]);

  // Start the auto-hide timer on mount (desktop only)
  useEffect(() => {
    if (mobile) return;
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [resetHideTimer, mobile]);

  // Show controls on mouse movement (desktop only)
  useEffect(() => {
    if (mobile) return;
    const handleInteraction = () => resetHideTimer();
    document.addEventListener("mousemove", handleInteraction);
    return () => {
      document.removeEventListener("mousemove", handleInteraction);
    };
  }, [resetHideTimer, mobile]);

  // Exit slideshow on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onExit]);

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      <button
        onClick={onExit}
        className={`absolute top-4 right-4 z-50 pointer-events-auto px-3 py-1 bg-black-shades-500 text-white rounded-lg hover:bg-black-shades-600 transition-all duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
        aria-label="Exit slideshow"
      >
        Close
      </button>
    </div>
  );
});

export default SlideshowOverlay;
