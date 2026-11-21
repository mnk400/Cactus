import { memo, useCallback } from "react";
import { useCurrentMedia, useMediaData } from "../context/MediaContext";
import { filterParts, sortLabel } from "../utils/filters";
import { Icon } from "./Dock";

// Top left always says what you are looking at.
// - Unfiltered: plain text, the item's folder in the feed (tap to filter by
//   it), the item count in the gallery.
// - Filtered: a pill (index.css, .badge), so a pill up there always means
//   you are not seeing everything. The filters on top, with × to clear
//   them; tap to change them.
//   The folder or count moves to a quieter line under them, unless it only
//   repeats a filter (the folder you filtered by from here): then the badge
//   stays one line.
// - A sort other than random is named on that quieter line too. It sits
//   apart from the filters because × does not clear it.
const MediaSourceBadge = memo(function MediaSourceBadge({ onOpenFilters }) {
  const { currentMediaFile } = useCurrentMedia();
  const { setFilters, clearFilters, settings, mediaFiles } = useMediaData();
  const { galleryView } = settings;

  const folder = currentMediaFile?.displayName || "";
  const where = galleryView
    ? `${mediaFiles.length.toLocaleString()} items`
    : folder;
  const sort = sortLabel(settings);
  const filters = filterParts(settings);
  const filtered = filters.length > 0;

  const repeats = filters.some(
    (part) => part.toLowerCase() === where.toLowerCase(),
  );
  const top = filtered ? filters.join(" · ") : where;
  const bottom = filtered
    ? [repeats ? "" : where, sort].filter(Boolean).join(" · ")
    : sort;

  const filterByFolder = useCallback(() => {
    if (folder) setFilters({ search: folder });
  }, [folder, setFilters]);
  const onTap = filtered
    ? onOpenFilters
    : galleryView
      ? undefined
      : filterByFolder;

  if (!top && !bottom) return null;

  return (
    <div className="pointer-events-none absolute left-0 right-0 top-0 z-20">
      {/* The badge needs a soft shade to sit on wherever something bright
          can pass under it: tiles in the gallery, a photo under the plain
          text (index.css, .badge-shade). It has no edge of its own; the
          pill brings its own surface, so the feed drops the shade for it. */}
      <div
        aria-hidden="true"
        className={`badge-shade ${galleryView || !filtered ? "" : "opacity-0"}`}
      />
      <div
        className={`badge corner-tl pointer-events-auto flex items-center rounded-full ${
          filtered ? "badge-pill" : ""
        } ${bottom ? "h-10 max-w-[70%]" : "h-7 max-w-[60%]"}`}
      >
        <button
          type="button"
          onClick={onTap}
          disabled={!onTap}
          title={
            filtered
              ? "Change filters"
              : onTap
                ? `Filter by: ${folder}`
                : undefined
          }
          className={`flex min-w-0 flex-col justify-center text-left leading-tight ${
            filtered
              ? `${bottom ? "pl-3.5" : "pl-3"} pr-1`
              : bottom
                ? "px-3.5"
                : "px-3"
          }`}
        >
          {top && (
            <span className="truncate font-medium text-gray-100">{top}</span>
          )}
          {bottom && (
            <span className="truncate text-[11px] text-white/50">{bottom}</span>
          )}
        </button>
        {filtered && (
          <button
            type="button"
            onClick={clearFilters}
            title="Clear filters"
            aria-label="Clear filters"
            // Sized to the pill; its ::before keeps the touch target at 40.
            className={`relative flex shrink-0 items-center justify-center rounded-full text-white/50 before:absolute before:content-[''] hover:text-white [&>svg]:transition-transform [&>svg]:duration-100 active:[&>svg]:scale-[0.88] ${
              bottom
                ? "mr-1 h-8 w-8 before:-inset-1"
                : "mr-0.5 h-6 w-6 before:-inset-2"
            }`}
          >
            <Icon className="h-3.5 w-3.5">
              <path d="M6 18L18 6M6 6l12 12" />
            </Icon>
          </button>
        )}
      </div>
    </div>
  );
});

export default MediaSourceBadge;
