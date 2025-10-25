import { useState, useEffect, useCallback } from "react";

/**
 * Custom hook for managing video playback settings
 */
export const useVideoSettings = () => {
  const [isMuted, setIsMuted] = useState(() => {
    // Check localStorage for user preference, default to muted initially
    const saved = localStorage.getItem("cactus-video-muted");
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [hasUserInteracted, setHasUserInteracted] = useState(() => {
    // Track if user has ever interacted with audio controls
    const interacted = localStorage.getItem("cactus-user-audio-interaction");
    return interacted === "true";
  });

  // Save mute preference to localStorage
  useEffect(() => {
    localStorage.setItem("cactus-video-muted", JSON.stringify(isMuted));
  }, [isMuted]);

  // Save interaction state to localStorage
  useEffect(() => {
    if (hasUserInteracted) {
      localStorage.setItem("cactus-user-audio-interaction", "true");
    }
  }, [hasUserInteracted]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
    setHasUserInteracted(true);
  }, []);

  const setMuted = useCallback((muted) => {
    setIsMuted(muted);
    setHasUserInteracted(true);
  }, []);

  return {
    isMuted,
    hasUserInteracted,
    toggleMute,
    setMuted,
  };
};
