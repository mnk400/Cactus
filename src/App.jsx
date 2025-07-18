import React, { useState, useEffect } from "react";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import MediaViewer from "./components/MediaViewer";
import Navigation from "./components/Navigation";
import SettingsPanel from "./components/SettingsPanel";
import TagDisplay from "./components/TagDisplay";
import TagInputModal from "./components/TagInputModal";
import LoadingMessage from "./components/LoadingMessage";
import ErrorMessage from "./components/ErrorMessage";
import DebugInfo from "./components/DebugInfo";
import GalleryView from "./components/GalleryView";
import { useMediaFiles } from "./hooks/useMediaFiles";
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";
import { isVideo } from "./utils/helpers";
import { useFavorite } from "./hooks/useFavorite";

function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentMediaType, setCurrentMediaType] = useState("all");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  const [excludedTags, setExcludedTags] = useState([]);
  const [pathSubstring, setPathSubstring] = useState("");
  const [sortBy, setSortBy] = useState("random");
  const [tagUpdateTrigger, setTagUpdateTrigger] = useState(0);
  const [isGalleryView, setIsGalleryView] = useState(false);
  const [galleryScrollPosition, setGalleryScrollPosition] = useState(0);

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

  // Handle mobile viewport issues

  // Initialize media files on mount
  useEffect(() => {
    fetchMediaFiles("all");
  }, []);

  // Reset currentIndex when mediaFiles change to prevent out-of-bounds access
  useEffect(() => {
    if (mediaFiles.length > 0 && currentIndex >= mediaFiles.length) {
      setCurrentIndex(0);
    }
  }, [mediaFiles, currentIndex]);

  // Enable debug mode with URL parameter or localStorage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const debugParam = urlParams.get("debug");
    const debugStorage = localStorage.getItem("cactus-debug");

    if (debugParam === "true" || debugStorage === "true") {
      setDebugMode(true);
    }
  }, []);

  // Keyboard navigation
  useKeyboardNavigation((direction) => {
    if (mediaFiles.length > 0 && !showTagInput) {
      setCurrentIndex(
        (prev) => (prev + direction + mediaFiles.length) % mediaFiles.length,
      );
    }
  });

  const handleNavigation = (direction) => {
    if (mediaFiles.length > 0) {
      setCurrentIndex(
        (prev) => (prev + direction + mediaFiles.length) % mediaFiles.length,
      );
    }
  };

  const handleMediaTypeChange = async (mediaType) => {
    if (mediaType === currentMediaType) return;

    setCurrentMediaType(mediaType);
    setCurrentIndex(0);
    await applyFilters(mediaType, selectedTags, excludedTags, pathSubstring);
    setIsSettingsOpen(false);
  };

  const handleTagsChange = async (tags) => {
    setSelectedTags(tags);
    setCurrentIndex(0);
    await applyFilters(currentMediaType, tags, excludedTags, pathSubstring);
  };

  const handleExcludedTagsChange = async (tags) => {
    setExcludedTags(tags);
    setCurrentIndex(0);
    await applyFilters(currentMediaType, selectedTags, tags, pathSubstring);
  };

  const handlePathChange = async (substring) => {
    setPathSubstring(substring);
    setCurrentIndex(0);
    await applyFilters(currentMediaType, selectedTags, excludedTags, substring);
  };

  const applyFilters = async (
    mediaType,
    includeTags,
    excludeTags,
    pathSubstring,
    sortByValue = sortBy,
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

  // Safely get current media file and full directory path
  const currentMediaFile =
    mediaFiles.length > 0 && currentIndex < mediaFiles.length
      ? mediaFiles[currentIndex]
      : null;

  const directoryPath = currentMediaFile
    ? currentMediaFile.file_path.split("/").slice(0, -1).join("/") || "/"
    : "";

  const { isFavorited, toggleFavorite } = useFavorite(
    currentMediaFile?.file_path,
  );

  return (
    <div className="container flex flex-col h-screen w-full max-w-full shadow-2xl overflow-hidden bg-black text-gray-200">
      <DebugInfo show={debugMode} />

      <div className="media-container flex-1 relative overflow-hidden bg-black">
        {loading && <LoadingMessage message={loading} />}
        {error && <ErrorMessage message={error} />}

        {!loading && !error && mediaFiles.length > 0 && currentMediaFile && (
          <>
            <GalleryView
              mediaFiles={mediaFiles}
              currentIndex={currentIndex}
              onSelectMedia={(index) => {
                setCurrentIndex(index);
                setIsGalleryView(false);
              }}
              style={{ display: isGalleryView ? "flex" : "none" }}
              scrollPosition={galleryScrollPosition}
              setScrollPosition={setGalleryScrollPosition}
            />
            <MediaViewer
              mediaFiles={mediaFiles}
              currentIndex={currentIndex}
              onNavigate={handleNavigation}
              showTagInput={showTagInput}
              onToggleTagInput={handleToggleTagInput}
              style={{ display: isGalleryView ? "none" : "block" }}
            />
          </>
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

        {!isSettingsOpen && (
          <Navigation
            currentMediaFile={currentMediaFile}
            onPrevious={() => handleNavigation(-1)}
            onNext={() => handleNavigation(1)}
            onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)}
            onToggleTagInput={handleToggleTagInput}
            directoryName={directoryPath}
            showNavButtons={mediaFiles.length > 0}
            isFavorited={isFavorited}
            onToggleFavorite={toggleFavorite}
            onToggleGalleryView={() => setIsGalleryView(!isGalleryView)}
            isGalleryView={isGalleryView}
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
          directoryName={directoryPath}
          selectedTags={selectedTags}
          excludedTags={excludedTags}
          onTagsChange={handleTagsChange}
          onExcludedTagsChange={handleExcludedTagsChange}
          onPathChange={handlePathChange}
          onRegenerateThumbnails={regenerateThumbnails}
          isRegeneratingThumbnails={isRegeneratingThumbnails}
          sortBy={sortBy}
          onSortByChange={async (newSortBy) => {
            setSortBy(newSortBy);
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

      {/* Fixed position tag components */}
      <TagDisplay
        currentMediaFile={currentMediaFile}
        showTagInput={showTagInput}
        key={tagUpdateTrigger} // Force re-render when tags are updated
        isVideoPlaying={isVideo(currentMediaFile?.file_path)}
      />

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
