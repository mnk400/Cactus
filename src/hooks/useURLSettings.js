import { useState, useEffect, useCallback } from 'react';
import { 
  decodeSettingsFromURL, 
  updateURL, 
  resolveTagNames,
  isValidMediaType,
  isValidSortBy 
} from '../utils/urlParams';

/**
 * Custom hook for managing settings through URL parameters
 */
export const useURLSettings = (availableTags = []) => {
  const [urlSettings, setUrlSettings] = useState(() => decodeSettingsFromURL());
  const [isInitialized, setIsInitialized] = useState(false);

  // Listen for browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const newSettings = decodeSettingsFromURL();
      setUrlSettings(newSettings);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Initialize settings from URL on mount
  useEffect(() => {
    const initialSettings = decodeSettingsFromURL();
    
    // Validate and sanitize settings
    if (!isValidMediaType(initialSettings.mediaType)) {
      initialSettings.mediaType = 'all';
    }
    
    if (!isValidSortBy(initialSettings.sortBy)) {
      initialSettings.sortBy = 'random';
    }
    
    setUrlSettings(initialSettings);
    setIsInitialized(true);
  }, []);

  // Resolve tag names to tag objects when available tags change
  const resolvedSettings = {
    ...urlSettings,
    selectedTags: resolveTagNames(urlSettings.selectedTags, availableTags),
    excludedTags: resolveTagNames(urlSettings.excludedTags, availableTags)
  };

  // Update URL and state
  const updateSettings = useCallback((newSettings, options = {}) => {
    const { 
      updateURL: shouldUpdateURL = true, 
      replace = false 
    } = options;
    
    // Convert tag objects to tag names for URL storage
    const settingsForURL = {
      ...newSettings,
      selectedTags: newSettings.selectedTags?.map(tag => tag.name || tag) || [],
      excludedTags: newSettings.excludedTags?.map(tag => tag.name || tag) || []
    };
    
    setUrlSettings(settingsForURL);
    
    if (shouldUpdateURL) {
      updateURL(settingsForURL, replace);
    }
  }, []);

  // Update individual setting
  const updateSetting = useCallback((key, value, options = {}) => {
    updateSettings({
      ...urlSettings,
      [key]: value
    }, options);
  }, [urlSettings, updateSettings]);

  // Clear all settings
  const clearSettings = useCallback(() => {
    const defaultSettings = {
      mediaType: 'all',
      sortBy: 'random',
      selectedTags: [],
      excludedTags: [],
      pathFilter: '',
      galleryView: false,
      debug: false,
      mediaId: ''
    };
    
    updateSettings(defaultSettings);
  }, [updateSettings]);

  return {
    settings: resolvedSettings,
    rawSettings: urlSettings,
    updateSettings,
    updateSetting,
    clearSettings,
    isInitialized
  };
};