import { useEffect, useRef, useCallback, useState } from "react";

// Timing presets in milliseconds
const SPEED_PRESETS = {
  slow: { image: 8000, maxVideo: 15000 },
  normal: { image: 5000, maxVideo: 10000 },
  fast: { image: 3000, maxVideo: 6000 },
};

// Videos longer than this get a start offset (skip intros)
const LONG_VIDEO_THRESHOLD = 30;
// Start percentage into long videos
const LONG_VIDEO_START_PERCENT = 0.1;

/**
 * Computes the start time and display duration for a media item in slideshow mode.
 */
export function computeSlideshowTiming(mediaFile, speed = "normal") {
  const preset = SPEED_PRESETS[speed] || SPEED_PRESETS.normal;

  if (mediaFile.media_type === "image") {
    return { startTime: 0, duration: preset.image };
  }

  // Video timing
  const videoDuration = mediaFile.duration || 0;

  // Short or unknown duration videos: play from start for max duration
  if (!videoDuration || videoDuration <= preset.maxVideo / 1000) {
    return {
      startTime: 0,
      duration: Math.min(
        videoDuration * 1000 || preset.maxVideo,
        preset.maxVideo,
      ),
    };
  }

  // Medium videos (under LONG_VIDEO_THRESHOLD): play from start, cap at maxVideo
  if (videoDuration <= LONG_VIDEO_THRESHOLD) {
    return { startTime: 0, duration: preset.maxVideo };
  }

  // Long videos: start slightly in to skip intros
  const startTime = Math.floor(videoDuration * LONG_VIDEO_START_PERCENT);
  return { startTime, duration: preset.maxVideo };
}

/**
 * Hook that drives slideshow auto-advancement.
 *
 * @param {Object} options
 * @param {boolean} options.isActive - Whether slideshow is currently running
 * @param {string} options.speed - "slow" | "normal" | "fast"
 * @param {Object|null} options.currentMediaFile - Current media file object
 * @param {Function} options.navigate - navigate(direction) from MediaContext
 * @returns {{ startTime: number }} - Video start time for the current item
 */
export function useSlideshow({ isActive, speed, currentMediaFile, navigate }) {
  const timerRef = useRef(null);
  const [startTime, setStartTime] = useState(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Main slideshow timer
  useEffect(() => {
    if (!isActive || !currentMediaFile) {
      clearTimer();
      return;
    }

    const { startTime: computedStart, duration } = computeSlideshowTiming(
      currentMediaFile,
      speed,
    );
    setStartTime(computedStart);

    timerRef.current = setTimeout(() => {
      navigate(1);
    }, duration);

    return clearTimer;
  }, [isActive, currentMediaFile, speed, navigate, clearTimer]);

  // Pause on tab visibility change
  useEffect(() => {
    if (!isActive) return;

    const handleVisibility = () => {
      if (document.hidden) {
        clearTimer();
      }
      // When tab becomes visible again, the effect above will re-run
      // because we don't need to do anything special - the timer is
      // managed by the main effect which depends on currentMediaFile
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [isActive, clearTimer]);

  return { startTime: isActive ? startTime : 0 };
}
