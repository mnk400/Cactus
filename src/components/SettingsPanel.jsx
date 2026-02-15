import { useState, useEffect, memo } from "react";
import TagFilter from "./TagFilter";
import GeneralFilter from "./GeneralFilter";
import TagManager from "./TagManager";
import { useMediaData, useSlideshowState } from "../context/MediaContext";
import { isMobile } from "../utils/helpers";

const SettingsPanel = memo(function SettingsPanel({ isOpen, onClose }) {
  const [showTagManager, setShowTagManager] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);

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
    pathFilter,
    sortBy,
  } = settings;

  // Calculate statistics
  const totalFiles = allMediaFiles.length;
  const totalPhotos = allMediaFiles.filter(
    (file) => file.media_type === "image",
  ).length;
  const totalVideos = allMediaFiles.filter(
    (file) => file.media_type === "video",
  ).length;
  const currentCount = currentMediaFiles.length;

  // Calculate percentages for visual representation
  const photoPercentage =
    totalFiles > 0 ? Math.round((totalPhotos / totalFiles) * 100) : 0;
  const videoPercentage =
    totalFiles > 0 ? Math.round((totalVideos / totalFiles) * 100) : 0;

  const getSortButtonClass = (sortOption) => {
    const baseClass =
      "media-type-btn flex-1 border-none py-2 px-3 rounded-xl cursor-pointer text-sm font-medium transition-all duration-200 ease-in-out active:scale-95";

    if (sortBy === sortOption) {
      return `${baseClass} bg-white bg-opacity-20 text-white shadow-lg`;
    }
    return `${baseClass} bg-black bg-opacity-50 hover:bg-white hover:bg-opacity-20 text-gray-300`;
  };

  const getButtonClass = (mediaType) => {
    const baseClass =
      "media-type-btn flex-1 border-none py-2 px-3 rounded-xl cursor-pointer text-sm font-medium transition-all duration-200 ease-in-out active:scale-95";

    if (currentMediaType === mediaType) {
      return `${baseClass} bg-white bg-opacity-20 text-white shadow-lg`;
    }
    return `${baseClass} bg-black bg-opacity-50 hover:bg-white hover:bg-opacity-20 text-gray-300`;
  };

  const getMediaTypeLabel = (type) => {
    switch (type) {
      case "photos":
        return "Photos Only";
      case "videos":
        return "Videos Only";
      default:
        return "All Media";
    }
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

  const directoryName =
    config?.provider?.config?.directoryPath ||
    config?.provider?.config?.sbUrl ||
    "";

  const isDesktop = !isMobile();

  // Handle animation timing for desktop drawer
  useEffect(() => {
    if (isDesktop && isOpen) {
      // Start off-screen, then animate in after a frame
      queueMicrotask(() => setShouldAnimate(false));
      requestAnimationFrame(() => {
        setShouldAnimate(true);
      });
    } else if (isDesktop && !isOpen) {
      queueMicrotask(() => setShouldAnimate(false));
    }
  }, [isOpen, isDesktop]);

  // Mobile: return null when closed (handled by ViewTransition)
  // Desktop: always render (with transform animation)
  if (!isOpen && !isDesktop) return null;

  return (
    <div
      className={`fixed bg-black-shades-900 p-6 text-gray-200 z-50 overflow-y-auto ${
        isDesktop ? "top-0 right-0 bottom-0 w-[420px] lg:w-[450px]" : "inset-0"
      }`}
      style={
        isDesktop
          ? {
              transform: shouldAnimate ? "translateX(0)" : "translateX(100%)",
              transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
              pointerEvents: isOpen ? "auto" : "none",
            }
          : {}
      }
    >
      <div className="flex justify-between items-center mb-4 max-w-4xl mx-auto">
        <h3 className="text-lg font-semibold text-white m-0">
          Settings & Stats
        </h3>
        <button
          onClick={() => onClose()}
          className="px-3 py-1 bg-red-400 text-white rounded-lg hover:bg-red-500 transition-colors duration-200"
          aria-label="Close settings"
        >
          Close
        </button>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="stats-section mb-4 p-3 bg-black-shades-800 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-base font-medium text-white m-0">
              Media Library
            </h4>
          </div>

          {ui.showDirectoryInfo && directoryName && (
            <div className="mb-3 p-2 bg-black-shades-700 rounded-lg">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                {ui.directoryLabel || "Directory"}
              </div>
              <div className="text-xs font-mono text-gray-200 break-all leading-tight">
                {directoryName}
              </div>
              {ui.showConnectionStatus && (
                <div className="text-xs text-green-400 mt-1">✓ Connected</div>
              )}
            </div>
          )}

          <div className="mb-3 p-2 bg-black-shades-700 rounded-lg">
            <div className="text-xs text-gray-300 uppercase tracking-wide mb-1">
              Currently Viewing
            </div>
            <div className="flex justify-between items-center">
              <span className="text-base font-bold text-white">
                {currentCount}
              </span>
              <span className="text-xs text-gray-300">
                {getMediaTypeLabel(currentMediaType)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <div className="stat-item p-2 bg-black-shades-700 rounded-lg">
              <div className="text-base font-bold text-white">{totalFiles}</div>
              <div className="text-xs text-gray-400 uppercase tracking-wide">
                Total
              </div>
            </div>
            <div className="stat-item p-2 bg-black-shades-700 rounded-lg">
              <div className="text-base font-bold text-gray-200">
                {totalPhotos}
              </div>
              <div className="text-xs text-gray-300 uppercase tracking-wide">
                Photos
              </div>
            </div>
            <div className="stat-item p-2 bg-black-shades-700 rounded-lg">
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
              <div className="text-xs text-gray-400 mb-1">Distribution</div>
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
                <span>📸 {photoPercentage}%</span>
                <span>🎥 {videoPercentage}%</span>
              </div>
            </div>
          )}
        </div>

        <div className="filter-section mb-4">
          <h4 className="text-base font-medium text-white mb-3">Media Type</h4>
          <div className="media-type-selector flex gap-2">
            <button
              onClick={() => setFilters({ mediaType: "all" })}
              className={getButtonClass("all")}
            >
              All
            </button>
            <button
              onClick={() => setFilters({ mediaType: "photos" })}
              className={getButtonClass("photos")}
            >
              Photos
            </button>
            <button
              onClick={() => setFilters({ mediaType: "videos" })}
              className={getButtonClass("videos")}
            >
              Videos
            </button>
          </div>
        </div>

        <div className="filter-section mb-4">
          <h4 className="text-base font-medium text-white mb-3">Sort By</h4>
          <div className="media-type-selector flex gap-2">
            <button
              onClick={() => setFilters({ sortBy: "random" })}
              className={getSortButtonClass("random")}
            >
              Random
            </button>
            <button
              onClick={() => setFilters({ sortBy: "date_added" })}
              className={getSortButtonClass("date_added")}
            >
              Date Added
            </button>
            <button
              onClick={() => setFilters({ sortBy: "date_created" })}
              className={getSortButtonClass("date_created")}
            >
              Date Created
            </button>
          </div>
        </div>

        <div className="tag-filter-section mb-4 p-3 bg-black bg-opacity-40 rounded-2xl">
          <h4 className="text-base font-medium text-white mb-3">Tag Filters</h4>
          <TagFilter
            tags={tags}
            selectedTags={selectedTags}
            excludedTags={excludedTags}
            onTagsChange={(tags) => setFilters({ selectedTags: tags })}
            onExcludedTagsChange={(tags) => setFilters({ excludedTags: tags })}
          />
        </div>

        <div className="general-filter-section mb-4 p-3 bg-black bg-opacity-40 rounded-2xl">
          <h4 className="text-base font-medium text-white mb-3">
            General Filter
          </h4>
          <GeneralFilter
            onFilterChange={(path) => setFilters({ pathFilter: path })}
            initialValue={pathFilter || ""}
          />
        </div>

        <div className="slideshow-section mb-4 p-3 bg-black bg-opacity-40 rounded-2xl">
          <h4 className="text-base font-medium text-white mb-3">Slideshow</h4>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                Speed
              </div>
              <div className="media-type-selector flex gap-2">
                {["slow", "normal", "fast"].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setSlideshowSpeed(speed)}
                    className={`media-type-btn flex-1 border-none py-2 px-3 rounded-xl cursor-pointer text-sm font-medium transition-all duration-200 ease-in-out active:scale-95 ${
                      slideshowSpeed === speed
                        ? "bg-white bg-opacity-20 text-white shadow-lg"
                        : "bg-black bg-opacity-50 hover:bg-white hover:bg-opacity-20 text-gray-300"
                    }`}
                  >
                    {speed.charAt(0).toUpperCase() + speed.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                // Small delay to let the settings panel close before entering fullscreen
                setTimeout(() => startSlideshow(), 300);
              }}
              className="w-full py-2.5 rounded-xl bg-white bg-opacity-15 text-white hover:bg-opacity-25 transition-all font-medium"
            >
              Start Slideshow
            </button>
            <div className="text-xs text-gray-500 text-center">
              Press S to toggle slideshow
            </div>
          </div>
        </div>

        {!configLoading &&
          (canManageTags || canRescan || canRegenerateThumbnails) && (
            <div className="actions-section mb-6">
              <h4 className="text-base font-medium text-white mb-3">Actions</h4>
              <div className="space-y-2">
                {canManageTags && (
                  <button
                    onClick={() => setShowTagManager(true)}
                    className="w-full py-2.5 rounded-xl bg-black bg-opacity-50 text-white hover:bg-opacity-20 transition-all"
                  >
                    Manage Tags
                  </button>
                )}
                {canRescan && (
                  <button
                    onClick={rescan}
                    disabled={isScanning}
                    className="w-full py-2.5 rounded-xl bg-black bg-opacity-50 text-white hover:bg-opacity-20 transition-all"
                  >
                    {isScanning ? "Scanning..." : "Rescan Directory"}
                  </button>
                )}
                {canRegenerateThumbnails && (
                  <button
                    onClick={regenerateThumbnails}
                    disabled={isRegeneratingThumbnails}
                    className="w-full py-2.5 rounded-xl bg-black bg-opacity-50 text-white hover:bg-opacity-20 transition-all"
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
