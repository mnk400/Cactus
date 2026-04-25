import { useState, useEffect, useCallback, useMemo, memo } from "react";
import VideoProgressBar from "./VideoProgressBar";
import UnifiedSearchBar from "./UnifiedSearchBar";
import InlineTagPanel from "./InlineTagPanel";
import TagDisplay from "./TagDisplay";
import useDisplayName from "../hooks/useDisplayName";
import { useCurrentMedia, useMediaData } from "../context/MediaContext";

const Navigation = memo(function Navigation({
  onToggleSettings,
  onToggleTagPanel,
  isTagPanelExpanded = false,
  directoryName,
  isFavorited,
  onToggleFavorite,
}) {
  const { currentMediaFile } = useCurrentMedia();
  const { toggleGallery, settings, setFilters, tags } = useMediaData();

  const {
    galleryView: isGalleryView,
    search,
    selectedTags,
    excludedTags,
    mediaType,
    sortBy,
  } = settings;
  const [videoElement, setVideoElement] = useState(null);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const isSearchPanelVisible = isFilterPanelOpen && !isTagPanelExpanded;
  const hasExpandedPanel = isSearchPanelVisible || isTagPanelExpanded;

  // Video element finder
  const findActiveVideo = useCallback(() => {
    if (currentMediaFile?.media_type !== "video") {
      setVideoElement(null);
      return;
    }

    // Method 1: Find by checking which container is in the center of viewport
    const containers = document.querySelectorAll(".media-item-container");
    const viewportHeight = window.innerHeight;
    const centerY = viewportHeight / 2;

    for (const container of containers) {
      const rect = container.getBoundingClientRect();
      const containerCenterY = rect.top + rect.height / 2;
      if (Math.abs(containerCenterY - centerY) < 100) {
        const video = container.querySelector("video");
        if (video) {
          setVideoElement(video);
          return;
        }
      }
    }

    // Method 2: Find the video that's currently playing
    const allVideos = document.querySelectorAll(".media-item video");
    for (const video of allVideos) {
      if (!video.paused) {
        setVideoElement(video);
        return;
      }
    }

    // Method 3: Find any video in a visible container
    for (const container of containers) {
      const rect = container.getBoundingClientRect();
      if (rect.top < viewportHeight && rect.bottom > 0) {
        const video = container.querySelector("video");
        if (video) {
          setVideoElement(video);
          return;
        }
      }
    }

    setVideoElement(null);
  }, [currentMediaFile]);

  useEffect(() => {
    if (currentMediaFile?.media_type === "video") {
      // Single delayed call — gives the video DOM element time to mount
      const timeout = setTimeout(findActiveVideo, 100);
      return () => clearTimeout(timeout);
    } else {
      queueMicrotask(() => setVideoElement(null));
    }
  }, [currentMediaFile, findActiveVideo]);

  // Use provider-based display name computation
  const { displayName } = useDisplayName(currentMediaFile, directoryName);
  const isVideoPlaying = currentMediaFile?.media_type === "video";

  const activeFilterTags = useMemo(() => {
    const chips = [];

    selectedTags.forEach((tag) => {
      chips.push({
        id: `include:${tag.id}`,
        name: `Tag: ${tag.name}`,
        color: tag.color || "#2563eb",
      });
    });

    excludedTags.forEach((tag) => {
      chips.push({
        id: `exclude:${tag.id}`,
        name: `Not: ${tag.name}`,
        color: "#4b5563",
      });
    });

    if (mediaType !== "all") {
      chips.push({
        id: "mediaType",
        name: mediaType === "photos" ? "Photos only" : "Videos only",
        color: "#1f2937",
      });
    }

    if (sortBy !== "random") {
      chips.push({
        id: "sortBy",
        name: `Sort: ${sortBy === "date_added" ? "Date Added" : "Date Created"}`,
        color: "#1f2937",
      });
    }

    return chips;
  }, [selectedTags, excludedTags, mediaType, sortBy]);

  const hasActiveFilters =
    Boolean(search?.trim()) ||
    selectedTags.length > 0 ||
    excludedTags.length > 0 ||
    mediaType !== "all" ||
    sortBy !== "random";

  const handleRemoveFilterChip = useCallback(
    (chipId) => {
      if (chipId === "mediaType") {
        setFilters({ mediaType: "all" });
        return;
      }

      if (chipId === "sortBy") {
        setFilters({ sortBy: "random" });
        return;
      }

      if (chipId.startsWith("include:")) {
        const tagId = Number(chipId.split(":")[1]);
        setFilters({
          selectedTags: selectedTags.filter((tag) => tag.id !== tagId),
        });
        return;
      }

      if (chipId.startsWith("exclude:")) {
        const tagId = Number(chipId.split(":")[1]);
        setFilters({
          excludedTags: excludedTags.filter((tag) => tag.id !== tagId),
        });
      }
    },
    [setFilters, selectedTags, excludedTags],
  );

  const handleClearAllFilters = useCallback(() => {
    setFilters({
      mediaType: "all",
      sortBy: "random",
      selectedTags: [],
      excludedTags: [],
      search: "",
    });
  }, [setFilters]);

  const handleToggleTagPanel = useCallback(() => {
    setIsFilterPanelOpen(false);
    onToggleTagPanel();
  }, [onToggleTagPanel]);

  const handleToggleSearchPanel = useCallback(() => {
    setIsFilterPanelOpen((prev) => {
      const currentlyVisible = prev && !isTagPanelExpanded;
      const next = !currentlyVisible;
      if (next) onToggleTagPanel(false);
      return next;
    });
  }, [onToggleTagPanel, isTagPanelExpanded]);

  return (
    <div
      className={`navigation w-full flex flex-col justify-end bg-black-shades-1000 transition-all duration-300 pt-3`}
      style={{
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))",
      }}
    >
      <div
        className={`w-full overflow-hidden transition-all duration-300 px-4 ${isVideoPlaying && !isGalleryView ? "max-h-8 mb-2" : "max-h-0"}`}
      >
        <VideoProgressBar videoElement={videoElement} />
      </div>
      {hasActiveFilters && (
        <div className="w-full px-4 mb-2">
          <TagDisplay tags={activeFilterTags} onRemoveTag={handleRemoveFilterChip} />
        </div>
      )}
      {/* Unified expansion slot — any expanding panel goes here */}
      <div
        className={`w-full transition-all duration-300 ease-in-out px-4 ${
          hasExpandedPanel
            ? "overflow-visible opacity-100 mb-2"
            : "max-h-0 overflow-hidden opacity-0"
        }`}
        style={{ maxHeight: hasExpandedPanel ? '50vh' : '0px' }}
      >
        {isSearchPanelVisible && (
          <div className="space-y-2">
            <UnifiedSearchBar
              tags={tags}
              selectedTags={selectedTags}
              excludedTags={excludedTags}
              search={search || ""}
              onTagsChange={(nextTags) => setFilters({ selectedTags: nextTags })}
              onSearchChange={(value) => setFilters({ search: value })}
              dropdownPosition="top"
            />
            {hasActiveFilters && (
              <button
                onClick={handleClearAllFilters}
                className="w-full bg-black-shades-700 text-gray-200 border-none px-3 py-2 rounded-xl cursor-pointer transition-all duration-200 ease-in-out hover:bg-white hover:bg-opacity-20 active:scale-95 text-sm font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
        {isTagPanelExpanded && (
          <InlineTagPanel
            currentMediaFile={currentMediaFile}
            isExpanded={isTagPanelExpanded}
            onToggleExpanded={onToggleTagPanel}
            mode="input"
          />
        )}
      </div>
      <div className="w-full flex items-center justify-between px-4 gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleFavorite}
            className="nav-button bg-black-shades-700 text-gray-200 border-none p-2 rounded-xl cursor-pointer transition-all duration-200 ease-in-out hover:bg-white hover:bg-opacity-20 active:scale-95 min-w-10 min-h-10 flex items-center justify-center"
            title={isFavorited ? "Remove from favorites" : "Add to favorites"}
          >
            {isFavorited ? (
              <svg
                className="w-4 h-4 text-red-400"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            ) : (
              <svg
                className="w-4 h-4 text-gray-200"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                />
              </svg>
            )}
          </button>

          <button
            onClick={handleToggleTagPanel}
            className={`nav-button border-none p-2 rounded-xl cursor-pointer transition-all duration-200 ease-in-out active:scale-95 min-w-10 min-h-10 flex items-center justify-center ${
              isTagPanelExpanded
                ? "bg-white bg-opacity-20 text-white"
                : "bg-black-shades-700 text-gray-200 hover:bg-white hover:bg-opacity-20"
            }`}
            title="Add tags (T)"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
          </button>

          <button
            onClick={handleToggleSearchPanel}
            className={`nav-button border-none p-2 rounded-xl cursor-pointer transition-all duration-200 ease-in-out active:scale-95 min-w-10 min-h-10 flex items-center justify-center ${
              isSearchPanelVisible
                ? "bg-white bg-opacity-20 text-white"
                : "bg-black-shades-700 text-gray-200 hover:bg-white hover:bg-opacity-20"
            }`}
            title="Search and filters"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
          </button>

          <button
            onClick={toggleGallery}
            className="nav-button bg-black-shades-700 text-gray-200 border-none p-2 rounded-xl cursor-pointer transition-all duration-200 ease-in-out hover:bg-white hover:bg-opacity-20 active:scale-95 min-w-10 min-h-10 flex items-center justify-center"
            title="Gallery View"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <button
            onClick={onToggleSettings}
            className="nav-button bg-black-shades-700 text-gray-200 border-none p-2 rounded-xl cursor-pointer transition-all duration-200 ease-in-out hover:bg-white hover:bg-opacity-20 active:scale-95 min-w-10 min-h-10 flex items-center justify-center"
          >
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
        </div>

        <div
          className="media-source-info text-gray-200 text-base whitespace-nowrap overflow-hidden text-ellipsis cursor-pointer hover:text-blue-400 transition-colors duration-200 active:scale-95"
          title={`Click to filter by: ${displayName}`}
          onClick={() => setFilters({ search: displayName })}
        >
          {displayName}
        </div>
      </div>
    </div>
  );
});

export default Navigation;
