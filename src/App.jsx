import { useState, useCallback, lazy, Suspense } from "react";
import UnifiedMediaBrowser from "./components/UnifiedMediaBrowser";
import ControlRail from "./components/ControlRail";
import Message from "./components/Message";
import MediaSourceBadge from "./components/MediaSourceBadge";
import FilterPanel from "./components/FilterPanel";
import VideoProgressBar from "./components/VideoProgressBar";

const SettingsPanel = lazy(() => import("./components/SettingsPanel"));
const DebugInfo = lazy(() => import("./components/DebugInfo"));
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";
import { useMediaData, useSlideshowState } from "./context/MediaContext";
import { useIsDesktop } from "./hooks/useIsDesktop";

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [filterSection, setFilterSection] = useState(null); // null | 'filters' | 'tags'

  const isDesktop = useIsDesktop();
  const { mediaFiles, loading, error, settings, navigate } = useMediaData();
  const { slideshowActive, toggleSlideshow } = useSlideshowState();

  const { galleryView: isGalleryView, debug: debugMode } = settings;

  const isFilterOpen = filterSection !== null;
  const showChrome = !isGalleryView && !slideshowActive;

  // Keyboard navigation — suspended while the filter panel is open.
  useKeyboardNavigation(
    useCallback(
      (direction) => {
        if (mediaFiles.length > 0 && !isFilterOpen) {
          navigate(direction);
        }
      },
      [mediaFiles.length, isFilterOpen, navigate],
    ),
    { onToggleSlideshow: toggleSlideshow },
  );

  const handleToggleSettings = useCallback(() => {
    setIsSettingsOpen((prev) => !prev);
  }, []);
  const handleCloseSettings = useCallback(() => setIsSettingsOpen(false), []);
  const handleToggleFilter = useCallback(() => {
    setFilterSection((prev) => (prev === null ? "filters" : null));
  }, []);
  const handleOpenTags = useCallback(() => setFilterSection("tags"), []);
  const handleCloseFilter = useCallback(() => setFilterSection(null), []);

  // Bottom-bar clearance is a mobile-only concern (desktop nav is the left rail).
  const mobileNavVisible = !isDesktop && !slideshowActive && !isSettingsOpen;
  const navClearance = mobileNavVisible
    ? "calc(4rem + env(safe-area-inset-bottom, 0px))"
    : "0px";

  const feedReady = !loading && !error && mediaFiles.length > 0;

  return (
    <>
      <div
        className={`container flex w-full max-w-full overflow-hidden bg-black text-gray-200 ${
          isDesktop ? "flex-row" : "flex-col"
        }`}
        style={{
          "--nav-clearance": navClearance,
          // Feed column width — the feed is capped/centered to this; the gallery
          // and chrome alignment share it. Full-width on mobile.
          "--feed-col": isDesktop ? "min(100%, 62vh, 760px)" : "100%",
          height: "100dvh",
        }}
      >
        <Suspense fallback={null}>
          <DebugInfo show={debugMode} />
        </Suspense>

        {/* Desktop: slim left icon rail replaces the bottom bar. A brand mark
            anchors the top so the rail reads as an intentional edge, not a
            stray cluster of icons. */}
        {isDesktop && (
          <div
            className="flex h-full w-16 shrink-0 flex-col items-center gap-6 border-r border-white/5 bg-black-shades-1000 py-4"
            style={{ viewTransitionName: "nav-bar" }}
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-green-400"
              title="Cactus"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M12 21V6" />
                <path d="M12 13H9.5A1.5 1.5 0 0 1 8 11.5V10" />
                <path d="M12 11h2.5A1.5 1.5 0 0 0 16 9.5V8" />
              </svg>
            </div>
            <ControlRail
              orientation="vertical"
              showItemActions={showChrome}
              onOpenFilter={handleToggleFilter}
              onOpenSettings={handleToggleSettings}
              onOpenTags={handleOpenTags}
              isFilterOpen={isFilterOpen}
              isSettingsOpen={isSettingsOpen}
            />
          </div>
        )}

        <div
          className={`media-container relative overflow-hidden bg-black ${
            isDesktop ? "flex-1 min-w-0" : "w-full"
          }`}
          style={{ height: "calc(100% - var(--nav-clearance, 0px))" }}
        >
          {loading && <Message message={loading} />}
          {error && <Message message={error} variant="error" />}

          {feedReady && <UnifiedMediaBrowser />}

          {/* Chrome overlay aligned to the centered feed column: source badge +
              progress bar. Per-item actions now live in the ControlRail, so the
              overlay stays out of the content. Hidden in gallery view. */}
          {feedReady && showChrome && (
            <div className="pointer-events-none absolute inset-0 z-20 flex justify-center">
              <div className="relative h-full w-full max-w-[var(--feed-col)]">
                <MediaSourceBadge />
                <div className="pointer-events-auto absolute inset-x-0 bottom-0">
                  <VideoProgressBar />
                </div>
              </div>
            </div>
          )}

          {!loading && !error && mediaFiles.length === 0 && (
            <div className="flex h-full w-full items-center justify-center p-5 text-center text-gray-500">
              <div>
                <p className="mb-2 text-lg">No media files found</p>
                <p className="text-sm">
                  Try adjusting your filters or check if the directory contains
                  supported media files.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom chrome: one bar carrying both zones — app modes hug the
          left, this-item actions hug the right (progress bar lives in the
          stage). */}
      {mobileNavVisible && (
        <div
          className="fixed bottom-0 left-0 right-0 z-20 flex items-center bg-black-shades-1000 px-4 pt-3"
          style={{
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))",
            viewTransitionName: "nav-bar",
          }}
        >
          <ControlRail
            orientation="horizontal"
            showItemActions={showChrome}
            onOpenFilter={handleToggleFilter}
            onOpenSettings={handleToggleSettings}
            onOpenTags={handleOpenTags}
            isFilterOpen={isFilterOpen}
            isSettingsOpen={isSettingsOpen}
          />
        </div>
      )}

      <Suspense fallback={null}>
        <SettingsPanel isOpen={isSettingsOpen} onClose={handleCloseSettings} />
      </Suspense>

      <FilterPanel
        isOpen={isFilterOpen}
        section={filterSection || "filters"}
        onClose={handleCloseFilter}
      />
    </>
  );
}

export default App;
