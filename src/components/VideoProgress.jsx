import { useEffect, useRef, useState } from "react";
import { useVideoElement } from "../context/MediaContext";

// The video's progress, as a tide that fills the sheet behind its icon row. Only
// the fill's position changes (--p, read by .dock-tide in index.css), written
// straight to the DOM so React does not render per frame: every frame while
// the video plays, and on each seek otherwise (which is how a scrub moves it).
function VideoProgress() {
  const { videoElement } = useVideoElement();
  const [hasDuration, setHasDuration] = useState(false);
  const tideRef = useRef(null);

  useEffect(() => {
    if (!videoElement) return undefined;
    const sync = () => {
      const { duration } = videoElement;
      setHasDuration(duration > 0 && isFinite(duration));
    };
    sync();
    videoElement.addEventListener("durationchange", sync);
    videoElement.addEventListener("emptied", sync);
    return () => {
      videoElement.removeEventListener("durationchange", sync);
      videoElement.removeEventListener("emptied", sync);
    };
  }, [videoElement]);

  useEffect(() => {
    if (!videoElement || !hasDuration) return undefined;
    let raf = 0;
    const paint = () => {
      const { currentTime, duration } = videoElement;
      const p = Math.min(1, Math.max(0, currentTime / duration));
      tideRef.current?.style.setProperty("--p", p);
    };
    const tick = () => {
      paint();
      raf = requestAnimationFrame(tick);
    };
    const follow = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (videoElement.paused) paint();
      else tick();
    };
    follow();
    const events = ["play", "pause", "seeking", "seeked", "ended"];
    events.forEach((type) => videoElement.addEventListener(type, follow));
    return () => {
      cancelAnimationFrame(raf);
      events.forEach((type) => videoElement.removeEventListener(type, follow));
    };
  }, [videoElement, hasDuration]);

  if (!videoElement || !hasDuration) return null;

  return (
    <span ref={tideRef} aria-hidden="true" className="dock-tide">
      <i />
    </span>
  );
}

export default VideoProgress;
