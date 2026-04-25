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
import InlineTagPanel from "./components/InlineTagPanel";
import VideoControlsBar from "./components/VideoControlsBar";
import LoadingMessage from "./components/LoadingMessage";
import ErrorMessage from "./components/ErrorMessage";
import ViewTransition from "./components/ViewTransition";

const SettingsPanel = lazy(() => import("./components/SettingsPanel"));
const GalleryView = lazy(() => import("./components/GalleryView"));
const DebugInfo = lazy(() => import("./components/DebugInfo"));
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";
import { useFavorite } from "./hooks/useFavorite";
import {
  useCurrentMedia,
  useMediaData,
  useAudio,
  useSlideshowState,
} from "./context/MediaContext";
import { isMobile } from "./utils/helpers";

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTagPanelExpanded, setIsTagPanelExpanded] = useState(false);
  const [galleryScrollPosition, setGalleryScrollPosition] = useState(0);
  const [isMobileView, setIsMobileView] = useState(isMobile());
  const settingsDrawerRef = useRef(null);

  const { currentMediaFile } = useCurrentMedia();
  const { mediaFiles, loading, error, settings, navigate, setFilters } =
    useMediaData();
  const { slideshowActive, toggleSlideshow } = useSlideshowState();
  const { isMuted, toggleMute } = useAudio();

  const { search, galleryView: isGalleryView, debug: debugMode } = settings;

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
        if (mediaFiles.length > 0 && !isTagPanelExpanded) {
          navigate(direction);
        }
      },
      [mediaFiles.length, isTagPanelExpanded, navigate],
    ),
    { onToggleSlideshow: toggleSlideshow },
  );

  const handleToggleTagPanel = useCallback((show) => {
    setIsTagPanelExpanded((prev) => (typeof show === "boolean" ? show : !prev));
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
    <>
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
                showTagInput={isTagPanelExpanded}
                onToggleTagInput={handleToggleTagPanel}
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
      </div>

      {/* Bottom chrome: outside overflow-hidden container for proper fixed positioning on iOS */}
      {(!isSettingsOpen || !isMobileView) && !slideshowActive && (
        <div
          className="fixed bottom-0 left-0 z-20 flex flex-col transition-all duration-300"
          style={{
            right: "var(--settings-drawer-width, 0px)",
            width: "calc(100% - var(--settings-drawer-width, 0px))",
          }}
        >
          {/* Floating glass elements: tag badges + video controls */}
          {!isGalleryView && (
            <div
              className="flex px-4 pb-1 gap-2 items-end justify-end pointer-events-none"
            >
              {search?.trim() && (
                <div className="inline-flex items-center px-3 py-1.5 mb-1 rounded-xl text-sm font-medium text-white shadow-sm whitespace-nowrap flex-shrink-0 pointer-events-auto bg-red-500">
                  <span className="max-w-[220px] truncate">
                    Search: {search.trim()}
                  </span>
                  <button
                    onClick={() => setFilters({ search: "" })}
                    className="ml-2 text-white hover:text-gray-200 focus:outline-none transition-colors duration-150 hover:bg-white hover:bg-opacity-20 rounded-lg w-5 h-5 flex items-center justify-center text-lg leading-none"
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                </div>
              )}
              <InlineTagPanel
                currentMediaFile={currentMediaFile}
                isExpanded={false}
                onToggleExpanded={handleToggleTagPanel}
                mode="display"
              />
              {currentMediaFile?.media_type === "video" && (
                <VideoControlsBar isMuted={isMuted} onToggleMute={toggleMute} />
              )}
            </div>
          )}
          <Navigation
            onToggleSettings={handleToggleSettings}
            onToggleTagPanel={handleToggleTagPanel}
            isTagPanelExpanded={isTagPanelExpanded}
            directoryName={directoryPath}
            isFavorited={isFavorited}
            onToggleFavorite={toggleFavorite}
          />
        </div>
      )}
    </>
  );
}

export default App;
