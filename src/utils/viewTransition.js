import { flushSync } from "react-dom";

export function startViewTransition(updateFn) {
  if (
    typeof document === "undefined" ||
    !document.startViewTransition ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    updateFn();
    return;
  }
  document.startViewTransition(() => flushSync(updateFn));
}
