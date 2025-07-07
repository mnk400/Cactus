import { useEffect } from "react";

export function useKeyboardNavigation(onNavigate) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        onNavigate(-1);
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        onNavigate(1);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onNavigate]);
}
