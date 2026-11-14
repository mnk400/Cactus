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
import { isFiltered } from "./utils/filters";

const DebugInfo = lazy(() => import("./components/DebugInfo"));

const PANELS = {
  tags: TagsPanel,
  filters: FilterPanel,
  settings: SettingsPanel,
};
// Tags belong to one item, so the gallery has no tags panel.
const GALLERY_PANELS = { filters: FilterPanel, settings: SettingsPanel };

// The item's average color, dimmed like the blur (brightness in index.css).
const DIM = 0.24;
const pageColorOf = (img) => {
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  context.drawImage(img, 0, 0, size, size);
  const { data } = context.getImageData(0, 0, size, size);
  const sum = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) sum[c] += data[i + c];
  }
  const [r, g, b] = sum.map((v) => Math.round((v / (size * size)) * DIM));
  return `rgb(${r} ${g} ${b})`;
};

// The blur behind everything. It belongs to the screen, not to an item: it
// holds still and cross-fades to the next item's colors while the item
// itself slides over it.
//
// It also belongs to the whole screen, not just the viewport. Where the
// browser floats its own controls beside or below the page (Safari on a
// folded iPhone), the blur carries on under them, and the page's background
// color, which the browser paints wherever the blur cannot reach, follows
// the item too. So it sits outside the shell, which clips.
function Ambient() {
  const { currentMediaFile } = useCurrentMedia();
  const hash = currentMediaFile?.file_hash;
  const [layers, setLayers] = useState([]);
  if (hash && layers[layers.length - 1] !== hash) {
    // Back to a recent item: move its layer to the top, never twice.
    setLayers([...layers.filter((layer) => layer !== hash).slice(-2), hash]);
  }

  useEffect(() => {
    const paint = (color) => {
      document.documentElement.style.backgroundColor = color;
    };
    // No item, or no thumbnail to take a color from: back to black rather
    // than keeping the last item's tint.
    if (!hash) {
      paint("");
      return undefined;
    }
    const img = new Image();
    img.onload = () => paint(pageColorOf(img));
    img.onerror = () => paint("");
    img.src = `/thumbnails?hash=${hash}`;
    return () => {
      img.onload = img.onerror = null;
    };
  }, [hash]);

  return (
    <div aria-hidden="true" className="ambient">
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
  const openFilters = useCallback(() => setPanel("filters"), []);

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

  // The page is taller than the viewport (the blur and the gallery carry on
  // under a browser's bottom bar, see index.css) but must never move: put
  // it back if anything scrolls it (find in page, a focus, a script).
  useEffect(() => {
    const pin = () => {
      if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
    };
    window.addEventListener("scroll", pin);
    return () => window.removeEventListener("scroll", pin);
  }, []);

  const feedReady = !error && mediaFiles.length > 0;

  return (
    <>
      <Ambient />
      <div className="shell text-gray-200">
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
              {!galleryView && <VideoControls />}
            </>
          )}

          {/* Filtered, it stays up whatever the stage shows (loading, "no
              media files found", an error), so the filters can always be
              cleared from where they are shown. */}
          {(feedReady || isFiltered(settings)) && (
            <MediaSourceBadge onOpenFilters={openFilters} />
          )}

          {!loading && !error && !feedReady && (
            <div className="flex h-full w-full items-center justify-center p-5 text-center text-gray-500">
              <div>
                <p className="mb-2 text-base">no media files found</p>
                <p>
                  try adjusting your filters or check that the directory
                  contains supported media files.
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
    </>
  );
}

export default App;
