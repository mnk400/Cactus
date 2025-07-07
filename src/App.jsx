import React, { useState, useEffect } from "react";
import MediaViewer from "./components/MediaViewer";
import Navigation from "./components/Navigation";
import SettingsPanel from "./components/SettingsPanel";
import TagDisplay from "./components/TagDisplay";
import TagInputModal from "./components/TagInputModal";
import LoadingMessage from "./components/LoadingMessage";
import ErrorMessage from "./components/ErrorMessage";
import DebugInfo from "./components/DebugInfo";
import { useMediaFiles } from "./hooks/useMediaFiles";
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";
import { isVideo } from "./utils/helpers";

function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentMediaType, setCurrentMediaType] = useState("all");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  const [excludedTags, setExcludedTags] = useState([]);
  const [tagUpdateTrigger, setTagUpdateTrigger] = useState(0);

  const {
    mediaFiles,
    allMediaFiles,
    loading,
    error,
    fetchMediaFiles,
    filterMedia,
    rescanDirectory,
    isScanning,
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
    await applyFilters(mediaType, selectedTags, excludedTags);
    setIsSettingsOpen(false);
  };

  const handleTagsChange = async (tags) => {
    setSelectedTags(tags);
    setCurrentIndex(0);
    await applyFilters(currentMediaType, tags, excludedTags);
  };

  const handleExcludedTagsChange = async (tags) => {
    setExcludedTags(tags);
    setCurrentIndex(0);
    await applyFilters(currentMediaType, selectedTags, tags);
  };

  const applyFilters = async (mediaType, includeTags, excludeTags) => {
    try {
      const tagNames = includeTags.map((tag) => tag.name);
      const excludeTagNames = excludeTags.map((tag) => tag.name);

      let url = `/api/media?type=${mediaType}`;

      if (tagNames.length > 0) {
        url += `&tags=${tagNames.join(",")}`;
      }

      if (excludeTagNames.length > 0) {
        url += `&exclude-tags=${excludeTagNames.join(",")}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch filtered media");
      }

      const data = await response.json();

      // Update the media files using the existing hook's internal state
      // We'll need to modify the useMediaFiles hook to support this
      await filterMedia(mediaType, tagNames, excludeTagNames);
    } catch (error) {
      console.error("Failed to apply filters:", error);
    }
  };

  const handleRescan = async () => {
    await rescanDirectory();
    await applyFilters(currentMediaType, selectedTags, excludedTags);
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
    ? currentMediaFile.split("/").slice(0, -1).join("/") || "/"
    : "";

  return (
    <div className="container flex flex-col h-screen w-full max-w-full shadow-2xl overflow-hidden bg-black text-gray-200">
      <DebugInfo show={debugMode} />

      <div className="media-container flex-1 relative overflow-hidden bg-black">
        {loading && <LoadingMessage message={loading} />}
        {error && <ErrorMessage message={error} />}

        {!loading && !error && mediaFiles.length > 0 && currentMediaFile && (
          <MediaViewer
            mediaFiles={mediaFiles}
            currentIndex={currentIndex}
            onNavigate={handleNavigation}
            showTagInput={showTagInput}
            onToggleTagInput={handleToggleTagInput}
          />
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
        />
      </div>

      {/* Fixed position tag components */}
      <TagDisplay
        currentMediaFile={currentMediaFile}
        showTagInput={showTagInput}
        key={tagUpdateTrigger} // Force re-render when tags are updated
        isVideoPlaying={isVideo(currentMediaFile)}
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
