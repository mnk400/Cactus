import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useURLSettings } from "../hooks/useURLSettings";

import { URL_PARAMS, encodeSettingsToURL } from "../utils/urlParams";

// Split contexts for granular re-render control
const CurrentMediaContext = createContext();
const AudioContext = createContext();
const MediaDataContext = createContext();
const SlideshowContext = createContext();

export const MediaProvider = ({ children }) => {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [allMediaFiles, setAllMediaFiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isRegeneratingThumbnails, setIsRegeneratingThumbnails] =
    useState(false);
  const [isUrlSync, setIsUrlSync] = useState(false);
  // Track filters used in the last fetch to prevent duplicate fetches
  // and enable refetching when URL changes via browser navigation
  const lastFetchedFilters = useRef(null);
  // AbortController to cancel stale API requests when filters change rapidly
  const fetchAbortController = useRef(null);

  // Browsing snapshot: saves state before a context switch (e.g. applying filters)
  // so we can restore position + order when returning to the original context
  const browsingSnapshot = useRef(null);
  // Ref to read currentIndex without adding it as a dependency
  const currentIndexRef = useRef(0);

  // Audio state
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem("cactus-video-muted");
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [hasUserInteracted, setHasUserInteracted] = useState(() => {
    return localStorage.getItem("cactus-user-audio-interaction") === "true";
  });

  // Tags state
  const [tags, setTags] = useState([]);
  const [tagsLoading, setTagsLoading] = useState(false);

  // Slideshow state
  const [slideshowActive, setSlideshowActive] = useState(false);
  const [slideshowSpeed, setSlideshowSpeed] = useState(() => {
    return localStorage.getItem("cactus-slideshow-speed") || "normal";
  });

  const {
    settings,
    updateSetting,
    updateSettings,
    isInitialized: isUrlInitialized,
  } = useURLSettings(tags);

  const {
    mediaType,
    sortBy,
    selectedTags,
    excludedTags,
    pathFilter,
    galleryView,
    mediaId,
  } = settings;

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

  // Tag Management Methods
  const fetchTags = useCallback(async () => {
    setTagsLoading(true);
    try {
      const response = await fetch("/api/tags");
      if (!response.ok) throw new Error("Failed to fetch tags");
      const data = await response.json();
      setTags(data.tags || []);
    } catch (err) {
      console.error("Error fetching tags:", err);
    } finally {
      setTagsLoading(false);
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

  // Fetch media files from API
  // Note: mediaId is intentionally NOT in dependencies to prevent infinite loops.
  // When URL changes mediaId, we don't want to refetch - we just want to navigate.
  // The mediaId is only used on initial load to set the starting position.
  const fetchMedia = useCallback(
    async (overrides = {}) => {
      const params = {
        type: overrides.mediaType ?? mediaType,
        sortBy: overrides.sortBy ?? sortBy,
        tags: (overrides.selectedTags ?? selectedTags)
          .map((t) => t.name || t)
          .join(","),
        "exclude-tags": (overrides.excludedTags ?? excludedTags)
          .map((t) => t.name || t)
          .join(","),
        pathSubstring:
          overrides.pathFilter !== undefined
            ? overrides.pathFilter
            : pathFilter,
      };

      // Update last fetched filters to prevent duplicate fetches from the effect
      lastFetchedFilters.current = JSON.stringify({
        mediaType: params.type,
        sortBy: params.sortBy,
        tags: params.tags,
        excludeTags: params["exclude-tags"],
        pathFilter: params.pathSubstring || "",
      });

      // For initial load, use mediaId from overrides. Don't use state mediaId to avoid loops.
      const targetMediaId = overrides.mediaId;

      // Cancel any in-flight request to prevent stale responses from overwriting fresh data
      fetchAbortController.current?.abort();
      const controller = new AbortController();
      fetchAbortController.current = controller;
      const signal = controller.signal;

      try {
        setLoading(`Loading ${params.type} media...`);
        setError(null);

        let url = `/api/media?type=${params.type}&sortBy=${params.sortBy}`;
        if (params.tags) url += `&tags=${params.tags}`;
        if (params["exclude-tags"])
          url += `&exclude-tags=${params["exclude-tags"]}`;
        if (params.pathSubstring)
          url += `&pathSubstring=${encodeURIComponent(params.pathSubstring)}`;

        const response = await fetch(url, { signal });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to get media files");
        }

        const data = await response.json();
        const files = data.files || [];

        setMediaFiles(files);

        if (targetMediaId && files.length > 0) {
          const foundIndex = files.findIndex(
            (f) => f.file_hash === targetMediaId,
          );
          if (foundIndex !== -1) {
            setCurrentIndex(foundIndex);
          } else {
            setCurrentIndex(0);
          }
        } else {
          setCurrentIndex(0);
        }
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
    [mediaType, sortBy, selectedTags, excludedTags, pathFilter],
  );

  // Fetch server configuration
  const fetchConfig = useCallback(async () => {
    try {
      setConfigLoading(true);
      const resp = await fetch("/api/config");
      if (!resp.ok) throw new Error("Failed to fetch config");
      const data = await resp.json();
      setConfig(data);
    } catch (err) {
      console.error("Config fetch failed:", err);
    } finally {
      setConfigLoading(false);
    }
  }, []);

  // Initial fetch when URL is ready
  useEffect(() => {
    const init = async () => {
      const fetchAllMedia = async () => {
        try {
          const response = await fetch("/api/media?type=all");
          if (response.ok) {
            const data = await response.json();
            setAllMediaFiles(data.files || []);
          }
        } catch (err) {
          console.warn("Failed to fetch all media for stats:", err);
        }
      };

      await Promise.all([fetchConfig(), fetchTags(), fetchAllMedia()]);
    };
    init();
  }, [fetchConfig, fetchTags]);

  // Fetch media when URL is initialized or when filters change (e.g., browser back/forward)
  // We track the last fetched filters to prevent duplicate fetches while still
  // allowing refetches when URL parameters change via browser navigation
  useEffect(() => {
    if (!isUrlInitialized) return;

    // Build a filter key from current state to compare with last fetch
    const currentFilterKey = JSON.stringify({
      mediaType,
      sortBy,
      tags: selectedTags.map((t) => t.name || t).join(","),
      excludeTags: excludedTags.map((t) => t.name || t).join(","),
      pathFilter: pathFilter || "",
    });

    // Only fetch if filters have changed (or first load when ref is null)
    if (lastFetchedFilters.current !== currentFilterKey) {
      fetchMedia({ mediaId });
    }
  }, [
    isUrlInitialized,
    fetchMedia,
    mediaId,
    mediaType,
    sortBy,
    selectedTags,
    excludedTags,
    pathFilter,
  ]);

  // Sync mediaId to URL when index changes.
  // Updates URL directly (replaceState) instead of going through settings state
  // to avoid invalidating the memoized settings reference on every navigation.
  const lastSyncedMediaId = useRef(mediaId);
  useEffect(() => {
    if (currentMediaFile && isUrlInitialized && !isUrlSync) {
      const newHash = currentMediaFile.file_hash;
      if (newHash !== lastSyncedMediaId.current) {
        lastSyncedMediaId.current = newHash;
        // Update just the media param in the URL without touching settings state
        const url = new URL(window.location.href);
        url.searchParams.set(URL_PARAMS.MEDIA_ID, newHash);
        window.history.replaceState({}, "", url.pathname + url.search);
      }
    }
    if (isUrlSync) setIsUrlSync(false);
  }, [currentIndex, currentMediaFile, isUrlInitialized, isUrlSync]);

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

  // Helper: are content-narrowing filters active?
  const hasActiveFilters = useCallback(
    (tags, excluded, path) =>
      tags.length > 0 || excluded.length > 0 || (path && path.trim() !== ""),
    [],
  );

  // Public API
  const setFilters = useCallback(
    (newSettings) => {
      // Resolve what the new full filter state will be
      const newTags = newSettings.selectedTags ?? selectedTags;
      const newExcluded = newSettings.excludedTags ?? excludedTags;
      const newPath =
        newSettings.pathFilter !== undefined
          ? newSettings.pathFilter
          : pathFilter;
      const newMediaType = newSettings.mediaType ?? mediaType;
      const newSortBy = newSettings.sortBy ?? sortBy;

      const wasFiltered = hasActiveFilters(
        selectedTags,
        excludedTags,
        pathFilter,
      );
      const willBeFiltered = hasActiveFilters(newTags, newExcluded, newPath);

      // Base view settings changing → invalidate snapshot
      if (newMediaType !== mediaType || newSortBy !== sortBy) {
        browsingSnapshot.current = null;
      }

      if (!wasFiltered && willBeFiltered) {
        // Entering filtered mode → save current browsing state
        browsingSnapshot.current = {
          mediaFiles,
          currentIndex: currentIndexRef.current,
          mediaType,
          sortBy,
        };
      } else if (wasFiltered && !willBeFiltered && browsingSnapshot.current) {
        // Leaving filtered mode → try to restore snapshot
        const snapshot = browsingSnapshot.current;
        if (
          snapshot.mediaType === newMediaType &&
          snapshot.sortBy === newSortBy
        ) {
          setMediaFiles(snapshot.mediaFiles);
          setCurrentIndex(snapshot.currentIndex);
          browsingSnapshot.current = null;

          // Update URL to reflect restored state
          const restoredHash =
            snapshot.mediaFiles[snapshot.currentIndex]?.file_hash || "";
          updateSettings({ ...newSettings, mediaId: restoredHash });

          // Sync lastFetchedFilters so the effect doesn't re-fetch
          lastFetchedFilters.current = JSON.stringify({
            mediaType: newMediaType,
            sortBy: newSortBy,
            tags: (Array.isArray(newTags)
              ? newTags.map((t) => t.name || t)
              : []
            ).join(","),
            excludeTags: (Array.isArray(newExcluded)
              ? newExcluded.map((t) => t.name || t)
              : []
            ).join(","),
            pathFilter: newPath || "",
          });

          return; // Skip fetch — restored from snapshot
        }
        // Base settings don't match → invalidate and fetch fresh
        browsingSnapshot.current = null;
      }

      updateSettings({ ...newSettings, mediaId: "" });
      fetchMedia({ ...newSettings, mediaId: "" });
    },
    [
      updateSettings,
      fetchMedia,
      hasActiveFilters,
      selectedTags,
      excludedTags,
      pathFilter,
      mediaType,
      sortBy,
      mediaFiles,
    ],
  );

  const toggleGallery = useCallback(() => {
    updateSetting("galleryView", !galleryView);
  }, [galleryView, updateSetting]);

  const selectMedia = useCallback(
    (index) => {
      setCurrentIndex(index);
      updateSetting("galleryView", false);
    },
    [updateSetting],
  );

  const rescan = useCallback(async () => {
    if (isScanning) return;
    try {
      setIsScanning(true);
      const resp = await fetch("/rescan-directory", { method: "POST" });
      if (!resp.ok) throw new Error("Rescan failed");
      await fetchMedia();
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
      await fetchMedia();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRegeneratingThumbnails(false);
    }
  }, [isRegeneratingThumbnails, fetchMedia]);

  const toggleSlideshow = useCallback(() => {
    setSlideshowActive((prev) => !prev);
  }, []);

  const startSlideshow = useCallback(() => {
    setSlideshowActive(true);
  }, []);

  const stopSlideshow = useCallback(() => {
    setSlideshowActive(false);
  }, []);

  const setSlideshowSpeedCb = useCallback((speed) => {
    setSlideshowSpeed(speed);
    localStorage.setItem("cactus-slideshow-speed", speed);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
    setHasUserInteracted(true);
  }, []);

  const setMutedCb = useCallback((muted) => {
    setIsMuted(muted);
    setHasUserInteracted(true);
  }, []);

  // Sync audio preferences to localStorage
  useEffect(() => {
    localStorage.setItem("cactus-video-muted", JSON.stringify(isMuted));
  }, [isMuted]);

  useEffect(() => {
    if (hasUserInteracted) {
      localStorage.setItem("cactus-user-audio-interaction", "true");
    }
  }, [hasUserInteracted]);

  // --- Memoized context values ---

  // Changes only on navigation (currentIndex change)
  const currentMediaValue = useMemo(
    () => ({
      currentIndex,
      currentMediaFile,
    }),
    [currentIndex, currentMediaFile],
  );

  // Changes only on mute/interaction toggle
  const audioValue = useMemo(
    () => ({
      isMuted,
      hasUserInteracted,
      toggleMute,
      setMuted: setMutedCb,
    }),
    [isMuted, hasUserInteracted, toggleMute, setMutedCb],
  );

  // Slideshow state — changes only when slideshow is toggled or speed changes
  const slideshowValue = useMemo(
    () => ({
      slideshowActive,
      slideshowSpeed,
      toggleSlideshow,
      startSlideshow,
      stopSlideshow,
      setSlideshowSpeed: setSlideshowSpeedCb,
    }),
    [
      slideshowActive,
      slideshowSpeed,
      toggleSlideshow,
      startSlideshow,
      stopSlideshow,
      setSlideshowSpeedCb,
    ],
  );

  // Everything else — changes on filter/sort, media fetch, config load, tag CRUD
  const mediaDataValue = useMemo(
    () => ({
      mediaFiles,
      allMediaFiles,
      loading,
      error,
      isScanning,
      isRegeneratingThumbnails,
      settings,
      navigate,
      setFilters,
      toggleGallery,
      selectMedia,
      rescan,
      regenerateThumbnails,
      setCurrentIndex,
      // Server Config
      config,
      configLoading,
      canRescan: config?.provider?.capabilities?.canRescan || false,
      canRegenerateThumbnails:
        config?.provider?.capabilities?.canRegenerateThumbnails || false,
      canManageTags: config?.provider?.capabilities?.canManageTags || false,
      ui: config?.ui || {},
      // Tags
      tags,
      tagsLoading,
      fetchTags,
      createTag,
      updateTag,
      deleteTag,
    }),
    [
      mediaFiles,
      allMediaFiles,
      loading,
      error,
      isScanning,
      isRegeneratingThumbnails,
      settings,
      navigate,
      setFilters,
      toggleGallery,
      selectMedia,
      rescan,
      regenerateThumbnails,
      config,
      configLoading,
      tags,
      tagsLoading,
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
          <SlideshowContext.Provider value={slideshowValue}>
            {children}
          </SlideshowContext.Provider>
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

/** Audio state — isMuted, hasUserInteracted, toggleMute, setMuted */
export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) throw new Error("useAudio must be used within MediaProvider");
  return context;
};

/** Slideshow state — slideshowActive, slideshowSpeed, toggleSlideshow, etc. */
export const useSlideshowState = () => {
  const context = useContext(SlideshowContext);
  if (!context)
    throw new Error("useSlideshowState must be used within MediaProvider");
  return context;
};

/** Backward-compatible hook — subscribes to ALL contexts (prefer granular hooks) */
export const useMedia = () => {
  const mediaData = useContext(MediaDataContext);
  const currentMedia = useContext(CurrentMediaContext);
  const audio = useContext(AudioContext);
  if (!mediaData) throw new Error("useMedia must be used within MediaProvider");
  return { ...mediaData, ...currentMedia, ...audio };
};
