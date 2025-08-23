import React, { useState } from "react";
import { CSSTransition } from "react-transition-group";

import TagFilter from "./TagFilter";
import GeneralFilter from "./GeneralFilter";
import TagManager from "./TagManager";
import useTags from "../hooks/useTags";

function SettingsPanel({
  isOpen,
  onClose,
  currentMediaType,
  onMediaTypeChange,
  onRescan,
  isScanning,
  allMediaFiles = [],
  currentMediaFiles = [],
  directoryName = "",
  selectedTags = [],
  excludedTags = [],
  onTagsChange,
  onExcludedTagsChange,
  onPathChange,
  onRegenerateThumbnails,
  isRegeneratingThumbnails = false,
  sortBy,
  onSortByChange,
  providerType = "local",
  pathSubstring = "",
}) {
  const [showTagManager, setShowTagManager] = useState(false);
  const { tags, createTag, updateTag, deleteTag } = useTags();

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
      // Remove deleted tag from current filters
      onTagsChange(selectedTags.filter((tag) => tag.id !== id));
      onExcludedTagsChange(excludedTags.filter((tag) => tag.id !== id));
    } catch (error) {
      console.error("Failed to delete tag:", error);
    }
  };

  return (
    <CSSTransition in={isOpen} timeout={300} classNames="fade" unmountOnExit>
      <div className="fixed inset-0 bg-black-shades-900 p-4 sm:p-6 text-gray-200 z-50 overflow-y-auto rounded-2xl">
        {/* Header with Close Button */}
        <div className="flex justify-between items-center mb-3 sm:mb-4 max-w-4xl mx-auto">
          <h3 className="text-base sm:text-lg font-semibold text-white m-0">
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
          {/* Statistics Section */}
          <div className="stats-section mb-3 sm:mb-4 p-2 sm:p-3 bg-black-shades-800 rounded-2xl">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <h4 className="text-sm sm:text-base font-medium text-white m-0">
                Media Library
              </h4>
            </div>

            {/* Directory/Server Info */}
            {directoryName && (
              <div className="mb-2 sm:mb-3 p-2 bg-black-shades-700 rounded-lg">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                  {providerType === "sb" ? "sb Server" : "Full Path"}
                </div>
                <div className="text-xs font-mono text-gray-200 break-all leading-tight">
                  {directoryName}
                </div>
                {providerType === "sb" && (
                  <div className="text-xs text-green-400 mt-1">
                    ✓ Connected to sb
                  </div>
                )}
              </div>
            )}

            {/* Current View Stats */}
            <div className="mb-2 sm:mb-3 p-2 bg-black-shades-700 rounded-lg">
              <div className="text-xs text-gray-300 uppercase tracking-wide mb-1">
                Currently Viewing
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm sm:text-base font-bold text-white">
                  {currentCount}
                </span>
                <span className="text-xs text-gray-300">
                  {getMediaTypeLabel(currentMediaType)}
                </span>
              </div>
            </div>

            {/* Total Stats Grid */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center mb-2 sm:mb-3">
              <div className="stat-item p-1.5 sm:p-2 bg-black-shades-700 rounded-lg">
                <div className="text-sm sm:text-base font-bold text-white">
                  {totalFiles}
                </div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">
                  Total
                </div>
              </div>
              <div className="stat-item p-1.5 sm:p-2 bg-black-shades-700 rounded-lg">
                <div className="text-sm sm:text-base font-bold text-gray-200">
                  {totalPhotos}
                </div>
                <div className="text-xs text-gray-300 uppercase tracking-wide">
                  Photos
                </div>
              </div>
              <div className="stat-item p-1.5 sm:p-2 bg-black-shades-700 rounded-lg">
                <div className="text-sm sm:text-base font-bold text-gray-200">
                  {totalVideos}
                </div>
                <div className="text-xs text-gray-300 uppercase tracking-wide">
                  Videos
                </div>
              </div>
            </div>

            {/* Visual Breakdown Bar */}
            {totalFiles > 0 && (
              <div>
                <div className="text-xs text-gray-400 mb-1">Distribution</div>
                <div className="flex h-1.5 bg-black-shades-600 rounded-full overflow-hidden">
                  <div
                    className="bg-white bg-opacity-60"
                    style={{ width: `${photoPercentage}%` }}
                    title={`Photos: ${photoPercentage}%`}
                  />
                  <div
                    className="bg-gray-400 bg-opacity-80"
                    style={{ width: `${videoPercentage}%` }}
                    title={`Videos: ${videoPercentage}%`}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>📸 {photoPercentage}%</span>
                  <span>🎥 {videoPercentage}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Media Type Filter Section */}
          <div className="filter-section mb-3 sm:mb-4">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <h4 className="text-sm sm:text-base font-medium text-white m-0">
                Media Type
              </h4>
            </div>

            <div className="media-type-selector flex gap-1.5 sm:gap-2">
              <button
                onClick={() => onMediaTypeChange("all")}
                className={getButtonClass("all")}
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="opacity-80 text-xs sm:text-sm">🎭</span>
                  <span className="text-xs sm:text-sm">All</span>
                </div>
              </button>
              <button
                onClick={() => onMediaTypeChange("photos")}
                className={getButtonClass("photos")}
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="opacity-80 text-xs sm:text-sm">📸</span>
                  <span className="text-xs sm:text-sm">Photos</span>
                </div>
              </button>
              <button
                onClick={() => onMediaTypeChange("videos")}
                className={getButtonClass("videos")}
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="opacity-80 text-xs sm:text-sm">🎥</span>
                  <span className="text-xs sm:text-sm">Videos</span>
                </div>
              </button>
            </div>
          </div>

          {/* Sort By Options */}
          <div className="filter-section mb-3 sm:mb-4">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <h4 className="text-sm sm:text-base font-medium text-white m-0">
                Sort By
              </h4>
            </div>
            <div className="media-type-selector flex gap-1.5 sm:gap-2">
              <button
                onClick={() => onSortByChange("random")}
                className={getSortButtonClass("random")}
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="text-xs sm:text-sm">Random</span>
                </div>
              </button>
              <button
                onClick={() => onSortByChange("date_added")}
                className={getSortButtonClass("date_added")}
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="text-xs sm:text-sm">Date Added</span>
                </div>
              </button>
              <button
                onClick={() => onSortByChange("date_created")}
                className={getSortButtonClass("date_created")}
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="text-xs sm:text-sm">Date Created</span>
                </div>
              </button>
            </div>
          </div>

          {/* Tag Filter Section */}
          <div className="tag-filter-section mb-3 sm:mb-4 p-2 sm:p-3 bg-black bg-opacity-40 backdrop-blur-sm rounded-2xl z-10 relative">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <h4 className="text-sm sm:text-base font-medium text-white m-0">
                Tag Filters
              </h4>
            </div>

            <TagFilter
              tags={tags}
              selectedTags={selectedTags}
              excludedTags={excludedTags}
              onTagsChange={onTagsChange}
              onExcludedTagsChange={onExcludedTagsChange}
            />
          </div>

          {/* General Filter Section */}
          <div className="general-filter-section mb-3 sm:mb-4 p-2 sm:p-3 bg-black bg-opacity-40 backdrop-blur-sm rounded-2xl">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <h4 className="text-sm sm:text-base font-medium text-white m-0">
                General Filter
              </h4>
            </div>
            <GeneralFilter
              onFilterChange={onPathChange}
              initialValue={pathSubstring || ""}
            />
          </div>

          {/* Actions Section */}
          <div className="actions-section mb-6">
            {providerType === "local" && (
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <h4 className="text-sm sm:text-base font-medium text-white m-0">
                  Actions
                </h4>
              </div>
            )}

            <div className="space-y-2">
              {/* Tag Manager - Only for Local proivder */}
              {providerType === "local" && (
                <button
                  onClick={() => setShowTagManager(true)}
                  className="w-full flex items-center justify-center gap-2 border-none py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl cursor-pointer text-xs sm:text-sm font-medium transition-all duration-200 ease-in-out active:scale-95 bg-black bg-opacity-50 hover:bg-white hover:bg-opacity-20 text-white shadow-lg hover:shadow-xl"
                >
                  <span>Manage Tags</span>
                </button>
              )}

              {/* Rescan Directory - Only for Local proivder */}
              {providerType === "local" && (
                <button
                  onClick={onRescan}
                  disabled={isScanning || isRegeneratingThumbnails}
                  className={`rescan-btn w-full flex items-center justify-center gap-2 border-none py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl cursor-pointer text-xs sm:text-sm font-medium transition-all duration-200 ease-in-out active:scale-95 ${isScanning || isRegeneratingThumbnails
                      ? "bg-black bg-opacity-50 text-gray-500 cursor-not-allowed opacity-50"
                      : "bg-black bg-opacity-50 hover:bg-white hover:bg-opacity-20 text-white shadow-lg hover:shadow-xl"
                    }`}
                >
                  {isScanning ? (
                    <>
                      <div className="animate-spin w-3 h-3 sm:w-4 sm:h-4 border-2 border-gray-500 border-t-transparent rounded-full"></div>
                      <span>Scanning...</span>
                    </>
                  ) : (
                    <>
                      <span>Rescan Directory</span>
                    </>
                  )}
                </button>
              )}

              {/* Regenerate Thumbnails - Only for Local proivder */}
              {providerType === "local" && (
                <button
                  onClick={onRegenerateThumbnails}
                  disabled={isScanning || isRegeneratingThumbnails}
                  className={`w-full flex items-center justify-center gap-2 border-none py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl cursor-pointer text-xs sm:text-sm font-medium transition-all duration-200 ease-in-out active:scale-95 ${isScanning || isRegeneratingThumbnails
                      ? "bg-black bg-opacity-50 text-gray-500 cursor-not-allowed opacity-50"
                      : "bg-black bg-opacity-50 hover:bg-white hover:bg-opacity-20 text-white shadow-lg hover:shadow-xl"
                    }`}
                >
                  {isRegeneratingThumbnails ? (
                    <>
                      <div className="animate-spin w-3 h-3 sm:w-4 sm:h-4 border-2 border-gray-500 border-t-transparent rounded-full"></div>
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <span>Regenerate All Thumbnails</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tag Manager Modal - Only for local provider */}
        {showTagManager && providerType === "local" && (
          <TagManager
            tags={tags}
            onCreateTag={handleCreateTag}
            onUpdateTag={handleUpdateTag}
            onDeleteTag={handleDeleteTag}
            onClose={() => setShowTagManager(false)}
          />
        )}
      </div>
    </CSSTransition>
  );
}

export default SettingsPanel;
