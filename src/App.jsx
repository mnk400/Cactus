import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  lazy,
  Suspense,
} from "react";
import MediaViewer from "./components/MediaViewer";
import Navigation from "./components/Navigation";
import SideNavigation from "./components/SideNavigation";
import TagDisplay from "./components/TagDisplay";
import LoadingMessage from "./components/LoadingMessage";
import ErrorMessage from "./components/ErrorMessage";
import ViewTransition from "./components/ViewTransition";

const SettingsPanel = lazy(() => import("./components/SettingsPanel"));
const GalleryView = lazy(() => import("./components/GalleryView"));
const TagInputModal = lazy(() => import("./components/TagInputModal"));
const DebugInfo = lazy(() => import("./components/DebugInfo"));
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";
import { useFavorite } from "./hooks/useFavorite";
import {
  useCurrentMedia,
  useMediaData,
  useSlideshowState,
} from "./context/MediaContext";
import { isMobile } from "./utils/helpers";

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagUpdateTrigger, setTagUpdateTrigger] = useState(0);
  const [galleryScrollPosition, setGalleryScrollPosition] = useState(0);
  const [isMobileView, setIsMobileView] = useState(isMobile());
  const settingsDrawerRef = useRef(null);

  const { currentIndex, currentMediaFile } = useCurrentMedia();
  const { mediaFiles, loading, error, settings, navigate } = useMediaData();
  const { slideshowActive, toggleSlideshow } = useSlideshowState();

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
    { onToggleSlideshow: toggleSlideshow },
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

  // Track window resize — only re-render when mobile/desktop threshold changes
  useEffect(() => {
    const handleResize = () => {
      const mobile = isMobile();
      setIsMobileView(mobile);

      // Update CSS variable for settings drawer width
      const root = document.documentElement;
      if (settingsDrawerRef.current && !mobile) {
        const isLargeScreen = window.matchMedia("(min-width: 1024px)").matches;
        root.style.setProperty(
          "--settings-drawer-width",
          isLargeScreen ? "450px" : "420px",
        );
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Manage CSS variable for settings drawer width on open/close
  useEffect(() => {
    const root = document.documentElement;
    if (isSettingsOpen && !isMobileView) {
      settingsDrawerRef.current = true;
      const isLargeScreen = window.matchMedia("(min-width: 1024px)").matches;
      root.style.setProperty(
        "--settings-drawer-width",
        isLargeScreen ? "450px" : "420px",
      );
    } else {
      settingsDrawerRef.current = false;
      root.style.setProperty("--settings-drawer-width", "0px");
    }
  }, [isSettingsOpen, isMobileView]);

  const isDesktop = !isMobileView;

  return (
    <div className="container flex flex-col h-screen w-full max-w-full shadow-2xl overflow-hidden bg-black text-gray-200">
      <Suspense fallback={null}>
        <DebugInfo show={debugMode} />
      </Suspense>

      <div
        className={`media-container flex-1 relative overflow-hidden bg-black`}
        style={{
          paddingBottom: slideshowActive
            ? undefined
            : "calc(4rem + env(safe-area-inset-bottom, 0px))",
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
            <Suspense
              fallback={<LoadingMessage message="Loading gallery..." />}
            >
              <GalleryView
                scrollPosition={galleryScrollPosition}
                setScrollPosition={setGalleryScrollPosition}
                isVisible={isGalleryView}
                preload={true}
              />
            </Suspense>
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

        {(!isSettingsOpen || !isMobileView) &&
          !isGalleryView &&
          !slideshowActive && <SideNavigation />}

        <ViewTransition isSettingsOpen={isSettingsOpen}>
          <Suspense fallback={null}>
            <SettingsPanel
              isOpen={isSettingsOpen}
              onClose={handleCloseSettings}
            />
          </Suspense>
        </ViewTransition>
      </div>

      {!isGalleryView && !slideshowActive && (
        <TagDisplay
          currentMediaFile={currentMediaFile}
          showTagInput={showTagInput}
          key={tagUpdateTrigger}
          isVideoPlaying={currentMediaFile?.media_type === "video"}
        />
      )}

      {(!isSettingsOpen || !isMobileView) && !slideshowActive && (
        <Navigation
          onToggleSettings={handleToggleSettings}
          onToggleTagInput={handleToggleTagInput}
          directoryName={directoryPath}
          isFavorited={isFavorited}
          onToggleFavorite={toggleFavorite}
        />
      )}

      <Suspense fallback={null}>
        <TagInputModal
          isOpen={showTagInput}
          onClose={handleCloseTagInput}
          currentMediaFile={currentMediaFile}
          onTagsUpdated={handleTagsUpdated}
        />
      </Suspense>
    </div>
  );
}

export default App;
