import { useEffect } from "react";

// Arrow keys move through the feed, except while typing in a field or
// working inside the sheet.
export function useKeyboardNavigation(onNavigate) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.closest?.(".sheet")
      ) {
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        onNavigate(-1);
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        onNavigate(1);
      }
    };

    document.addEventListener("keydown", handleKeyDown, { passive: false });
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onNavigate]);
}
