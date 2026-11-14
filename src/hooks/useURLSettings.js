import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  decodeSettingsFromURL,
  updateURL,
  resolveTagNames,
  isValidMediaType,
  isValidSortBy,
  withSeed,
} from "../utils/urlParams";

/**
 * Validates and sanitizes settings to ensure they contain valid values
 */
const validateAndSanitizeSettings = (settings) => {
  const sanitized = { ...settings };

  // Validate and sanitize mediaType
  if (!isValidMediaType(sanitized.mediaType)) {
    sanitized.mediaType = "all";
  }

  // Validate and sanitize sortBy
  if (!isValidSortBy(sanitized.sortBy)) {
    sanitized.sortBy = "random";
  }

  return withSeed(sanitized);
};

/**
 * Custom hook for managing settings through URL parameters
 */
export const useURLSettings = (availableTags = []) => {
  // Initialize with validated settings from URL (no effect needed)
  const [urlSettings, setUrlSettings] = useState(() => {
    const initialSettings = decodeSettingsFromURL();
    return validateAndSanitizeSettings(initialSettings);
  });
  const [isInitialized] = useState(true);

  // A URL with no seed got a fresh one above; write it back so a reload
  // keeps this order.
  useEffect(() => {
    updateURL(urlSettings, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on load
  }, []);

  // Listen for browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const newSettings = decodeSettingsFromURL();
      // Validate and sanitize settings (same as initialization)
      const sanitizedSettings = validateAndSanitizeSettings(newSettings);
      updateURL(sanitizedSettings, true); // in case it got a fresh seed
      setUrlSettings(sanitizedSettings);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Resolve tag names to tag objects when available tags change
  const resolvedSettings = useMemo(
    () => ({
      ...urlSettings,
      selectedTags: resolveTagNames(urlSettings.selectedTags, availableTags),
      excludedTags: resolveTagNames(urlSettings.excludedTags, availableTags),
    }),
    [urlSettings, availableTags],
  );

  // The latest settings, including updates React has not rendered yet, so
  // two updates in a row merge instead of the second losing the first.
  const latest = useRef(urlSettings);
  useEffect(() => {
    latest.current = urlSettings;
  }, [urlSettings]);

  // Update URL and state. The URL is written here, once per call: a state
  // updater may run more than once (StrictMode does), and each run would
  // push another history entry.
  const updateSettings = useCallback((newSettings, options = {}) => {
    const { updateURL: shouldUpdateURL = true, replace = false } = options;
    const prev = latest.current;
    const merged = { ...prev, ...newSettings };
    // Switching the sort to random starts a fresh order; staying on random
    // (changing filters, clearing them) keeps this one.
    if (merged.sortBy !== prev.sortBy) merged.seed = 0;
    const mergedSettings = withSeed(merged);

    // Convert tag objects to tag names for URL storage
    const settingsForURL = {
      ...mergedSettings,
      selectedTags:
        mergedSettings.selectedTags?.map((tag) => tag.name || tag) || [],
      excludedTags:
        mergedSettings.excludedTags?.map((tag) => tag.name || tag) || [],
    };

    latest.current = settingsForURL;
    if (shouldUpdateURL) updateURL(settingsForURL, replace);
    setUrlSettings(settingsForURL);
  }, []);

  // Clear all settings
  const clearSettings = useCallback(() => {
    const defaultSettings = {
      mediaType: "all",
      sortBy: "random",
      selectedTags: [],
      excludedTags: [],
      search: "",
      galleryView: false,
      debug: false,
      mediaId: "",
    };

    updateSettings(defaultSettings);
  }, [updateSettings]);

  // For callers that may update twice before React renders, and so must
  // compare against the latest settings rather than the rendered ones.
  const getLatestSettings = useCallback(() => latest.current, []);

  return {
    settings: resolvedSettings,
    rawSettings: urlSettings,
    getLatestSettings,
    updateSettings,
    clearSettings,
    isInitialized,
  };
};
