import { useState, useEffect, useCallback, memo } from "react";
import TagFilter from "./TagFilter";
import GeneralFilter from "./GeneralFilter";
import TagManager from "./TagManager";
import { useMediaData, useSlideshowState } from "../context/MediaContext";
import { isMobile } from "../utils/helpers";

const SettingsPanel = memo(function SettingsPanel({ isOpen, onClose }) {
  const [showTagManager, setShowTagManager] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  const { slideshowSpeed, startSlideshow, setSlideshowSpeed } =
    useSlideshowState();

  const {
    settings,
    allMediaFiles,
    mediaFiles: currentMediaFiles,
    isScanning,
    isRegeneratingThumbnails,
    setFilters,
    rescan,
    regenerateThumbnails,
    config,
    configLoading,
    canRescan,
    canRegenerateThumbnails,
    canManageTags,
    ui,
    tags,
    createTag,
    updateTag,
    deleteTag,
  } = useMediaData();

  const {
    mediaType: currentMediaType,
    selectedTags,
    excludedTags,
    search,
    sortBy,
  } = settings;

  // Statistics
  const totalFiles = allMediaFiles.length;
  const totalPhotos = allMediaFiles.filter(
    (file) => file.media_type === "image",
  ).length;
  const totalVideos = allMediaFiles.filter(
    (file) => file.media_type === "video",
  ).length;
  const currentCount = currentMediaFiles.length;
  const photoPercentage =
    totalFiles > 0 ? Math.round((totalPhotos / totalFiles) * 100) : 0;
  const videoPercentage =
    totalFiles > 0 ? Math.round((totalVideos / totalFiles) * 100) : 0;

  const hasActiveFilters =
    currentMediaType !== "all" ||
    sortBy !== "random" ||
    selectedTags.length > 0 ||
    excludedTags.length > 0 ||
    (search && search.length > 0);

  const getToggleClass = (isActive) => {
    const base =
      "flex-1 border-none py-2 px-3 rounded-xl cursor-pointer text-sm font-medium transition-colors duration-200 ease-in-out active:scale-95";
    return isActive
      ? `${base} bg-white bg-opacity-20 text-white shadow-lg`
      : `${base} bg-black bg-opacity-50 hover:bg-white hover:bg-opacity-20 text-gray-300`;
  };

  const handleCreateTag = async (name, color) => {
    try {
      await createTag(name, color);
    } catch (error) {
      console.error("Failed to create tag:", error);
    }
  };

  const handleUpdateTag = async (id, name, color) => {
    try {
      await updateTag(id, name, color);
    } catch (error) {
      console.error("Failed to update tag:", error);
    }
  };

  const handleDeleteTag = async (id) => {
    try {
      await deleteTag(id);
      setFilters({
        selectedTags: selectedTags.filter((tag) => tag.id !== id),
        excludedTags: excludedTags.filter((tag) => tag.id !== id),
      });
    } catch (error) {
      console.error("Failed to delete tag:", error);
    }
  };

  const handleTagsChange = useCallback(
    (tags) => setFilters({ selectedTags: tags }),
    [setFilters],
  );

  const handleExcludedTagsChange = useCallback(
    (tags) => setFilters({ excludedTags: tags }),
    [setFilters],
  );

  const handleFilterChange = useCallback(
    (value) => setFilters({ search: value }),
    [setFilters],
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

  const directoryName =
    config?.provider?.config?.directoryPath ||
    config?.provider?.config?.sbUrl ||
    "";

  const isDesktop = !isMobile();

  // Handle animation timing for desktop drawer
  useEffect(() => {
    if (isDesktop && isOpen) {
      queueMicrotask(() => setShouldAnimate(false));
      requestAnimationFrame(() => {
        setShouldAnimate(true);
      });
    } else if (isDesktop && !isOpen) {
      queueMicrotask(() => setShouldAnimate(false));
    }
  }, [isOpen, isDesktop]);

  if (!isOpen && !isDesktop) return null;

  return (
    <div
      className={`fixed bg-black-shades-900 px-4 py-4 md:p-6 text-gray-200 z-50 overflow-y-auto safe-area-top safe-area-bottom ${
        isDesktop ? "top-0 right-0 bottom-0 w-[420px] lg:w-[450px]" : "inset-0"
      }`}
      style={
        isDesktop
          ? {
              paddingTop: "1rem",
              transform: shouldAnimate ? "translateX(0)" : "translateX(100%)",
              transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
              pointerEvents: isOpen ? "auto" : "none",
            }
          : {}
      }
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4 max-w-4xl mx-auto">
        <h3 className="text-lg font-semibold text-white m-0">Settings</h3>
        <button
          onClick={() => onClose()}
          className="px-3 py-1 bg-red-400 text-white rounded-xl hover:bg-red-500 transition-colors duration-200"
          aria-label="Close settings"
        >
          Close
        </button>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Library Overview — collapsible */}
        <div className="mb-4 p-3 bg-black-shades-800 rounded-2xl">
          <button
            onClick={() => setShowLibrary((prev) => !prev)}
            className="w-full flex items-center justify-between text-left"
          >
            <h4 className="text-base font-medium text-white m-0">
              Library Overview
            </h4>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showLibrary ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showLibrary && (
            <div className="mt-3">
              {ui.showDirectoryInfo && directoryName && (
                <div className="mb-3 p-2 bg-black-shades-700 rounded-lg">
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                    {ui.directoryLabel || "Directory"}
                  </div>
                  <div className="text-xs font-mono text-gray-200 break-all leading-tight">
                    {directoryName}
                  </div>
                  {ui.showConnectionStatus && (
                    <div className="text-xs text-green-400 mt-1">
                      ✓ Connected
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div className="p-2 bg-black-shades-700 rounded-lg">
                  <div className="text-base font-bold text-white">
                    {totalFiles}
                  </div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">
                    Total
                  </div>
                </div>
                <div className="p-2 bg-black-shades-700 rounded-lg">
                  <div className="text-base font-bold text-gray-200">
                    {totalPhotos}
                  </div>
                  <div className="text-xs text-gray-300 uppercase tracking-wide">
                    Photos
                  </div>
                </div>
                <div className="p-2 bg-black-shades-700 rounded-lg">
                  <div className="text-base font-bold text-gray-200">
                    {totalVideos}
                  </div>
                  <div className="text-xs text-gray-300 uppercase tracking-wide">
                    Videos
                  </div>
                </div>
              </div>

              {totalFiles > 0 && (
                <div>
                  <div className="flex h-1.5 bg-black-shades-600 rounded-full overflow-hidden">
                    <div
                      className="bg-white bg-opacity-60"
                      style={{ width: `${photoPercentage}%` }}
                    />
                    <div
                      className="bg-black-shades-400 bg-opacity-80"
                      style={{ width: `${videoPercentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Photos {photoPercentage}%</span>
                    <span>Videos {videoPercentage}%</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="mb-4 p-3 bg-black-shades-800 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-base font-medium text-white m-0">Filters</h4>
            <span className="text-xs text-gray-400">
              Viewing {currentCount} of {totalFiles}
            </span>
          </div>

          {/* Search */}
          <div className="mb-4">
            <GeneralFilter
              onFilterChange={handleFilterChange}
              initialValue={search || ""}
              placeholder="Search by path, folder..."
            />
          </div>

          {/* Tags */}
          <div className="mb-4">
            <TagFilter
              tags={tags}
              selectedTags={selectedTags}
              excludedTags={excludedTags}
              onTagsChange={handleTagsChange}
              onExcludedTagsChange={handleExcludedTagsChange}
            />
          </div>

          {/* Media Type */}
          <div className="mb-4">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">
              Media Type
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilters({ mediaType: "all" })}
                className={getToggleClass(currentMediaType === "all")}
              >
                All
              </button>
              <button
                onClick={() => setFilters({ mediaType: "photos" })}
                className={getToggleClass(currentMediaType === "photos")}
              >
                Photos
              </button>
              <button
                onClick={() => setFilters({ mediaType: "videos" })}
                className={getToggleClass(currentMediaType === "videos")}
              >
                Videos
              </button>
            </div>
          </div>

          {/* Sort By */}
          <div className="mb-4">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">
              Sort By
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilters({ sortBy: "random" })}
                className={getToggleClass(sortBy === "random")}
              >
                Random
              </button>
              <button
                onClick={() => setFilters({ sortBy: "date_added" })}
                className={getToggleClass(sortBy === "date_added")}
              >
                Date Added
              </button>
              <button
                onClick={() => setFilters({ sortBy: "date_created" })}
                className={getToggleClass(sortBy === "date_created")}
              >
                Date Created
              </button>
            </div>
          </div>

          {/* Clear All */}
          {hasActiveFilters && (
            <button
              onClick={handleClearAllFilters}
              className="w-full px-3 py-2 text-sm bg-black-shades-700 hover:bg-white hover:bg-opacity-20 text-gray-200 rounded-xl transition-all duration-200 ease-in-out"
            >
              Clear All Filters
            </button>
          )}
        </div>

        {/* Slideshow */}
        <div className="mb-4 p-3 bg-black-shades-800 rounded-2xl">
          <h4 className="text-base font-medium text-white mb-3">Slideshow</h4>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                Speed
              </div>
              <div className="flex gap-2">
                {["slow", "normal", "fast"].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setSlideshowSpeed(speed)}
                    className={getToggleClass(slideshowSpeed === speed)}
                  >
                    {speed.charAt(0).toUpperCase() + speed.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                setTimeout(() => startSlideshow(), 300);
              }}
              className="w-full py-2.5 rounded-xl bg-white bg-opacity-15 text-white hover:bg-opacity-25 transition-colors duration-200 font-medium"
            >
              Start Slideshow
            </button>
            <div className="text-xs text-gray-500 text-center">
              Press S to toggle slideshow
            </div>
          </div>
        </div>

        {/* Actions */}
        {!configLoading &&
          (canManageTags || canRescan || canRegenerateThumbnails) && (
            <div className="mb-6">
              <h4 className="text-base font-medium text-white mb-3">Actions</h4>
              <div className="space-y-2">
                {canManageTags && (
                  <button
                    onClick={() => setShowTagManager(true)}
                    className="w-full py-2.5 rounded-xl bg-black bg-opacity-50 text-white hover:bg-opacity-20 transition-colors duration-200"
                  >
                    Manage Tags
                  </button>
                )}
                {canRescan && (
                  <button
                    onClick={rescan}
                    disabled={isScanning}
                    className="w-full py-2.5 rounded-xl bg-black bg-opacity-50 text-white hover:bg-opacity-20 transition-colors duration-200"
                  >
                    {isScanning ? "Scanning..." : "Rescan Directory"}
                  </button>
                )}
                {canRegenerateThumbnails && (
                  <button
                    onClick={regenerateThumbnails}
                    disabled={isRegeneratingThumbnails}
                    className="w-full py-2.5 rounded-xl bg-black bg-opacity-50 text-white hover:bg-opacity-20 transition-colors duration-200"
                  >
                    {isRegeneratingThumbnails
                      ? "Generating..."
                      : "Regenerate All Thumbnails"}
                  </button>
                )}
              </div>
            </div>
          )}
      </div>

      {showTagManager && canManageTags && (
        <TagManager
          tags={tags}
          onCreateTag={handleCreateTag}
          onUpdateTag={handleUpdateTag}
          onDeleteTag={handleDeleteTag}
          onClose={() => setShowTagManager(false)}
        />
      )}
    </div>
  );
});

export default SettingsPanel;
