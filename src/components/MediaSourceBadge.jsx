import React, { memo, useCallback } from "react";
import { useCurrentMedia, useMediaData } from "../context/MediaContext";

const MediaSourceBadge = memo(function MediaSourceBadge() {
  const { currentMediaFile } = useCurrentMedia();
  const { setFilters, settings } = useMediaData();

  const displayName = currentMediaFile?.displayName || "";

  const handleClick = useCallback(() => {
    if (!displayName) return;
    setFilters({ search: displayName });
  }, [displayName, setFilters]);

  if (!displayName || settings.galleryView) return null;

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-0 z-20 flex justify-start px-4"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0.75rem))" }}
    >
      <button
        type="button"
        onClick={handleClick}
        title={`Filter by: ${displayName}`}
        className="pointer-events-auto max-w-[60vw] truncate rounded-xl bg-black/60 px-3 py-1.5 text-sm font-medium text-gray-100 shadow-sm backdrop-blur-md transition-all duration-150 hover:bg-black/80 hover:text-white active:scale-95"
      >
        {displayName}
      </button>
    </div>
  );
});

export default MediaSourceBadge;
