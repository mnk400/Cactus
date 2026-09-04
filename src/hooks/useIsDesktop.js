import { useState, useEffect } from "react";
import { isMobile } from "../utils/helpers";

// Single source of truth for the mobile/desktop breakpoint. Wraps isMobile()
// plus a resize listener so components don't each re-implement the check.
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => !isMobile());

  useEffect(() => {
    const update = () => setIsDesktop(!isMobile());
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return isDesktop;
}
