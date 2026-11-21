import { useEffect, useLayoutEffect, useRef } from "react";

const IN = 0.8; // fingers this much closer than they started: a pinch in
const OUT = 1.25; // this much farther apart: a pinch out
const WHEEL_IDLE = 200; // ms without a wheel event ends a trackpad pinch

const spread = (a, b) =>
  Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

// A pinch on the element, reported once per gesture: onPinchIn or
// onPinchOut, with the point the fingers started around (client coords).
// It owns the fingers while it lasts: the page does not zoom and the
// scrollers under it do not move.
//
// Three sources, one per kind of device:
// - touch: two fingers that both started inside the element.
// - a trackpad in Chrome, Edge and Firefox: wheel events with ctrlKey.
// - Safari's gesture events: the trackpad on a Mac. iOS sends them as well
//   as touches; there they are only cancelled, so the page cannot zoom.
export function usePinch(ref, handlers) {
  const latest = useRef(handlers);
  useLayoutEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let pinch = null; // { x, y, fired, from? (touch), scale? (wheel), idle? }
    let fingers = 0;

    const report = (scale) => {
      if (pinch.fired) return;
      const name = scale < IN ? "onPinchIn" : scale > OUT ? "onPinchOut" : null;
      if (!name) return;
      pinch.fired = true;
      latest.current[name]?.({ x: pinch.x, y: pinch.y });
    };

    const onTouchStart = (e) => {
      fingers = e.touches.length;
      const [a, b] = e.touches;
      pinch =
        fingers === 2 && el.contains(a.target) && el.contains(b.target)
          ? {
              x: (a.clientX + b.clientX) / 2,
              y: (a.clientY + b.clientY) / 2,
              from: Math.max(1, spread(a, b)),
              fired: false,
            }
          : null;
    };
    const onTouchMove = (e) => {
      if (!pinch?.from || e.touches.length !== 2) return;
      // Once the browser has started a scroll it cannot be taken back.
      if (e.cancelable) e.preventDefault();
      report(spread(e.touches[0], e.touches[1]) / pinch.from);
    };
    const onTouchEnd = (e) => {
      fingers = e.touches.length;
      if (fingers < 2) pinch = null;
    };

    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (!pinch)
        pinch = { x: e.clientX, y: e.clientY, scale: 1, fired: false };
      if (pinch.scale === undefined) return; // a gesture event pinch has it
      clearTimeout(pinch.idle);
      pinch.idle = setTimeout(() => (pinch = null), WHEEL_IDLE);
      const pixels = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      pinch.scale *= Math.exp(-pixels / 100);
      report(pinch.scale);
    };

    const onGestureStart = (e) => {
      e.preventDefault();
      if (!fingers) pinch = { x: e.clientX, y: e.clientY, fired: false };
    };
    const onGestureChange = (e) => {
      e.preventDefault();
      if (!fingers && pinch) report(e.scale);
    };
    const onGestureEnd = (e) => {
      e.preventDefault();
      if (!fingers) pinch = null;
    };

    const listeners = [
      ["touchstart", onTouchStart, { passive: true }],
      ["touchmove", onTouchMove, { passive: false }],
      ["touchend", onTouchEnd, { passive: true }],
      ["touchcancel", onTouchEnd, { passive: true }],
      ["wheel", onWheel, { passive: false }],
      ["gesturestart", onGestureStart],
      ["gesturechange", onGestureChange],
      ["gestureend", onGestureEnd],
    ];
    listeners.forEach(([type, fn, opts]) =>
      el.addEventListener(type, fn, opts),
    );
    return () => {
      clearTimeout(pinch?.idle);
      listeners.forEach(([type, fn]) => el.removeEventListener(type, fn));
    };
  }, [ref]);
}
