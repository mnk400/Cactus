import {
  useState,
  useCallback,
  useEffect,
  useRef,
  lazy,
  Suspense,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import UnifiedMediaBrowser from "./components/UnifiedMediaBrowser";
import Navigation from "./components/Navigation";
import SideNavigation from "./components/SideNavigation";
import Message from "./components/Message";

const SettingsPanel = lazy(() => import("./components/SettingsPanel"));
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
  const [isTagPanelExpanded, setIsTagPanelExpanded] = useState(false);
  const [isMobileView, setIsMobileView] = useState(isMobile());
  const settingsDrawerRef = useRef(null);

  const { currentMediaFile } = useCurrentMedia();
  const { mediaFiles, loading, error, settings, navigate } = useMediaData();
  const { slideshowActive, toggleSlideshow } = useSlideshowState();

  const { galleryView: isGalleryView, debug: debugMode } = settings;

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
          {loading && <Message message={loading} />}
          {error && <Message message={error} variant="error" />}

          {!loading && !error && mediaFiles.length > 0 && (
            <UnifiedMediaBrowser />
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

          {/* Desktop renders SettingsPanel always (it handles its own slide).
              Mobile wraps in a full-screen slide-up via AnimatePresence. */}
          {isDesktop ? (
            <Suspense fallback={null}>
              <SettingsPanel
                isOpen={isSettingsOpen}
                onClose={handleCloseSettings}
              />
            </Suspense>
          ) : (
            <AnimatePresence>
              {isSettingsOpen && (
                <motion.div
                  className="fixed inset-0 z-50"
                  initial={{ y: "100%", opacity: 0.8 }}
                  animate={{ y: "0%", opacity: 1 }}
                  exit={{ y: "100%", opacity: 0.8 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 32,
                    mass: 0.7,
                  }}
                >
                  <Suspense fallback={null}>
                    <SettingsPanel
                      isOpen={isSettingsOpen}
                      onClose={handleCloseSettings}
                    />
                  </Suspense>
                </motion.div>
              )}
            </AnimatePresence>
          )}
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
          <Navigation
            onToggleSettings={handleToggleSettings}
            onToggleTagPanel={handleToggleTagPanel}
            isTagPanelExpanded={isTagPanelExpanded}
            isFavorited={isFavorited}
            onToggleFavorite={toggleFavorite}
          />
        </div>
      )}
    </>
  );
}

export default App;
