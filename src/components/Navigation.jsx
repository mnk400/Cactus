import { useState, useCallback, useEffect, memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import UnifiedSearchBar from "./UnifiedSearchBar";
import InlineTagPanel from "./InlineTagPanel";
import StatusPill from "./StatusPill";
import {
  useCurrentMedia,
  useMediaData,
} from "../context/MediaContext";

const FILTER_COLORS = {
  include: "#2563eb",
  exclude: "#4b5563",
  search: "#ef4444",
  sort: "#1e293b",
  mediaType: "#7c3aed",
};

function useMediaTags(filePath) {
  const [mediaTags, setMediaTags] = useState([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!filePath) {
        if (mounted) setMediaTags([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/media-path/tags?path=${encodeURIComponent(filePath)}`,
        );
        if (!res.ok) throw new Error("Failed to fetch media tags");
        const data = await res.json();
        if (mounted) setMediaTags(data.tags || []);
      } catch (err) {
        console.error("Error fetching media tags:", err);
        if (mounted) setMediaTags([]);
      }
    };

    load();
    const onUpdated = () => load();
    window.addEventListener("tags-updated", onUpdated);
    return () => {
      mounted = false;
      window.removeEventListener("tags-updated", onUpdated);
    };
  }, [filePath]);

  return mediaTags;
}

function NavButton({ onClick, title, active, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex h-10 w-10 items-center justify-center rounded-xl border-none transition-all duration-200 ease-in-out active:scale-95 ${
        active
          ? "bg-white/20 text-white"
          : "bg-black-shades-700 text-gray-200 hover:bg-white/20"
      }`}
    >
      {children}
    </button>
  );
}

function ContextChip({ onClick, active, label, accent = false }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex h-10 flex-shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-all duration-200 ease-in-out active:scale-95 ${
        active
          ? "bg-white/20 text-white"
          : accent
            ? "bg-blue-600/90 text-white hover:bg-blue-500"
            : "bg-black-shades-700 text-gray-200 hover:bg-white/20"
      }`}
    >
      <span className="truncate">{label}</span>
      <svg
        className={`h-3 w-3 transition-transform duration-200 ${active ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

const Navigation = memo(function Navigation({
  onToggleSettings,
  expandedPanel,
  onSetExpandedPanel,
  isFavorited,
  onToggleFavorite,
}) {
  const { currentMediaFile } = useCurrentMedia();
  const { toggleGallery, settings, setFilters, tags, fetchTags } =
    useMediaData();

  const {
    galleryView: isGalleryView,
    search,
    selectedTags,
    excludedTags,
    mediaType,
    sortBy,
  } = settings;

  const mediaTags = useMediaTags(
    !isGalleryView ? currentMediaFile?.file_path : null,
  );
  const visibleMediaTags = useMemo(
    () => mediaTags.filter((tag) => tag.name !== "favorites"),
    [mediaTags],
  );

  const isFiltersOpen = expandedPanel === "filters";
  const isTagsOpen = expandedPanel === "tags";

  const closePanels = useCallback(
    () => onSetExpandedPanel("none"),
    [onSetExpandedPanel],
  );
  const toggleFilters = useCallback(
    () => onSetExpandedPanel(isFiltersOpen ? "none" : "filters"),
    [isFiltersOpen, onSetExpandedPanel],
  );
  const toggleTags = useCallback(
    () => onSetExpandedPanel(isTagsOpen ? "none" : "tags"),
    [isTagsOpen, onSetExpandedPanel],
  );

  const filterPills = useMemo(() => {
    const pills = [];
    selectedTags.forEach((tag) => {
      pills.push({
        id: `include:${tag.id}`,
        label: `Tag: ${tag.name}`,
        color: tag.color || FILTER_COLORS.include,
        remove: () =>
          setFilters({
            selectedTags: selectedTags.filter((t) => t.id !== tag.id),
          }),
      });
    });
    excludedTags.forEach((tag) => {
      pills.push({
        id: `exclude:${tag.id}`,
        label: `Not: ${tag.name}`,
        color: FILTER_COLORS.exclude,
        remove: () =>
          setFilters({
            excludedTags: excludedTags.filter((t) => t.id !== tag.id),
          }),
      });
    });
    if (search?.trim()) {
      pills.push({
        id: "search",
        label: `Search: ${search.trim()}`,
        color: FILTER_COLORS.search,
        remove: () => setFilters({ search: "" }),
      });
    }
    if (mediaType !== "all") {
      pills.push({
        id: "mediaType",
        label: mediaType === "photos" ? "Photos only" : "Videos only",
        color: FILTER_COLORS.mediaType,
        remove: () => setFilters({ mediaType: "all" }),
      });
    }
    if (sortBy !== "random") {
      pills.push({
        id: "sortBy",
        label: `Sort: ${sortBy === "date_added" ? "Date Added" : "Date Created"}`,
        color: FILTER_COLORS.sort,
        remove: () => setFilters({ sortBy: "random" }),
      });
    }
    return pills;
  }, [excludedTags, mediaType, search, selectedTags, setFilters, sortBy]);

  const activeFilterCount = filterPills.length;
  const hasActiveFilters = activeFilterCount > 0;

  const handleClearAllFilters = useCallback(() => {
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

  const showTagChip = !isGalleryView && currentMediaFile;
  const tagChipLabel = visibleMediaTags.length
    ? `${visibleMediaTags.length} ${visibleMediaTags.length === 1 ? "tag" : "tags"}`
    : "+ Add tags";

  return (
    <div
      className="navigation flex w-full flex-col justify-end bg-black-shades-1000 pt-3"
      style={{
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))",
      }}
    >
      <AnimatePresence initial={false}>
        {(isFiltersOpen || isTagsOpen) && (
          <motion.div
            key={expandedPanel}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">
              {isFiltersOpen && (
                <div className="space-y-2">
                  {hasActiveFilters && (
                    <div className="scrollbar-hide flex w-full items-center gap-2 overflow-x-auto overscroll-x-contain">
                      {filterPills.map((pill) => (
                        <StatusPill
                          key={pill.id}
                          color={pill.color}
                          onRemove={pill.remove}
                          removeLabel={`Remove ${pill.label}`}
                          title={pill.label}
                        >
                          {pill.label}
                        </StatusPill>
                      ))}
                    </div>
                  )}
                  <UnifiedSearchBar
                    tags={tags}
                    selectedTags={selectedTags}
                    excludedTags={excludedTags}
                    search={search || ""}
                    onTagsChange={(next) => setFilters({ selectedTags: next })}
                    onSearchChange={(value) => setFilters({ search: value })}
                    dropdownPosition="top"
                  />
                  {hasActiveFilters && (
                    <button
                      onClick={handleClearAllFilters}
                      className="w-full rounded-xl bg-black-shades-700 px-3 py-2 text-sm font-medium text-gray-200 transition-all duration-200 ease-in-out hover:bg-white/20 active:scale-95"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              )}
              {isTagsOpen && (
                <div className="space-y-2">
                  {visibleMediaTags.length > 0 && (
                    <div className="scrollbar-hide flex w-full items-center gap-2 overflow-x-auto overscroll-x-contain">
                      {visibleMediaTags.map((tag) => (
                        <StatusPill
                          key={`media:${tag.id}`}
                          color={tag.color || FILTER_COLORS.include}
                          onRemove={() => removeMediaTag(tag.id)}
                          removeLabel={`Remove ${tag.name} tag`}
                          title={`Current media tag: ${tag.name}`}
                        >
                          {tag.name}
                        </StatusPill>
                      ))}
                    </div>
                  )}
                  <InlineTagPanel
                    currentMediaFile={currentMediaFile}
                    isExpanded={isTagsOpen}
                    onToggleExpanded={closePanels}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex w-full items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-2">
          <NavButton onClick={onToggleFavorite} title={isFavorited ? "Remove from favorites" : "Add to favorites"}>
            {isFavorited ? (
              <svg className="h-4 w-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            )}
          </NavButton>

          <NavButton onClick={toggleFilters} active={isFiltersOpen} title="Search and filters">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </NavButton>

          <NavButton onClick={toggleGallery} title="Gallery view (G)">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </NavButton>

          <NavButton onClick={onToggleSettings} title="Settings">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </NavButton>
        </div>

        <div className="flex items-center gap-2 overflow-hidden">
          {hasActiveFilters && (
            <ContextChip
              onClick={toggleFilters}
              active={isFiltersOpen}
              label={`${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"}`}
            />
          )}
          {showTagChip && (
            <ContextChip
              onClick={toggleTags}
              active={isTagsOpen}
              label={tagChipLabel}
              accent={visibleMediaTags.length === 0}
            />
          )}
        </div>
      </div>
    </div>
  );
});

export default Navigation;
