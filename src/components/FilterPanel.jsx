import { useCallback, useEffect, useMemo, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import UnifiedSearchBar from "./UnifiedSearchBar";
import InlineTagPanel from "./InlineTagPanel";
import StatusPill from "./StatusPill";
import { useMediaData, useCurrentMedia } from "../context/MediaContext";
import { useMediaTags } from "../hooks/useMediaTags";
import { useIsDesktop } from "../hooks/useIsDesktop";

const EXCLUDE_COLOR = "#4b5563";
const INCLUDE_COLOR = "#2563eb";

const toggleClass = (active) =>
  `flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-200 active:scale-95 ${
    active
      ? "bg-white/20 text-white"
      : "bg-black-shades-700 text-gray-300 hover:bg-white/10"
  }`;

function Section({ title, children, sectionRef }) {
  return (
    <section ref={sectionRef} className="mb-6 scroll-mt-4">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </h4>
      {children}
    </section>
  );
}

// One consolidated surface for both "Filter feed" (search / include / exclude /
// type / sort) and "This item's tags" (item metadata). Desktop = right drawer,
// mobile = bottom sheet. `section` decides which part is scrolled into view.
const FilterPanel = memo(function FilterPanel({
  isOpen,
  section = "filters",
  onClose,
}) {
  const isDesktop = useIsDesktop();
  const { currentMediaFile } = useCurrentMedia();
  const { settings, setFilters, tags, fetchTags } = useMediaData();
  const { search, selectedTags, excludedTags, mediaType, sortBy, galleryView } =
    settings;

  const mediaTags = useMediaTags(
    !galleryView ? currentMediaFile?.file_path : null,
  );
  const visibleMediaTags = useMemo(
    () => mediaTags.filter((tag) => tag.name !== "favorites"),
    [mediaTags],
  );

  const hasActiveFilters =
    mediaType !== "all" ||
    sortBy !== "random" ||
    selectedTags.length > 0 ||
    excludedTags.length > 0 ||
    Boolean(search && search.trim());

  const handleClearAll = useCallback(() => {
    setFilters({
      mediaType: "all",
      sortBy: "random",
      selectedTags: [],
      excludedTags: [],
      search: "",
    });
  }, [setFilters]);

  const removeMediaTag = useCallback(
    async (tagId) => {
      if (!currentMediaFile?.file_path) return;
      try {
        const res = await fetch(
          `/api/media-path/tags/${tagId}?path=${encodeURIComponent(currentMediaFile.file_path)}`,
          { method: "DELETE" },
        );
        if (!res.ok) throw new Error("Failed to remove tag");
        await fetchTags?.();
        window.dispatchEvent(new CustomEvent("tags-updated"));
      } catch (error) {
        console.error("Failed to remove tag:", error);
      }
    },
    [currentMediaFile?.file_path, fetchTags],
  );

  const showItemTags = !galleryView && currentMediaFile;
  const tagsSectionRef = useRef(null);

  // Scroll the requested section into view when opened from the tags button.
  useEffect(() => {
    if (isOpen && section === "tags" && tagsSectionRef.current) {
      tagsSectionRef.current.scrollIntoView({ block: "start" });
    }
  }, [isOpen, section]);

  const panelMotion = isDesktop
    ? { initial: { x: "100%" }, animate: { x: 0 }, exit: { x: "100%" } }
    : { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className={`fixed z-50 flex flex-col overflow-hidden bg-black-shades-900 text-gray-200 ${
              isDesktop
                ? "top-0 right-0 bottom-0 w-[420px] lg:w-[450px] shadow-2xl"
                : "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.5)]"
            }`}
            {...panelMotion}
            transition={{
              type: "spring",
              stiffness: 320,
              damping: 34,
              mass: 0.7,
            }}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 safe-area-top">
              <h3 className="m-0 text-lg font-semibold text-white">Filter</h3>
              <button
                onClick={onClose}
                className="rounded-xl bg-black-shades-700 px-3 py-1.5 text-sm font-medium text-gray-200 transition-colors duration-150 hover:bg-white/20"
                aria-label="Close filter panel"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 safe-area-bottom">
              <Section title="Filter feed">
                <div className="space-y-3">
                  <UnifiedSearchBar
                    tags={tags}
                    selectedTags={selectedTags}
                    excludedTags={excludedTags}
                    search={search || ""}
                    onTagsChange={(next) => setFilters({ selectedTags: next })}
                    onSearchChange={(value) => setFilters({ search: value })}
                    dropdownPosition="bottom"
                  />

                  {excludedTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {excludedTags.map((tag) => (
                        <StatusPill
                          key={tag.id}
                          color={EXCLUDE_COLOR}
                          onRemove={() =>
                            setFilters({
                              excludedTags: excludedTags.filter(
                                (t) => t.id !== tag.id,
                              ),
                            })
                          }
                          removeLabel={`Stop excluding ${tag.name}`}
                          title={`Excluding ${tag.name}`}
                        >
                          Not: {tag.name}
                        </StatusPill>
                      ))}
                    </div>
                  )}

                  <div>
                    <div className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
                      Media type
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFilters({ mediaType: "all" })}
                        className={toggleClass(mediaType === "all")}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setFilters({ mediaType: "photos" })}
                        className={toggleClass(mediaType === "photos")}
                      >
                        Photos
                      </button>
                      <button
                        onClick={() => setFilters({ mediaType: "videos" })}
                        className={toggleClass(mediaType === "videos")}
                      >
                        Videos
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
                      Sort by
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFilters({ sortBy: "random" })}
                        className={toggleClass(sortBy === "random")}
                      >
                        Random
                      </button>
                      <button
                        onClick={() => setFilters({ sortBy: "date_added" })}
                        className={toggleClass(sortBy === "date_added")}
                      >
                        Date Added
                      </button>
                      <button
                        onClick={() => setFilters({ sortBy: "date_created" })}
                        className={toggleClass(sortBy === "date_created")}
                      >
                        Date Created
                      </button>
                    </div>
                  </div>

                  {hasActiveFilters && (
                    <button
                      onClick={handleClearAll}
                      className="w-full rounded-xl bg-black-shades-700 px-3 py-2 text-sm font-medium text-gray-200 transition-colors duration-200 hover:bg-white/20 active:scale-95"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              </Section>

              {showItemTags && (
                <Section title="This item's tags" sectionRef={tagsSectionRef}>
                  <div className="space-y-3">
                    {visibleMediaTags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {visibleMediaTags.map((tag) => (
                          <StatusPill
                            key={tag.id}
                            color={tag.color || INCLUDE_COLOR}
                            onRemove={() => removeMediaTag(tag.id)}
                            removeLabel={`Remove ${tag.name} tag`}
                            title={`Tag: ${tag.name}`}
                          >
                            {tag.name}
                          </StatusPill>
                        ))}
                      </div>
                    )}
                    <InlineTagPanel
                      currentMediaFile={currentMediaFile}
                      isExpanded={isOpen}
                      onToggleExpanded={onClose}
                    />
                  </div>
                </Section>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

export default FilterPanel;
