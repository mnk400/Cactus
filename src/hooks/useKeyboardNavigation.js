import { useEffect, useCallback } from "react";

export function useKeyboardNavigation(onNavigate) {
  // Memoize the keyboard handler to prevent unnecessary re-registrations
  const handleKeyDown = useCallback(
    (e) => {
      // Prevent navigation when user is typing in inputs
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        return;
      }

      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        onNavigate(-1);
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        onNavigate(1);
      }
    },
    [onNavigate],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown, { passive: false });
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
