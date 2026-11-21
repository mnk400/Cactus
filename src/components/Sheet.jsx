import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Dock from "./Dock";
import VideoProgress from "./VideoProgress";

const DOCK = 44; // thickness of the icon row, and so of the closed sheet
export const DRAG_SLOP = 6; // a press must travel this far to be a drag
const TOP_GAP = 10; // space kept above the open sheet on a tall screen
const STIFFNESS = 520; // spring response ≈ 0.28s
const FLICK_DAMPING = 0.82; // a little overshoot, only after a flick

// Past fully open the sheet still follows the finger, with resistance that
// grows until it stops about 10% further. (Below closed it simply stays put.)
const rubberBand = (x) =>
  x < 0 ? 0 : x > 1 ? 1 + 0.1 * (1 - 1 / (1 + (x - 1) * 2.5)) : x;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// One floating object. Closed, it is the dock; open, the same object has
// grown into the panel, and the icon row has not moved. Everything is driven
// by a single progress value p (0 = dock, 1 = open) that either follows the
// finger 1:1 or is carried by a spring, written straight to the DOM so React
// does not render per frame. The sheet floats over the media and only ever
// resizes itself, so opening it costs the same in the feed and the gallery.
//
// Where the sheet sits is CSS (index.css, by orientation). This component
// only animates its size, so it measures its open size when something
// changes (a resize, a new panel) rather than on every frame.
function Sheet({ panel, onPanel, panels }) {
  const sheetRef = useRef(null);
  const innerRef = useRef(null);
  const dockRef = useRef(null);
  const motionRef = useRef(null);
  // The gesture handlers are bound once; they read the current props here.
  const latest = useRef({});
  useLayoutEffect(() => {
    latest.current = { panel, onPanel, panels };
  });

  // The panel's content stays mounted while the sheet closes over it.
  const [shown, setShown] = useState(panel);
  if (panel && panel !== shown) setShown(panel);

  useEffect(() => {
    const sheet = sheetRef.current;
    const inner = innerRef.current;
    const dock = dockRef.current;
    const shell = sheet.parentElement;
    const portrait = matchMedia("(orientation: portrait)"); // same as index.css
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // p/v/target: the spring. size: the open sheet's length along its growth
    // axis, eased so switching panels glides between their heights.
    const s = { p: 0, v: 0, target: 0, zeta: 1, size: DOCK, raf: 0, last: 0 };
    let g = null; // cached geometry, see measure()
    let drag = null;
    let lastPanel = "filters";

    const measure = () => {
      const W = shell.clientWidth;
      const H = shell.clientHeight;
      const tall = portrait.matches;
      const style = getComputedStyle(sheet);
      g = { tall, edge: parseFloat(tall ? style.bottom : style.left) };
      if (tall) {
        g.dock = dock.offsetWidth;
        g.across = W - 16;
        inner.style.width = `${g.across}px`;
        inner.style.minHeight = "";
        inner.style.maxHeight = `${H - g.edge - TOP_GAP - DOCK}px`;
        g.open = DOCK + inner.offsetHeight;
      } else {
        g.dock = dock.offsetHeight;
        g.across = Math.min(340, Math.round(W * 0.42));
        inner.style.width = `${g.across - DOCK}px`;
        inner.style.maxHeight = `${H - 20}px`;
        // A panel shorter than the dock still spans it, so its content
        // starts at the top instead of floating mid-sheet.
        inner.style.minHeight = `${g.dock}px`;
        g.open = Math.max(g.dock, inner.offsetHeight);
      }
    };

    const paint = () => {
      const q = Math.max(0, s.p); // may overshoot 1 a little on a flick
      const c = Math.min(1, q);
      const along = (from, to, t) => `${from + (to - from) * t}px`;
      if (g.tall) {
        sheet.style.width = along(g.dock, g.across, c);
        sheet.style.height = along(DOCK, s.size, q);
      } else {
        sheet.style.width = along(DOCK, g.across, q);
        sheet.style.height = along(g.dock, Math.max(s.size, g.dock), c);
      }
      // Content arrives late and leaves early, so the sheet never shows a
      // half-faded panel in a box that is still small. It also drifts in from
      // the dock's side by a few pixels.
      const fadeFrom = s.target ? 0.35 : 0.5;
      const visible = clamp01((q - fadeFrom) / 0.35);
      const drift = (1 - visible) * 8;
      inner.style.opacity = visible;
      inner.style.transform = g.tall
        ? `translateY(${drift}px)`
        : `translateX(${-drift}px)`;
      inner.style.pointerEvents = q > 0.5 ? "" : "none";
    };

    const tick = (now) => {
      const dt = Math.min(0.032, (now - s.last) / 1000 || 0.016);
      s.last = now;
      s.size += (g.open - s.size) * Math.min(1, dt * 22);
      if (!drag?.active) {
        const k = STIFFNESS;
        s.v += (-k * (s.p - s.target) - 2 * Math.sqrt(k) * s.zeta * s.v) * dt;
        s.p += s.v * dt;
      }
      const settled =
        !drag?.active &&
        Math.abs(s.p - s.target) < 0.003 &&
        Math.abs(s.v) < 0.05 &&
        Math.abs(g.open - s.size) < 0.5;
      if (settled) Object.assign(s, { p: s.target, v: 0, size: g.open });
      paint();
      s.raf = settled ? 0 : requestAnimationFrame(tick);
      if (settled && s.target === 0 && !latest.current.panel) setShown(null);
    };

    const run = () => {
      if (reduceMotion && !drag?.active) {
        Object.assign(s, { p: s.target, v: 0, size: g.open });
        paint();
        if (s.target === 0 && !latest.current.panel) setShown(null);
      } else if (!s.raf) {
        s.last = performance.now();
        s.raf = requestAnimationFrame(tick);
      }
    };

    motionRef.current = (name) => {
      if (name) lastPanel = name;
      const target = name ? 1 : 0;
      if (s.target !== target) s.zeta = 1;
      measure();
      if (s.p < 0.05) s.size = g.open; // opening: no height to ease from
      s.target = target;
      run();
    };

    // Drag by the grabber or the icon row; the panel's own content scrolls.
    const onDown = (e) => {
      if (e.button || !e.target.closest(".sheet-grab, .dock-row")) return;
      drag = {
        x: e.clientX,
        y: e.clientY,
        id: e.pointerId,
        samples: [],
        row: !!e.target.closest(".dock-row"),
      };
    };
    const onMove = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      // dist grows toward closed: down on a tall screen, left on a wide one
      // (the sheet sits on the left there and opens rightward).
      const [dist, cross] = g.tall ? [dy, dx] : [-dx, dy];
      if (!drag.active) {
        if (Math.max(Math.abs(dist), Math.abs(cross)) < DRAG_SLOP) return;
        if (Math.abs(cross) > Math.abs(dist)) {
          // Sideways along the dock row is a scrub (VideoControls decides on
          // the same move, by the same rule), so the pull lets it go.
          // Elsewhere, wait and see.
          if (g.tall && drag.row) drag = null;
          return;
        }
        try {
          sheet.setPointerCapture(e.pointerId);
        } catch {
          // Capture is a nicety; the drag works without it.
        }
        if (!latest.current.panel && s.p < 0.05) {
          // Pulling the closed dock open brings back the last panel, if it
          // applies here (the tags panel does not exist in the gallery).
          drag.opens = latest.current.panels[lastPanel] ? lastPanel : "filters";
          flushSync(() => setShown(drag.opens));
          measure();
          s.size = g.open;
        }
        Object.assign(drag, {
          active: true,
          x: e.clientX,
          y: e.clientY,
          from: s.p,
          travel: Math.max(1, (g.tall ? s.size : g.across) - DOCK),
        });
        s.v = 0;
        return;
      }
      s.p = rubberBand(drag.from - dist / drag.travel);
      drag.samples.push([e.timeStamp, s.p]);
      if (drag.samples.length > 6) drag.samples.shift();
      run();
    };
    const onUp = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const { active, opens, samples: dragSamples } = drag;
      drag = null;
      if (!active) return;
      // The pointer may still be over a dock button; the drag was not a tap.
      sheet.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => sheet.removeEventListener("click", swallow, true), 0);
      // Hand the finger's speed to the spring, and land where the flick was
      // heading rather than where it was let go. Only recent movement counts:
      // a drag that pauses before release is not a flick.
      const samples = dragSamples.filter(([t]) => e.timeStamp - t < 80);
      const [first, end] = [samples[0], samples[samples.length - 1]];
      const velocity =
        first && end && end[0] > first[0]
          ? (end[1] - first[1]) / ((end[0] - first[0]) / 1000)
          : 0;
      const open = s.p + velocity * 0.16 > 0.5;
      Object.assign(s, {
        v: velocity,
        target: open ? 1 : 0,
        zeta: FLICK_DAMPING,
      });
      run();
      const { panel: current, onPanel: toggle } = latest.current;
      if (open !== !!current) toggle(open ? opens || lastPanel : current);
    };
    const swallow = (e) => {
      e.stopPropagation();
      e.preventDefault();
    };
    const onKeyDown = (e) => {
      const { panel: current, onPanel: toggle } = latest.current;
      if (e.key === "Escape" && current && !e.defaultPrevented) toggle(current);
    };

    sheet.addEventListener("pointerdown", onDown);
    sheet.addEventListener("pointermove", onMove);
    sheet.addEventListener("pointerup", onUp);
    sheet.addEventListener("pointercancel", onUp);
    document.addEventListener("keydown", onKeyDown);
    // Paint straight away too, so the sheet keeps step with a dock that is
    // growing (a video's buttons opening at its ends) instead of a frame behind.
    const observer = new ResizeObserver(() => {
      measure();
      paint();
      run();
    });
    [shell, inner, dock].forEach((el) => observer.observe(el));
    measure();
    paint();

    return () => {
      cancelAnimationFrame(s.raf);
      observer.disconnect();
      document.removeEventListener("keydown", onKeyDown);
      sheet.removeEventListener("pointerdown", onDown);
      sheet.removeEventListener("pointermove", onMove);
      sheet.removeEventListener("pointerup", onUp);
      sheet.removeEventListener("pointercancel", onUp);
    };
  }, []);

  useEffect(() => motionRef.current(panel), [panel]);

  const Panel = shown ? panels[shown] : null;

  return (
    <div
      ref={sheetRef}
      className="sheet surface text-gray-100"
      // Tapping a chip or button must not blur the field being typed in:
      // that would drop the keyboard mid-tap.
      onMouseDown={(event) => {
        if (!event.target.closest("input, textarea")) event.preventDefault();
      }}
    >
      <VideoProgress />
      <div className="sheet-body">
        <div ref={innerRef} className="sheet-inner">
          <div className="sheet-grab" aria-hidden="true" />
          {Panel && (
            <div key={shown} className="sheet-content sheet-content-in">
              <Panel onClose={() => onPanel(shown)} />
            </div>
          )}
        </div>
      </div>
      <div ref={dockRef} className="dock-row">
        <Dock panel={panel} onPanel={onPanel} />
      </div>
    </div>
  );
}

export default Sheet;
