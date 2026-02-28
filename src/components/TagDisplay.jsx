import React, {
  useState,
  useRef,
  useLayoutEffect,
  memo,
} from "react";

const TAG_GAP = 8; // gap-2 = 0.5rem = 8px
const BADGE_WIDTH = 52; // approximate "+N" badge width

const TagDisplay = memo(function TagDisplay({
  tags = [],
  onRemoveTag,
  expanded = false,
}) {
  const [visibleCount, setVisibleCount] = useState(null);
  const [localExpanded, setLocalExpanded] = useState(false);

  const containerRef = useRef(null);
  const measureRowRef = useRef(null);

  const isExpanded = expanded || localExpanded;

  const filteredTags = tags.filter((tag) => tag.name !== "favorites");

  // Measure how many tags fit in one row
  useLayoutEffect(() => {
    if (isExpanded || filteredTags.length === 0) {
      setVisibleCount(filteredTags.length);
      return;
    }

    const measure = () => {
      const measureRow = measureRowRef.current;
      const container = containerRef.current;
      if (!measureRow || !container) return;

      const containerWidth = container.offsetWidth;
      const children = Array.from(measureRow.children);

      if (children.length === 0) {
        setVisibleCount(0);
        return;
      }

      // If all tags fit without a badge, show them all
      let totalWidth = 0;
      for (let i = 0; i < children.length; i++) {
        totalWidth += children[i].offsetWidth + (i > 0 ? TAG_GAP : 0);
      }
      if (totalWidth <= containerWidth) {
        setVisibleCount(children.length);
        return;
      }

      // Otherwise, find how many fit with room for the "+N" badge
      let usedWidth = 0;
      let count = 0;

      for (let i = 0; i < children.length; i++) {
        const childWidth = children[i].offsetWidth;
        const widthWithGap = i > 0 ? TAG_GAP + childWidth : childWidth;
        const spaceAfter = containerWidth - (usedWidth + widthWithGap);

        // Need room for the "+N" badge after
        if (spaceAfter < TAG_GAP + BADGE_WIDTH) {
          break;
        }

        usedWidth += widthWithGap;
        count++;
      }

      // Show at least 1 tag
      setVisibleCount(Math.max(1, count));
    };

    const rafId = requestAnimationFrame(measure);

    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [filteredTags, isExpanded]);

  // Reset local expanded when parent forces expanded
  useLayoutEffect(() => {
    if (expanded) setLocalExpanded(false);
  }, [expanded]);

  if (filteredTags.length === 0) return null;

  const measured = visibleCount !== null;
  const hiddenCount = isExpanded
    ? 0
    : Math.max(0, filteredTags.length - (visibleCount ?? filteredTags.length));
  const displayedTags = isExpanded
    ? filteredTags
    : filteredTags.slice(0, visibleCount ?? filteredTags.length);

  return (
    <div
      className="flex-1 min-w-0 overflow-hidden pointer-events-auto"
      ref={containerRef}
    >
      {/* Hidden measurement row — renders all tags to measure their widths */}
      {!isExpanded && (
        <div
          ref={measureRowRef}
          className="flex gap-2 absolute invisible pointer-events-none h-0 overflow-hidden"
          aria-hidden="true"
        >
          {filteredTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap flex-shrink-0"
            >
              {tag.name}
              {onRemoveTag && <span className="ml-2 w-5 h-5">×</span>}
            </span>
          ))}
        </div>
      )}

      {/* Visible tags */}
      <div
        className={`flex gap-2 pb-1 transition-opacity duration-150 ${
          isExpanded ? "flex-wrap" : ""
        } ${measured ? "opacity-100" : "opacity-0"}`}
      >
        {displayedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-medium text-white shadow-sm whitespace-nowrap flex-shrink-0 tag-animated"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            {onRemoveTag && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveTag(tag.id);
                }}
                className="ml-2 text-white hover:text-gray-200 focus:outline-none transition-colors duration-150 hover:bg-white hover:bg-opacity-20 rounded-lg w-5 h-5 flex items-center justify-center text-lg leading-none"
                aria-label={`Remove ${tag.name} tag`}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {hiddenCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLocalExpanded(true);
            }}
            className="inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-medium text-white bg-zinc-800 bg-opacity-60 backdrop-blur-md hover:bg-zinc-600 hover:bg-opacity-60 shadow-sm whitespace-nowrap flex-shrink-0 transition-colors duration-150"
          >
            +{hiddenCount}
          </button>
        )}
        {localExpanded && !expanded && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLocalExpanded(false);
            }}
            className="inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-medium text-zinc-400 bg-zinc-800 bg-opacity-60 backdrop-blur-md hover:bg-zinc-600 hover:bg-opacity-60 shadow-sm whitespace-nowrap flex-shrink-0 transition-colors duration-150"
          >
            Less
          </button>
        )}
      </div>
    </div>
  );
});

export default TagDisplay;
