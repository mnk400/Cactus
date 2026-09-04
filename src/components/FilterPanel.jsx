import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import UnifiedSearchBar from "./UnifiedSearchBar";
import InlineTagPanel from "./InlineTagPanel";
import StatusPill from "./StatusPill";
import {
  PanelButton,
  PanelSection,
  ResponsivePanel,
  SegmentedControl,
} from "./ui/Panel";
import { useMediaData, useCurrentMedia } from "../context/MediaContext";
import { useMediaTags } from "../hooks/useMediaTags";

const MEDIA_TYPES = [
  { value: "all", label: "All" },
  { value: "photos", label: "Photos" },
  { value: "videos", label: "Videos" },
];

const SORT_OPTIONS = [
  { value: "random", label: "Random" },
  { value: "date_added", label: "Date added" },
  { value: "date_created", label: "Date created" },
];

const FilterPanel = memo(function FilterPanel({
  isOpen,
  section = "filters",
  onClose,
}) {
  const { currentMediaFile } = useCurrentMedia();
  const { settings, setFilters, tags, fetchTags } = useMediaData();
  const { search, selectedTags, excludedTags, mediaType, sortBy, galleryView } =
    settings;
  const tagsSectionRef = useRef(null);

  const mediaTags = useMediaTags(
    isOpen && !galleryView ? currentMediaFile?.file_path : null,
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
    Boolean(search?.trim());

  useEffect(() => {
    if (isOpen && section === "tags") {
      tagsSectionRef.current?.scrollIntoView({ block: "start" });
    }
  }, [isOpen, section]);

  const clearFilters = useCallback(() => {
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
        const response = await fetch(
          `/api/media-path/tags/${tagId}?path=${encodeURIComponent(currentMediaFile.file_path)}`,
          { method: "DELETE" },
        );
        if (!response.ok) throw new Error("Failed to remove tag");
        await fetchTags?.();
        window.dispatchEvent(new CustomEvent("tags-updated"));
      } catch (error) {
        console.error("Failed to remove tag:", error);
      }
    },
    [currentMediaFile?.file_path, fetchTags],
  );

  const showItemTags = !galleryView && currentMediaFile;

  return (
    <ResponsivePanel isOpen={isOpen} onClose={onClose} title="Filter">
      <div className="space-y-4">
        <PanelSection title="Filter feed">
          <div className="space-y-4">
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
                    color="#4b5563"
                    onRemove={() =>
                      setFilters({
                        excludedTags: excludedTags.filter(
                          (candidate) => candidate.id !== tag.id,
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
              <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">
                Media type
              </div>
              <SegmentedControl
                ariaLabel="Media type"
                value={mediaType}
                options={MEDIA_TYPES}
                onChange={(value) => setFilters({ mediaType: value })}
              />
            </div>

            <div>
              <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">
                Sort by
              </div>
              <SegmentedControl
                ariaLabel="Sort media"
                value={sortBy}
                options={SORT_OPTIONS}
                onChange={(value) => setFilters({ sortBy: value })}
              />
            </div>

            {hasActiveFilters && (
              <PanelButton className="w-full" onClick={clearFilters}>
                Clear all filters
              </PanelButton>
            )}
          </div>
        </PanelSection>

        {showItemTags && (
          <PanelSection ref={tagsSectionRef} title="This item's tags">
            <div className="space-y-3">
              {visibleMediaTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {visibleMediaTags.map((tag) => (
                    <StatusPill
                      key={tag.id}
                      color={tag.color || "#2563eb"}
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
          </PanelSection>
        )}
      </div>
    </ResponsivePanel>
  );
});

export default FilterPanel;
