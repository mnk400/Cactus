import React, { useState, useEffect, useRef, useCallback } from "react";
import { useVideoElement } from "../context/MediaContext";

// Touch must drag at least this many pixels before engaging seek — prevents
// stray taps near the nav from jumping playback position.
const TOUCH_SEEK_THRESHOLD_PX = 4;

function VideoProgressBar() {
  const { videoElement } = useVideoElement();
  const [duration, setDuration] = useState(0);
  const [isActive, setIsActive] = useState(false);

  const trackRef = useRef(null);
  const fillRef = useRef(null);
  const rafRef = useRef(null);
  const gestureRef = useRef(null);

  // RAF loop drives the fill width directly off the DOM ref so we avoid
  // re-rendering on every frame.
  useEffect(() => {
    if (!videoElement) return;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      if (fillRef.current && !gestureRef.current?.seekArmed) {
        const d = videoElement.duration;
        const t = videoElement.currentTime;
        const pct = d ? Math.min(100, Math.max(0, (t / d) * 100)) : 0;
        fillRef.current.style.width = `${pct}%`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [videoElement]);

  useEffect(() => {
    if (!videoElement) {
      setDuration(0);
      return;
    }
    const syncDuration = () => setDuration(videoElement.duration || 0);
    const reset = () => {
      if (fillRef.current) fillRef.current.style.width = "0%";
      setDuration(0);
    };
    syncDuration();
    videoElement.addEventListener("loadedmetadata", syncDuration);
    videoElement.addEventListener("durationchange", syncDuration);
    videoElement.addEventListener("loadstart", reset);
    return () => {
      videoElement.removeEventListener("loadedmetadata", syncDuration);
      videoElement.removeEventListener("durationchange", syncDuration);
      videoElement.removeEventListener("loadstart", reset);
    };
  }, [videoElement]);

  const seekToClientX = useCallback(
    (clientX) => {
      const video = videoElement;
      const track = trackRef.current;
      if (!video?.duration || !track) return;
      const rect = track.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      video.currentTime = pos * video.duration;
      if (fillRef.current) fillRef.current.style.width = `${pos * 100}%`;
    },
    [videoElement],
  );

  const handlePointerDown = useCallback(
    (e) => {
      if (!videoElement?.duration) return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      const isTouch = e.pointerType === "touch";
      gestureRef.current = {
        startX: e.clientX,
        pointerType: e.pointerType,
        seekArmed: !isTouch,
      };
      setIsActive(true);
      if (!isTouch) seekToClientX(e.clientX);
    },
    [videoElement, seekToClientX],
  );

  const handlePointerMove = useCallback(
    (e) => {
      const g = gestureRef.current;
      if (!g) return;
      if (!g.seekArmed) {
        if (Math.abs(e.clientX - g.startX) < TOUCH_SEEK_THRESHOLD_PX) return;
        g.seekArmed = true;
      }
      seekToClientX(e.clientX);
    },
    [seekToClientX],
  );

  const handlePointerEnd = useCallback((e) => {
    gestureRef.current = null;
    setIsActive(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  }, []);

  if (!videoElement || !duration) return null;

  return (
    <div
      className="group pointer-events-auto relative h-5 w-full select-none"
      style={{ touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div
        ref={trackRef}
        className={`absolute inset-x-0 bottom-0 overflow-hidden bg-white/25 shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-[height] duration-150 ease-out group-hover:h-[5px] ${
          isActive ? "h-[5px]" : "h-[2px]"
        }`}
      >
        <div ref={fillRef} className="h-full bg-white" style={{ width: "0%" }} />
      </div>
    </div>
  );
}

export default VideoProgressBar;
