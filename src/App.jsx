import { useState, useCallback, useMemo, useEffect } from "react";
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
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";
import { useFavorite } from "./hooks/useFavorite";
import { useCurrentMedia, useMediaData } from "./context/MediaContext";
import { isMobile } from "./utils/helpers";

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagUpdateTrigger, setTagUpdateTrigger] = useState(0);
  const [galleryScrollPosition, setGalleryScrollPosition] = useState(0);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  const { currentIndex, currentMediaFile } = useCurrentMedia();
  const { mediaFiles, loading, error, settings, navigate } = useMediaData();

  const { pathFilter, galleryView: isGalleryView, debug: debugMode } = settings;

  const directoryPath = useMemo(
    () =>
      currentMediaFile
        ? currentMediaFile.file_path.split("/").slice(0, -1).join("/") || "/"
        : "",
    [currentMediaFile],
  );

  // Keyboard navigation
  useKeyboardNavigation(
    useCallback(
      (direction) => {
        if (mediaFiles.length > 0 && !showTagInput) {
          navigate(direction);
        }
      },
      [mediaFiles.length, showTagInput, navigate],
    ),
  );

  const handleToggleTagInput = useCallback((show) => {
    setShowTagInput((prev) => (typeof show === "boolean" ? show : !prev));
  }, []);

  const handleCloseTagInput = useCallback(() => {
    setShowTagInput(false);
  }, []);

  const handleTagsUpdated = useCallback(() => {
    setTagUpdateTrigger((prev) => prev + 1);
  }, []);

  const handleToggleSettings = useCallback(() => {
    setIsSettingsOpen((prev) => !prev);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const { isFavorited, toggleFavorite } = useFavorite(
    currentMediaFile?.file_path,
  );

  // Track window resize to make isMobile() reactive
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Manage CSS variable for settings drawer width
  useEffect(() => {
    const isDesktop = !isMobile();
    const root = document.documentElement;

    if (isSettingsOpen && isDesktop) {
      // Determine drawer width based on screen size
      const updateDrawerWidth = () => {
        const isLargeScreen = window.matchMedia("(min-width: 1024px)").matches;
        const drawerWidth = isLargeScreen ? "450px" : "420px";
        root.style.setProperty("--settings-drawer-width", drawerWidth);
      };

      updateDrawerWidth();

      // Update on resize
      window.addEventListener("resize", updateDrawerWidth);
      return () => window.removeEventListener("resize", updateDrawerWidth);
    } else {
      // Mobile or settings closed
      root.style.setProperty("--settings-drawer-width", "0px");
    }
  }, [isSettingsOpen, windowWidth]);

  const isDesktop = !isMobile();

  return (
    <div className="container flex flex-col h-screen w-full max-w-full shadow-2xl overflow-hidden bg-black text-gray-200">
      <DebugInfo show={debugMode} />

      <div
        className="media-container flex-1 relative overflow-hidden bg-black pb-16"
        style={{
          width:
            isSettingsOpen && isDesktop
              ? "calc(100% - var(--settings-drawer-width, 0px))"
              : "100%",
        }}
      >
        {loading && <LoadingMessage message={loading} />}
        {error && <ErrorMessage message={error} />}

        {!loading && !error && mediaFiles.length > 0 && (
          <ViewTransition isGalleryView={isGalleryView}>
            <GalleryView
              scrollPosition={galleryScrollPosition}
              setScrollPosition={setGalleryScrollPosition}
              isVisible={isGalleryView}
              preload={true}
            />
            <MediaViewer
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
                Try adjusting your filters or check if the directory contains
                supported media files.
              </p>
            </div>
          </div>
        )}

        {(!isSettingsOpen || !isMobile()) && !isGalleryView && (
          <SideNavigation />
        )}

        <ViewTransition isSettingsOpen={isSettingsOpen}>
          <SettingsPanel
            isOpen={isSettingsOpen}
            onClose={handleCloseSettings}
          />
        </ViewTransition>
      </div>

      {!isGalleryView && (
        <TagDisplay
          currentMediaFile={currentMediaFile}
          showTagInput={showTagInput}
          key={tagUpdateTrigger}
          isVideoPlaying={currentMediaFile?.media_type === "video"}
        />
      )}

      {(!isSettingsOpen || !isMobile()) && (
        <Navigation
          onToggleSettings={handleToggleSettings}
          onToggleTagInput={handleToggleTagInput}
          directoryName={directoryPath}
          isFavorited={isFavorited}
          onToggleFavorite={toggleFavorite}
        />
      )}

      <TagInputModal
        isOpen={showTagInput}
        onClose={handleCloseTagInput}
        currentMediaFile={currentMediaFile}
        onTagsUpdated={handleTagsUpdated}
      />
    </div>
  );
}

export default App;
