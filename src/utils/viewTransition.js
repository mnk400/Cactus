import { flushSync } from "react-dom";

export function startViewTransition(updateFn) {
  if (typeof document === "undefined" || !document.startViewTransition) {
    updateFn();
    return;
  }
  document.startViewTransition(() => flushSync(updateFn));
}
