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

const MediaContext = createContext();

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

      try {
        setLoading(`Loading ${params.type} media...`);
        setError(null);

        let url = `/api/media?type=${params.type}&sortBy=${params.sortBy}`;
        if (params.tags) url += `&tags=${params.tags}`;
        if (params["exclude-tags"])
          url += `&exclude-tags=${params["exclude-tags"]}`;
        if (params.pathSubstring)
          url += `&pathSubstring=${encodeURIComponent(params.pathSubstring)}`;

        const response = await fetch(url);
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
        setError(err.message);
        setMediaFiles([]);
      } finally {
        setLoading(null);
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
      await Promise.all([fetchConfig(), fetchTags()]);

      // Fetch all media for statistics
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

  // Sync state to URL when index changes
  useEffect(() => {
    if (currentMediaFile && isUrlInitialized && !isUrlSync) {
      if (currentMediaFile.file_hash !== mediaId) {
        updateSetting("mediaId", currentMediaFile.file_hash, { replace: true });
      }
    }
    if (isUrlSync) setIsUrlSync(false);
  }, [
    currentIndex,
    currentMediaFile,
    isUrlInitialized,
    mediaId,
    isUrlSync,
    updateSetting,
  ]);

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

  // Public API
  const setFilters = useCallback(
    (newSettings) => {
      updateSettings({ ...newSettings, mediaId: "" });
      fetchMedia({ ...newSettings, mediaId: "" });
    },
    [updateSettings, fetchMedia],
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

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
    setHasUserInteracted(true);
  }, []);

  const setMuted = useCallback((muted) => {
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

  const value = {
    mediaFiles,
    allMediaFiles,
    currentIndex,
    currentMediaFile,
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
    // Audio
    isMuted,
    hasUserInteracted,
    toggleMute,
    setMuted,
  };

  return (
    <MediaContext.Provider value={value}>{children}</MediaContext.Provider>
  );
};

export const useMedia = () => {
  const context = useContext(MediaContext);
  if (!context) throw new Error("useMedia must be used within MediaProvider");
  return context;
};
