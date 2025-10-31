import { useState, useEffect, useCallback, useMemo } from "react";
import MediaViewer from "./components/MediaViewer";
import Navigation from "./components/Navigation";
import SideNavigation from "./components/SideNavigation";
import SettingsPanel from "./components/SettingsPanel";
import TagDisplay from "./components/TagDisplay";
import TagInputModal from "./components/TagInputModal";
import LoadingMessage from "./components/LoadingMessage";
import ErrorMessage from "./components/ErrorMessage";
import DebugInfo from "./components/DebugInfo";
import GalleryView from "./components/GalleryView";
import ViewTransition from "./components/ViewTransition";
import { useMediaFiles } from "./hooks/useMediaFiles";
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";
import { useFavorite } from "./hooks/useFavorite";
import { useConfig } from "./hooks/useConfig";
import { useURLSettings } from "./hooks/useURLSettings";
import useTags from "./hooks/useTags";

function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagUpdateTrigger, setTagUpdateTrigger] = useState(0);
  const [galleryScrollPosition, setGalleryScrollPosition] = useState(0);
  const [isUrlSync, setIsUrlSync] = useState(false); // Track if index change is from URL sync

  // Get available tags for URL resolution
  const { tags } = useTags();

  // URL-based settings management
  const {
    settings: urlSettings,
    updateSetting,
    updateSettings,
    isInitialized,
  } = useURLSettings(tags);

  // Extract settings from URL hook
  const {
    mediaType: currentMediaType,
    sortBy,
    selectedTags,
    excludedTags,
    pathFilter: pathSubstring,
    galleryView: isGalleryView,
    debug: debugMode,
    mediaId,
  } = urlSettings;

  const {
    mediaFiles,
    allMediaFiles,
    loading,
    error,
    fetchMediaFiles,
    filterMedia,
    rescanDirectory,
    isScanning,
    regenerateThumbnails,
    isRegeneratingThumbnails,
  } = useMediaFiles();

  const { config } = useConfig();

  // Memoized current media file and directory path
  const currentMediaFile = useMemo(
    () =>
      mediaFiles.length > 0 && currentIndex < mediaFiles.length
        ? mediaFiles[currentIndex]
        : null,
    [mediaFiles, currentIndex],
  );

  const directoryPath = useMemo(
    () =>
      currentMediaFile
        ? currentMediaFile.file_path.split("/").slice(0, -1).join("/") || "/"
        : "",
    [currentMediaFile],
  );

  // Handle mobile viewport issues

  // Initialize media files on mount
  useEffect(() => {
    if (!isInitialized) return;
    fetchMediaFiles("all", [], [], "", "random");
  }, [isInitialized]);

  // Reset currentIndex when mediaFiles change to prevent out-of-bounds access
  useEffect(() => {
    if (mediaFiles.length > 0 && currentIndex >= mediaFiles.length) {
      setCurrentIndex(0);
    }
  }, [mediaFiles, currentIndex]);

  // Apply URL settings when initialized and tags are loaded
  useEffect(() => {
    if (isInitialized && tags.length >= 0) {
      // Apply initial filters from URL, prioritizing the media ID if present
      applyFilters(
        currentMediaType,
        selectedTags,
        excludedTags,
        pathSubstring,
        sortBy,
        mediaId,
      );
    }
  }, [isInitialized, tags.length]);

  // Enable debug mode with URL parameter or localStorage
  useEffect(() => {
    const debugStorage = localStorage.getItem("cactus-debug");
    if (debugStorage === "true" && !debugMode) {
      updateSetting("debug", true, { replace: true });
    }
  }, [debugMode]);

  // Set current index when media files are loaded with priority media ID
  useEffect(() => {
    if (mediaId && mediaFiles.length > 0 && isInitialized) {
      // If we have a media ID and files are loaded, find the correct index
      const targetIndex = mediaFiles.findIndex(
        (file) => file.file_hash === mediaId,
      );
      if (targetIndex !== -1 && targetIndex !== currentIndex) {
        setIsUrlSync(true); // Mark as URL sync to prevent URL update
        setCurrentIndex(targetIndex);
      }
    }
  }, [mediaId, mediaFiles, isInitialized]);

  // Update URL when current media changes (only when not from URL sync)
  useEffect(() => {
    if (
      currentMediaFile &&
      isInitialized &&
      mediaFiles.length > 0 &&
      !isUrlSync
    ) {
      const currentHash = currentMediaFile.file_hash;
      if (currentHash && currentHash !== mediaId) {
        updateSetting("mediaId", currentHash, { replace: true });
      }
    }
    // Reset URL sync flag after processing
    if (isUrlSync) {
      setIsUrlSync(false);
    }
  }, [
    currentIndex,
    mediaFiles,
    isInitialized,
    currentMediaFile,
    isUrlSync,
    mediaId,
  ]);

  // Memoized navigation handler
  const handleNavigation = useCallback(
    (direction) => {
      if (mediaFiles.length > 0) {
        setCurrentIndex((prevIndex) => {
          const newIndex =
            (prevIndex + direction + mediaFiles.length) % mediaFiles.length;
          return newIndex;
        });
      }
    },
    [mediaFiles],
  );

  // Helper function to create complete settings object
  const createSettingsUpdate = useCallback(
    (overrides = {}) => {
      return {
        mediaType: currentMediaType,
        sortBy: sortBy,
        selectedTags: selectedTags.map((tag) => tag.name || tag),
        excludedTags: excludedTags.map((tag) => tag.name || tag),
        pathFilter: pathSubstring,
        galleryView: isGalleryView,
        debug: debugMode,
        mediaId: mediaId,
        ...overrides,
      };
    },
    [
      currentMediaType,
      sortBy,
      selectedTags,
      excludedTags,
      pathSubstring,
      isGalleryView,
      debugMode,
      mediaId,
    ],
  );

  // Keyboard navigation
  useKeyboardNavigation(
    useCallback(
      (direction) => {
        if (mediaFiles.length > 0 && !showTagInput) {
          handleNavigation(direction);
        }
      },
      [mediaFiles.length, showTagInput, handleNavigation],
    ),
  );

  const handleMediaTypeChange = async (mediaType) => {
    if (mediaType === currentMediaType) return;

    console.log("Changing media type to:", mediaType);

    const newSettings = createSettingsUpdate({
      mediaType: mediaType,
      mediaId: "",
    });

    console.log("New settings:", newSettings);
    updateSettings(newSettings);

    setCurrentIndex(0);
    await applyFilters(
      mediaType,
      selectedTags,
      excludedTags,
      pathSubstring,
      sortBy,
    );
    setIsSettingsOpen(false);
  };

  const handleTagsChange = async (tags) => {
    console.log("Changing selected tags to:", tags);

    const newSettings = createSettingsUpdate({
      selectedTags: tags.map((tag) => tag.name || tag),
      mediaId: "",
    });

    updateSettings(newSettings);

    setCurrentIndex(0);
    await applyFilters(
      currentMediaType,
      tags,
      excludedTags,
      pathSubstring,
      sortBy,
    );
  };

  const handleExcludedTagsChange = async (tags) => {
    console.log("Changing excluded tags to:", tags);

    const newSettings = createSettingsUpdate({
      excludedTags: tags.map((tag) => tag.name || tag),
      mediaId: "",
    });

    updateSettings(newSettings);

    setCurrentIndex(0);
    await applyFilters(
      currentMediaType,
      selectedTags,
      tags,
      pathSubstring,
      sortBy,
    );
  };

  const handlePathChange = async (substring) => {
    console.log("Changing path filter to:", substring);

    const newSettings = createSettingsUpdate({
      pathFilter: substring,
      mediaId: "",
    });

    updateSettings(newSettings);

    setCurrentIndex(0);
    await applyFilters(
      currentMediaType,
      selectedTags,
      excludedTags,
      substring,
      sortBy,
    );
  };

  const applyFilters = async (
    mediaType,
    includeTags,
    excludeTags,
    pathSubstring,
    sortByValue = sortBy,
    priorityMediaId = null,
  ) => {
    try {
      const tagNames = includeTags.map((tag) => tag.name);
      const excludeTagNames = excludeTags.map((tag) => tag.name);

      await filterMedia(
        mediaType,
        tagNames,
        excludeTagNames,
        pathSubstring,
        sortByValue,
        priorityMediaId,
      );
    } catch (error) {
      console.error("Failed to apply filters:", error);
    }
  };

  const handleRescan = async () => {
    await rescanDirectory();
    await applyFilters(
      currentMediaType,
      selectedTags,
      excludedTags,
      pathSubstring,
      sortBy,
    );
    setIsSettingsOpen(false);
  };

  const handleToggleTagInput = (show) => {
    if (typeof show === "boolean") {
      setShowTagInput(show);
    } else {
      setShowTagInput((prev) => !prev);
    }
  };

  const handleTagsUpdated = () => {
    // Trigger a re-render of TagDisplay by updating a counter
    setTagUpdateTrigger((prev) => prev + 1);
  };

  const { isFavorited, toggleFavorite } = useFavorite(
    currentMediaFile?.file_path,
  );

  return (
    <div className="container flex flex-col h-screen w-full max-w-full shadow-2xl overflow-hidden bg-black text-gray-200">
      <DebugInfo show={debugMode} />

      <div className="media-container flex-1 relative overflow-hidden bg-black pb-16">
        {loading && <LoadingMessage message={loading} />}
        {error && <ErrorMessage message={error} />}

        {!loading && !error && mediaFiles.length > 0 && currentMediaFile && (
          <ViewTransition isGalleryView={isGalleryView}>
            <GalleryView
              mediaFiles={mediaFiles}
              currentIndex={currentIndex}
              onSelectMedia={(index) => {
                // Save current scroll position before switching to fullscreen
                const galleryContainer =
                  document.querySelector(".gallery-view");
                if (galleryContainer) {
                  setGalleryScrollPosition(galleryContainer.scrollTop);
                }
                setCurrentIndex(index);
                updateSetting("galleryView", false);
              }}
              scrollPosition={galleryScrollPosition}
              setScrollPosition={setGalleryScrollPosition}
            />
            <MediaViewer
              mediaFiles={mediaFiles}
              currentIndex={currentIndex}
              onNavigate={handleNavigation}
              showTagInput={showTagInput}
              onToggleTagInput={handleToggleTagInput}
            />
          </ViewTransition>
        )}

        {!loading && !error && mediaFiles.length === 0 && (
          <div className="h-full w-full flex justify-center items-center text-gray-500 text-center p-5">
            <div>
              <p className="text-lg mb-2">No media files found</p>
              <p className="text-sm">
                {selectedTags.length > 0 || excludedTags.length > 0
                  ? "No media matches the current tag filters. Try adjusting your filters."
                  : "Try rescanning the directory or check if the directory contains supported media files."}
              </p>
              {debugMode && (
                <div className="mt-4 text-xs">
                  <p>Debug Mode Active</p>
                  <p>Container Height: {window.innerHeight}px</p>
                  <p>
                    Viewport: {window.innerWidth}x{window.innerHeight}
                  </p>
                  <p>
                    Selected Tags:{" "}
                    {selectedTags.map((t) => t.name).join(", ") || "None"}
                  </p>
                  <p>
                    Excluded Tags:{" "}
                    {excludedTags.map((t) => t.name).join(", ") || "None"}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Side navigation buttons */}
        {!isSettingsOpen && !isGalleryView && (
          <SideNavigation
            onPrevious={() => handleNavigation(-1)}
            onNext={() => handleNavigation(1)}
            showNavButtons={mediaFiles.length > 0}
          />
        )}

        <SettingsPanel
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          currentMediaType={currentMediaType}
          onMediaTypeChange={handleMediaTypeChange}
          onRescan={handleRescan}
          isScanning={isScanning}
          allMediaFiles={allMediaFiles}
          currentMediaFiles={mediaFiles}
          selectedTags={selectedTags}
          excludedTags={excludedTags}
          onTagsChange={handleTagsChange}
          onExcludedTagsChange={handleExcludedTagsChange}
          onPathChange={handlePathChange}
          onRegenerateThumbnails={regenerateThumbnails}
          isRegeneratingThumbnails={isRegeneratingThumbnails}
          sortBy={sortBy}
          pathSubstring={pathSubstring}
          onSortByChange={async (newSortBy) => {
            console.log("Changing sort to:", newSortBy);

            const newSettings = createSettingsUpdate({
              sortBy: newSortBy,
              mediaId: "",
            });

            console.log("New settings:", newSettings);
            updateSettings(newSettings);

            setCurrentIndex(0);
            await applyFilters(
              currentMediaType,
              selectedTags,
              excludedTags,
              pathSubstring,
              newSortBy,
            );
            setIsSettingsOpen(false);
          }}
        />
      </div>

      {/* Fixed position tag components - hidden in gallery view */}
      {!isGalleryView && (
        <TagDisplay
          currentMediaFile={currentMediaFile}
          showTagInput={showTagInput}
          key={tagUpdateTrigger} // Force re-render when tags are updated
          isVideoPlaying={currentMediaFile?.media_type === "video"}
        />
      )}

      {/* Navigation bar at bottom - full width */}
      {!isSettingsOpen && (
        <Navigation
          currentMediaFile={currentMediaFile}
          onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)}
          onToggleTagInput={handleToggleTagInput}
          directoryName={directoryPath}
          isFavorited={isFavorited}
          onToggleFavorite={toggleFavorite}
          onToggleGalleryView={() =>
            updateSetting("galleryView", !isGalleryView)
          }
          isGalleryView={isGalleryView}
        />
      )}

      <TagInputModal
        isOpen={showTagInput}
        onClose={() => handleToggleTagInput(false)}
        currentMediaFile={currentMediaFile}
        onTagsUpdated={handleTagsUpdated}
      />
    </div>
  );
}

export default App;
