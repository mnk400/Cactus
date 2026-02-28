import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  memo,
} from "react";

const TAG_GAP = 8; // gap-2 = 0.5rem = 8px
const BADGE_WIDTH = 52; // approximate "+N" badge width
const MAX_COLLAPSED = 5;

const TagDisplay = memo(function TagDisplay({
  tags = [],
  onRemoveTag,
  expanded = false,
}) {
  const [visibleCount, setVisibleCount] = useState(null);
  const [localExpanded, setLocalExpanded] = useState(false);
  const [showOverflow, setShowOverflow] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  const containerRef = useRef(null);
  const measureRowRef = useRef(null);

  const isExpanded = expanded || localExpanded;

  const filteredTags = tags.filter((tag) => tag.name !== "favorites");

  // Measure how many tags fit in one row, capped at MAX_COLLAPSED
  useLayoutEffect(() => {
    if (filteredTags.length === 0) {
      setVisibleCount(0);
      return;
    }

    // Don't re-measure while expanded or during exit animation
    if (isExpanded || showOverflow) return;

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

      const needsBadge = children.length > MAX_COLLAPSED;

      // If no badge needed and everything fits, show all
      if (!needsBadge) {
        let totalWidth = 0;
        for (let i = 0; i < children.length; i++) {
          totalWidth += children[i].offsetWidth + (i > 0 ? TAG_GAP : 0);
        }
        if (totalWidth <= containerWidth) {
          setVisibleCount(children.length);
          return;
        }
      }

      // Find how many fit with room for the "+N" badge, capped at MAX_COLLAPSED
      let usedWidth = 0;
      let count = 0;

      for (let i = 0; i < children.length && count < MAX_COLLAPSED; i++) {
        const childWidth = children[i].offsetWidth;
        const widthWithGap = i > 0 ? TAG_GAP + childWidth : childWidth;
        const spaceAfter = containerWidth - (usedWidth + widthWithGap);

        if (spaceAfter < TAG_GAP + BADGE_WIDTH) {
          break;
        }

        usedWidth += widthWithGap;
        count++;
      }

      setVisibleCount(Math.max(1, count));
    };

    const rafId = requestAnimationFrame(measure);

    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [filteredTags, isExpanded, showOverflow]);

  // Animate overflow tags in/out
  useEffect(() => {
    if (localExpanded) {
      setShowOverflow(true);
      // Double-RAF: ensure browser paints the invisible state before animating in
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimateIn(true));
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setAnimateIn(false);
      // Keep overflow mounted until exit animation finishes
      const timer = setTimeout(() => setShowOverflow(false), 400);
      return () => clearTimeout(timer);
    }
  }, [localExpanded]);

  // Reset when parent forces expanded
  useLayoutEffect(() => {
    if (expanded) {
      setLocalExpanded(false);
      setShowOverflow(false);
      setAnimateIn(false);
    }
  }, [expanded]);

  if (filteredTags.length === 0) return null;

  const measured = visibleCount !== null;
  const effectiveVisibleCount = visibleCount ?? filteredTags.length;
  const firstRowTags = filteredTags.slice(0, effectiveVisibleCount);
  const overflowTags = filteredTags.slice(effectiveVisibleCount);

  return (
    <div className="flex-1 min-w-0 pointer-events-auto" ref={containerRef}>
      {/* Hidden measurement row */}
      {!isExpanded && !showOverflow && (
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

      {/* Overflow tags — pop in above the first row, rendered bottom-to-top */}
      {showOverflow && (
        <div className="flex flex-wrap-reverse gap-2 pb-2 items-end">
          {overflowTags.map((tag, i) => {
            // Stagger from bottom (last tag) to top (first tag)
            const reverseIndex = overflowTags.length - 1 - i;
            return (
              <span
                key={tag.id}
                className={`inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-medium text-white shadow-sm whitespace-nowrap flex-shrink-0 transition-all duration-200 ease-out ${
                  animateIn ? "opacity-100 scale-100" : "opacity-0 scale-50"
                }`}
                style={{
                  backgroundColor: tag.color,
                  transitionDelay: animateIn
                    ? `${Math.min(reverseIndex * 25, 300)}ms`
                    : `${Math.min(i * 15, 200)}ms`,
                }}
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
            );
          })}
        </div>
      )}

      {/* First row — always visible, never moves */}
      <div
        className={`flex gap-2 pb-1 overflow-hidden ${measured ? "opacity-100" : "opacity-0"}`}
      >
        {firstRowTags.map((tag) => (
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
        {overflowTags.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLocalExpanded((prev) => !prev);
            }}
            className="inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-medium text-white bg-black-shades-700 hover:bg-black-shades-600 shadow-sm whitespace-nowrap flex-shrink-0 transition-all duration-200 ease-in-out"
          >
            {localExpanded ? "Less" : `+${overflowTags.length}`}
          </button>
        )}
      </div>
    </div>
  );
});

export default TagDisplay;
