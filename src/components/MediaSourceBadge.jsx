import React, { memo, useCallback } from "react";
import { useCurrentMedia, useMediaData } from "../context/MediaContext";

const MediaSourceBadge = memo(function MediaSourceBadge() {
  const { currentMediaFile } = useCurrentMedia();
  const { setFilters, settings, mediaFiles } = useMediaData();
  const { galleryView } = settings;

  // Top left always says what you are looking at: the item's source in the
  // feed (tap to filter by it), the item count in the gallery.
  const displayName = currentMediaFile?.displayName || "";
  const label = galleryView
    ? `${mediaFiles.length.toLocaleString()} items`
    : displayName;

  const handleClick = useCallback(() => {
    if (!displayName) return;
    setFilters({ search: displayName });
  }, [displayName, setFilters]);

  if (!label) return null;

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex justify-start px-2.5"
      style={{
        paddingTop: "max(0.625rem, env(safe-area-inset-top, 0.625rem))",
      }}
    >
      {/* Tiles scroll under the count, so give it a soft edge to sit on. */}
      {galleryView && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/70 to-transparent"
        />
      )}
      <button
        type="button"
        onClick={galleryView ? undefined : handleClick}
        disabled={galleryView}
        title={galleryView ? undefined : `Filter by: ${displayName}`}
        className="surface pointer-events-auto relative h-7 max-w-[60%] truncate rounded-full px-3 font-medium text-gray-100 transition-transform duration-100 enabled:active:scale-95"
      >
        {label}
      </button>
    </div>
  );
});

export default MediaSourceBadge;
