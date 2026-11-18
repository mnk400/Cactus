import { useEffect, useRef } from "react";
import {
  useAudio,
  useCurrentMedia,
  useVideoElement,
} from "../context/MediaContext";
import { Icon, IconButton } from "./Dock";
import { DRAG_SLOP } from "./Sheet";

const clock = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

// Scrub by sliding sideways on the video, or along the dock while it is a
// horizontal row (sideways is free there: the feed pages vertically and the
// dock is pulled up into its panel). The playhead moves from where it was by
// how far you drag, never jumps to the finger; the stage's width is the whole
// video. While you scrub, <html data-scrubbing> dims the dock's icons and
// shows the time beside the sheet; the tide along its dock edge is the
// progress.
function useScrub(videoElement, seekVideo, timeRef) {
  useEffect(() => {
    if (!videoElement) return undefined;
    const portrait = matchMedia("(orientation: portrait)"); // same as index.css
    const root = document.documentElement;
    let g = null;

    // The time sits just outside the sheet, whatever size it is (the dock,
    // or a panel): centered above it on a tall screen, to its right on a
    // wide one. index.css hangs the label off this point.
    const placeTime = () => {
      const label = timeRef.current;
      const sheet = document.querySelector(".sheet");
      if (!label?.offsetParent || !sheet) return;
      const box = label.offsetParent.getBoundingClientRect();
      const s = sheet.getBoundingClientRect();
      const [x, y] = portrait.matches
        ? [s.left + s.width / 2, Math.max(s.top - 10, box.top + 40)]
        : [s.right + 10, s.top + s.height / 2];
      label.style.left = `${x - box.left}px`;
      label.style.top = `${y - box.top}px`;
    };
    const swallow = (e) => {
      e.stopPropagation();
      e.preventDefault();
    };
    const end = () => {
      const { on, wasPlaying } = g;
      g = null;
      if (!on) return;
      delete root.dataset.scrubbing;
      if (wasPlaying) videoElement.play().catch(() => {});
    };
    const onDown = (e) => {
      // One scrub at a time: a second finger does not take it over.
      if (e.button || g?.on) return;
      const onVideo = e.target === videoElement;
      const onDock = portrait.matches && !!e.target.closest(".dock-row");
      if (onVideo || onDock)
        g = { id: e.pointerId, x: e.clientX, y: e.clientY, on: false };
    };
    const onMove = (e) => {
      if (!g || e.pointerId !== g.id) return;
      // A mouse let go outside the window sends no pointerup.
      if (e.pointerType === "mouse" && !e.buttons) return end();
      const { duration } = videoElement;
      const dx = e.clientX - g.x;
      if (!g.on) {
        const dy = e.clientY - g.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_SLOP) return;
        // Up or down is a swipe through the feed, or a pull on the dock
        // (Sheet.jsx makes the same call on the same move).
        if (
          Math.abs(dy) >= Math.abs(dx) ||
          !(duration > 0 && isFinite(duration))
        ) {
          g = null;
          return;
        }
        try {
          e.target.setPointerCapture(e.pointerId);
        } catch {
          // Capture is a nicety; the scrub works without it.
        }
        g = {
          ...g,
          on: true,
          x: e.clientX,
          from: videoElement.currentTime,
          wasPlaying: !videoElement.paused,
        };
        videoElement.pause();
        placeTime();
        root.dataset.scrubbing = "";
      }
      const t = Math.min(
        duration,
        Math.max(
          0,
          g.from + ((e.clientX - g.x) / window.innerWidth) * duration,
        ),
      );
      seekVideo(t);
      if (timeRef.current)
        timeRef.current.textContent = `${clock(t)} / ${clock(duration)}`;
    };
    const onUp = (e) => {
      if (!g || e.pointerId !== g.id) return;
      const { on } = g;
      end();
      if (!on) return;
      // A mouse fires a click where the drag ends; it was not a tap.
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, true), 0);
    };

    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      // Torn down mid-scrub (the video changed): still let the video go.
      if (g) end();
    };
  }, [videoElement, seekVideo, timeRef]);
}

// Video-only chrome: sound and fullscreen top right (.corner-tr), and the
// scrub gesture.
// Progress itself lives on the sheet (VideoProgress.jsx), so the dock never
// changes shape as you swipe between photos and videos.
function VideoControls() {
  const { videoElement, seekVideo } = useVideoElement();
  const { isMuted, toggleMute } = useAudio();
  const { currentMediaFile } = useCurrentMedia();
  const timeRef = useRef(null);
  useScrub(videoElement, seekVideo, timeRef);

  if (currentMediaFile?.media_type !== "video") return null;

  const enterFullscreen = () =>
    videoElement &&
    (
      videoElement.requestFullscreen ||
      videoElement.webkitRequestFullscreen ||
      videoElement.webkitEnterFullscreen
    )?.call(videoElement);

  return (
    <>
      <div className="corner-tr z-20 flex gap-1.5">
        <IconButton
          onClick={toggleMute}
          title={isMuted ? "Unmute" : "Mute"}
          className="surface h-8 w-8"
        >
          <Icon className="h-4 w-4">
            {isMuted ? (
              <path d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            ) : (
              <path d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8.5 8.5 0 010 11.9M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            )}
          </Icon>
        </IconButton>
        <IconButton
          onClick={enterFullscreen}
          title="Fullscreen"
          disabled={!videoElement}
          className="surface h-8 w-8"
        >
          <Icon className="h-4 w-4">
            <path d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </Icon>
        </IconButton>
      </div>
      <span ref={timeRef} aria-hidden="true" className="scrub-time surface" />
    </>
  );
}

export default VideoControls;
