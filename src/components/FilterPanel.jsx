import { memo, useCallback, useMemo } from "react";
import UnifiedSearchBar from "./UnifiedSearchBar";
import { byUsage } from "./TagsPanel";
import { Chip, PanelButton, SegmentedControl } from "./ui/Panel";
import { useMediaData } from "../context/MediaContext";

const MEDIA_TYPES = [
  { value: "all", label: "all" },
  { value: "photos", label: "photos" },
  { value: "videos", label: "videos" },
];

const SORT_OPTIONS = [
  { value: "random", label: "random" },
  { value: "date_added", label: "added" },
  { value: "date_created", label: "created" },
];

// What the feed and gallery show. Changes apply as you make them, and the
// stage beside the sheet updates live.
const FilterPanel = memo(function FilterPanel() {
  const { settings, setFilters, tags, mediaFiles } = useMediaData();
  const { search, selectedTags, excludedTags, mediaType, sortBy } = settings;

  const topTags = useMemo(() => [...tags].sort(byUsage).slice(0, 12), [tags]);

  const hasActiveFilters =
    mediaType !== "all" ||
    sortBy !== "random" ||
    selectedTags.length > 0 ||
    excludedTags.length > 0 ||
    Boolean(search?.trim());

  const without = (list, tag) => list.filter((t) => t.id !== tag.id);

  const clearFilters = useCallback(() => {
    setFilters({
      mediaType: "all",
      sortBy: "random",
      selectedTags: [],
      excludedTags: [],
      search: "",
    });
  }, [setFilters]);

  return (
    <div className="space-y-2.5">
      <UnifiedSearchBar
        tags={tags}
        selectedTags={selectedTags}
        excludedTags={excludedTags}
        search={search || ""}
        onTagsChange={(next) => setFilters({ selectedTags: next })}
        onExcludedChange={(next) => setFilters({ excludedTags: next })}
        onSearchChange={(value) => setFilters({ search: value })}
      />

      {/* Tap a tag to include it, tap again to clear. Excluded tags (typed
          as -name, or set in the URL) show struck through. */}
      {(topTags.length > 0 || excludedTags.length > 0) && (
        <div className="chips">
          {excludedTags.map((tag) => (
            <Chip
              key={`not-${tag.id}`}
              tone="not"
              onRemove={() =>
                setFilters({ excludedTags: without(excludedTags, tag) })
              }
              removeLabel={`Stop excluding ${tag.name}`}
              title={`Excluding ${tag.name}`}
            >
              {tag.name}
            </Chip>
          ))}
          {topTags.map((tag) => {
            const selected = selectedTags.some((t) => t.id === tag.id);
            return (
              <Chip
                key={tag.id}
                tone={selected ? "on" : "pill"}
                onClick={() =>
                  setFilters({
                    selectedTags: selected
                      ? without(selectedTags, tag)
                      : [...selectedTags, tag],
                  })
                }
              >
                {tag.name}
              </Chip>
            );
          })}
        </div>
      )}

      <SegmentedControl
        ariaLabel="Media type"
        value={mediaType}
        options={MEDIA_TYPES}
        onChange={(value) => setFilters({ mediaType: value })}
      />
      <SegmentedControl
        ariaLabel="Sort media"
        value={sortBy}
        options={SORT_OPTIONS}
        onChange={(value) => setFilters({ sortBy: value })}
      />

      <div className="flex h-7 items-center justify-between pl-1 text-xs text-white/45">
        <span>{mediaFiles.length.toLocaleString()} items</span>
        {hasActiveFilters && (
          <PanelButton
            variant="ghost"
            className="h-7 px-2"
            onClick={clearFilters}
          >
            clear
          </PanelButton>
        )}
      </div>
    </div>
  );
});

export default FilterPanel;
