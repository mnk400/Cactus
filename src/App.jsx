import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import UnifiedMediaBrowser from "./components/UnifiedMediaBrowser";
import Sheet from "./components/Sheet";
import Message from "./components/Message";
import MediaSourceBadge from "./components/MediaSourceBadge";
import VideoControls from "./components/VideoControls";
import TagsPanel from "./components/TagsPanel";
import FilterPanel from "./components/FilterPanel";
import SettingsPanel from "./components/SettingsPanel";
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";
import { useCurrentMedia, useMediaData } from "./context/MediaContext";

const DebugInfo = lazy(() => import("./components/DebugInfo"));

const PANELS = {
  tags: TagsPanel,
  filters: FilterPanel,
  settings: SettingsPanel,
};
// Tags belong to one item, so the gallery has no tags panel.
const GALLERY_PANELS = { filters: FilterPanel, settings: SettingsPanel };

// The blur behind everything. It belongs to the screen, not to an item: it
// holds still and cross-fades to the next item's colors while the item
// itself slides over it.
function Ambient() {
  const { currentMediaFile } = useCurrentMedia();
  const hash = currentMediaFile?.file_hash;
  const [layers, setLayers] = useState([]);
  if (hash && layers[layers.length - 1] !== hash) {
    // Back to a recent item: move its layer to the top, never twice.
    setLayers([...layers.filter((layer) => layer !== hash).slice(-2), hash]);
  }
  return (
    <div
      aria-hidden="true"
      className="ambient absolute inset-0 overflow-hidden"
    >
      {layers.map((layer) => (
        <div
          key={layer}
          className="ambient-in"
          style={{ backgroundImage: `url(/thumbnails?hash=${layer})` }}
        />
      ))}
    </div>
  );
}

// The shell: the ambient blur, a stage that fills the viewport, and the
// sheet floating over it (the dock, which grows into the open panel). How
// those are arranged for a given screen shape is in index.css.
function App() {
  const [panel, setPanel] = useState(null); // "tags" | "filters" | "settings"
  const { mediaFiles, loading, error, settings, navigate } = useMediaData();
  const { galleryView, debug } = settings;

  // Entering the gallery closes the tags panel rather than hiding it, so it
  // does not pop back open on the way out.
  if (galleryView && panel === "tags") setPanel(null);

  useKeyboardNavigation(navigate);

  const togglePanel = useCallback(
    (name) => setPanel((current) => (current === name ? null : name)),
    [],
  );

  // iOS keeps the layout viewport full height under the on-screen keyboard,
  // so size the shell to the part that is actually visible.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    const sync = () => {
      if (viewport.scale !== 1) return; // pinch zoom, not a keyboard
      document.documentElement.style.setProperty(
        "--app-height",
        `${viewport.height}px`,
      );
      window.scrollTo(0, 0);
    };
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
    };
  }, []);

  const feedReady = !error && mediaFiles.length > 0;

  return (
    <div className="shell text-gray-200">
      <Ambient />

      <main
        className={`stage transition-opacity duration-200 ${
          loading && feedReady ? "opacity-60" : ""
        }`}
      >
        <Suspense fallback={null}>
          <DebugInfo show={debug} />
        </Suspense>

        {loading && !feedReady && <Message message={loading} />}
        {error && <Message message={error} variant="error" />}

        {feedReady && (
          <>
            <UnifiedMediaBrowser />
            <MediaSourceBadge />
            {!galleryView && <VideoControls />}
          </>
        )}

        {!loading && !error && !feedReady && (
          <div className="flex h-full w-full items-center justify-center p-5 text-center text-gray-500">
            <div>
              <p className="mb-2 text-base">no media files found</p>
              <p>
                try adjusting your filters or check that the directory contains
                supported media files.
              </p>
            </div>
          </div>
        )}
      </main>

      <Sheet
        panel={panel}
        onPanel={togglePanel}
        panels={galleryView ? GALLERY_PANELS : PANELS}
      />
    </div>
  );
}

export default App;
