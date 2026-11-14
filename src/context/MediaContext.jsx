import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useURLSettings } from "../hooks/useURLSettings";

import { URL_PARAMS } from "../utils/urlParams";
import { NO_FILTERS, apiQuery, isFiltered, listKey } from "../utils/filters";
import { indexAfter } from "../order";

// Split contexts for granular re-render control
const CurrentMediaContext = createContext();
const AudioContext = createContext();
const MediaDataContext = createContext();
const VideoElementContext = createContext();

export const MediaProvider = ({ children }) => {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isRegeneratingThumbnails, setIsRegeneratingThumbnails] =
    useState(false);
  const [isUrlSync, setIsUrlSync] = useState(false);
  // The list (listKey) last fetched; the fetch effect compares against it so
  // it fetches once per change, whatever caused the change.
  const lastFetchedKey = useRef(null);
  // AbortController to cancel stale API requests when filters change rapidly
  const fetchAbortController = useRef(null);

  // Refs to read the list and position without adding them as dependencies,
  // so the actions below keep their identity across fetches and navigation.
  const currentIndexRef = useRef(0);
  const mediaFilesRef = useRef(mediaFiles);
  mediaFilesRef.current = mediaFiles;
  // The last item shown: where you are, even while a filter shows nothing
  // (or a fetch failed). Filtering and clearing land relative to it.
  const lastShownRef = useRef(null);

  // Audio state
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem("cactus-video-muted");
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Active video element — set by MediaItem and consumed by the video
  // controls and the dock's progress.
  const [videoElement, setVideoElement] = useState(null);
  const seekVideo = useCallback(
    (time) => {
      if (videoElement) videoElement.currentTime = time;
    },
    [videoElement],
  );

  // Tags state
  const [tags, setTags] = useState([]);

  const { settings, getLatestSettings, updateSettings } = useURLSettings(tags);

  const { galleryView, mediaId } = settings;

  // Keep currentIndex ref in sync for snapshot reads without adding dependency
  currentIndexRef.current = currentIndex;

  // Memoized current media file
  const currentMediaFile = useMemo(
    () =>
      mediaFiles.length > 0 && currentIndex < mediaFiles.length
        ? mediaFiles[currentIndex]
        : null,
    [mediaFiles, currentIndex],
  );
  if (currentMediaFile) lastShownRef.current = currentMediaFile;

  // Tag Management Methods
  const fetchTags = useCallback(async () => {
    try {
      const response = await fetch("/api/tags");
      if (!response.ok) throw new Error("Failed to fetch tags");
      const data = await response.json();
      setTags(data.tags || []);
    } catch (err) {
      console.error("Error fetching tags:", err);
    }
  }, []);

  const createTag = useCallback(async (name, color = "#3B82F6") => {
    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      if (!response.ok) throw new Error("Failed to create tag");
      const data = await response.json();
      setTags((prev) => [...prev, { ...data.tag, usage_count: 0 }]);
      return data.tag;
    } catch (err) {
      console.error("Error creating tag:", err);
      throw err;
    }
  }, []);

  const updateTag = useCallback(async (id, name, color) => {
    try {
      const response = await fetch(`/api/tags/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      if (!response.ok) throw new Error("Failed to update tag");
      const data = await response.json();
      setTags((prev) =>
        prev.map((tag) => (tag.id === id ? { ...tag, ...data.tag } : tag)),
      );
      return data.tag;
    } catch (err) {
      console.error("Error updating tag:", err);
      throw err;
    }
  }, []);

  const deleteTag = useCallback(async (id) => {
    try {
      const response = await fetch(`/api/tags/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete tag");
      setTags((prev) => prev.filter((tag) => tag.id !== id));
    } catch (err) {
      console.error("Error deleting tag:", err);
      throw err;
    }
  }, []);

  const key = listKey(settings);

  // Fetch the list and land on targetMediaId in it. When the new list left
  // it out, land on the next item after it in the order (indexAfter); the
  // first item when there is nothing to go by. mediaId is deliberately not
  // read from settings here: navigation does not update it, so it may be
  // stale.
  const fetchMedia = useCallback(
    async (targetMediaId) => {
      lastFetchedKey.current = listKey(settings);

      // Cancel any in-flight request to prevent stale responses from overwriting fresh data
      fetchAbortController.current?.abort();
      const controller = new AbortController();
      fetchAbortController.current = controller;
      const signal = controller.signal;

      try {
        setLoading("loading…");
        setError(null);

        const response = await fetch(`/api/media?${apiQuery(settings)}`, {
          signal,
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to get media files");
        }

        const data = await response.json();
        const files = data.files || [];

        let index = targetMediaId
          ? files.findIndex((f) => f.file_hash === targetMediaId)
          : -1;
        if (index === -1) {
          const last = lastShownRef.current;
          const gone =
            last?.file_hash === targetMediaId
              ? last
              : mediaFilesRef.current.find(
                  (f) => f.file_hash === targetMediaId,
                );
          index = gone
            ? indexAfter(files, gone, settings.sortBy, settings.seed)
            : 0;
        }

        setMediaFiles(files);
        setCurrentIndex(index);
      } catch (err) {
        // Ignore aborted requests - they're intentionally cancelled
        if (err.name === "AbortError") return;
        setError(err.message);
        setMediaFiles([]);
      } finally {
        // Only clear loading if this request wasn't aborted (otherwise we'd clear
        // the loading state of the newer request that replaced us)
        if (!signal.aborted) {
          setLoading(null);
        }
      }
    },
    [settings],
  );

  // Fetch server configuration
  const fetchConfig = useCallback(async () => {
    try {
      const resp = await fetch("/api/config");
      if (!resp.ok) throw new Error("Failed to fetch config");
      const data = await resp.json();
      setConfig(data);
    } catch (err) {
      console.error("Config fetch failed:", err);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchTags();
  }, [fetchConfig, fetchTags]);

  // The one place the list is fetched: on first load, and whenever the
  // filters change, whether from the panel or browser back/forward.
  useEffect(() => {
    if (lastFetchedKey.current !== key) fetchMedia(mediaId);
  }, [fetchMedia, key, mediaId]);

  // Keep the URL's media param on the item shown. Written directly
  // (replaceState) rather than through settings, so navigating does not
  // change the settings object. Runs after settings writes too (mediaId),
  // which may have dropped the param.
  useEffect(() => {
    if (currentMediaFile && !isUrlSync) {
      const url = new URL(window.location.href);
      if (
        url.searchParams.get(URL_PARAMS.MEDIA_ID) !== currentMediaFile.file_hash
      ) {
        url.searchParams.set(URL_PARAMS.MEDIA_ID, currentMediaFile.file_hash);
        window.history.replaceState(
          window.history.state, // keeps the filter-session mark
          "",
          url.pathname + url.search,
        );
      }
    }
    if (isUrlSync) setIsUrlSync(false);
  }, [currentMediaFile, isUrlSync, mediaId]);

  // Handle URL updates (popstate)
  useEffect(() => {
    const handlePopState = () => {
      setIsUrlSync(true);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Navigation logic
  const navigate = useCallback(
    (direction) => {
      if (mediaFiles.length === 0) return;
      setCurrentIndex(
        (prev) => (prev + direction + mediaFiles.length) % mediaFiles.length,
      );
    },
    [mediaFiles.length],
  );

  // Public API. Changing settings is all this does; the fetch effect picks
  // the change up.
  //
  // Where you land: there is one order, and filters only hide items in it.
  // So you stay on the item you are on; if a filter hides it, you go on to
  // the next item it kept. Clearing leaves you where you are, among the
  // neighbours the filter hid. Only a new sort, a new order, starts at the
  // top.
  //
  // History: one step per filter session. The first filter adds an entry,
  // marked as the session's; changes while filtered replace that entry
  // (only that one: after a gallery toggle the next change is a new step);
  // clearing adds one. So Back undoes the clear, and Back again returns to
  // where you were before filtering. A sort change is its own step.
  //
  // Compared against the latest settings, not the rendered ones: a control
  // may call this twice in one go, and the second call must see the first.
  const setFilters = useCallback(
    (newSettings) => {
      const prev = getLatestSettings();
      const next = { ...prev, ...newSettings };
      if (listKey(next) === listKey(prev)) return;

      const resorted = next.sortBy !== prev.sortBy;
      const filtered = isFiltered(next);
      const inSession = window.history.state?.filterSession === true;
      updateSettings(
        {
          ...newSettings,
          mediaId: resorted ? "" : lastShownRef.current?.file_hash || "",
        },
        {
          replace: !resorted && filtered && inSession,
          state: { filterSession: filtered },
        },
      );
    },
    [getLatestSettings, updateSettings],
  );

  const clearFilters = useCallback(() => setFilters(NO_FILTERS), [setFilters]);

  // The zoom between the two views is UnifiedMediaBrowser's, driven by the
  // galleryView setting changing; these only change state.
  // mediaId goes with it: the settings copy of it is only the one the page
  // loaded with (navigation writes the URL directly), and would put a stale
  // item back in the URL.
  const toggleGallery = useCallback(
    () =>
      updateSettings({
        galleryView: !galleryView,
        mediaId: lastShownRef.current?.file_hash || "",
      }),
    [galleryView, updateSettings],
  );

  const selectMedia = useCallback(
    (index) => {
      setCurrentIndex(index);
      updateSettings({
        galleryView: false,
        mediaId: mediaFilesRef.current[index]?.file_hash || "",
      });
    },
    [updateSettings],
  );

  const rescan = useCallback(async () => {
    if (isScanning) return;
    try {
      setIsScanning(true);
      const resp = await fetch("/rescan-directory", { method: "POST" });
      if (!resp.ok) throw new Error("Rescan failed");
      // Same order with the new files slotted in: stay put.
      await fetchMedia(lastShownRef.current?.file_hash);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsScanning(false);
    }
  }, [isScanning, fetchMedia]);

  const regenerateThumbnails = useCallback(async () => {
    if (isRegeneratingThumbnails) return;
    try {
      setIsRegeneratingThumbnails(true);
      const resp = await fetch("/regenerate-thumbnails", { method: "POST" });
      if (!resp.ok) throw new Error("Regeneration failed");
      await fetchMedia(lastShownRef.current?.file_hash);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRegeneratingThumbnails(false);
    }
  }, [isRegeneratingThumbnails, fetchMedia]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const setMutedCb = useCallback((muted) => {
    setIsMuted(muted);
  }, []);

  // Sync audio preferences to localStorage
  useEffect(() => {
    localStorage.setItem("cactus-video-muted", JSON.stringify(isMuted));
  }, [isMuted]);

  // --- Memoized context values ---

  // Changes only on navigation (currentIndex change)
  const currentMediaValue = useMemo(
    () => ({
      currentIndex,
      currentMediaFile,
    }),
    [currentIndex, currentMediaFile],
  );

  const videoElementValue = useMemo(
    () => ({ videoElement, setVideoElement, seekVideo }),
    [videoElement, seekVideo],
  );

  // Changes only on mute/interaction toggle
  const audioValue = useMemo(
    () => ({
      isMuted,
      toggleMute,
      setMuted: setMutedCb,
    }),
    [isMuted, toggleMute, setMutedCb],
  );

  // Everything else — changes on filter/sort, media fetch, config load, tag CRUD
  const mediaDataValue = useMemo(
    () => ({
      mediaFiles,
      loading,
      error,
      isScanning,
      isRegeneratingThumbnails,
      settings,
      navigate,
      setFilters,
      clearFilters,
      toggleGallery,
      selectMedia,
      rescan,
      regenerateThumbnails,
      setCurrentIndex,
      // Server Config
      config,
      canRescan: config?.provider?.capabilities?.canRescan || false,
      canRegenerateThumbnails:
        config?.provider?.capabilities?.canRegenerateThumbnails || false,
      canManageTags: config?.provider?.capabilities?.canManageTags || false,
      ui: config?.ui || {},
      // Tags
      tags,
      fetchTags,
      createTag,
      updateTag,
      deleteTag,
    }),
    [
      mediaFiles,
      loading,
      error,
      isScanning,
      isRegeneratingThumbnails,
      settings,
      navigate,
      setFilters,
      clearFilters,
      toggleGallery,
      selectMedia,
      rescan,
      regenerateThumbnails,
      config,
      tags,
      fetchTags,
      createTag,
      updateTag,
      deleteTag,
    ],
  );

  return (
    <MediaDataContext.Provider value={mediaDataValue}>
      <CurrentMediaContext.Provider value={currentMediaValue}>
        <AudioContext.Provider value={audioValue}>
          <VideoElementContext.Provider value={videoElementValue}>
            {children}
          </VideoElementContext.Provider>
        </AudioContext.Provider>
      </CurrentMediaContext.Provider>
    </MediaDataContext.Provider>
  );
};

// --- Granular hooks (use these for optimal re-render performance) ---

/** Media list, settings, actions, config, tags — everything except currentIndex and audio */
export const useMediaData = () => {
  const context = useContext(MediaDataContext);
  if (!context)
    throw new Error("useMediaData must be used within MediaProvider");
  return context;
};

/** Current index and current media file — changes on every navigation */
export const useCurrentMedia = () => {
  const context = useContext(CurrentMediaContext);
  if (!context)
    throw new Error("useCurrentMedia must be used within MediaProvider");
  return context;
};

/** Audio state — isMuted, toggleMute, setMuted */
export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) throw new Error("useAudio must be used within MediaProvider");
  return context;
};

/** Active <video> element + setter — used by the dock's progress and the video controls */
export const useVideoElement = () => {
  const context = useContext(VideoElementContext);
  if (!context)
    throw new Error("useVideoElement must be used within MediaProvider");
  return context;
};
