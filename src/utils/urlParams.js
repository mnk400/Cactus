/**
 * URL Parameter Utilities for Settings Management
 * Handles encoding/decoding settings to/from URL parameters
 */

// URL parameter keys
export const URL_PARAMS = {
  MEDIA_TYPE: "type",
  SORT_BY: "sort",
  SELECTED_TAGS: "tags",
  EXCLUDED_TAGS: "exclude",
  PATH_FILTER: "path",
  GALLERY_VIEW: "gallery",
  DEBUG: "debug",
  MEDIA_ID: "media",
};

/**
 * Encodes settings object to URL parameters
 */
export const encodeSettingsToURL = (settings) => {
  const params = new URLSearchParams();

  if (settings.mediaType && settings.mediaType !== "all") {
    params.set(URL_PARAMS.MEDIA_TYPE, settings.mediaType);
  }

  if (settings.sortBy && settings.sortBy !== "random") {
    params.set(URL_PARAMS.SORT_BY, settings.sortBy);
  }

  if (settings.selectedTags && settings.selectedTags.length > 0) {
    const tagNames = settings.selectedTags
      .map((tag) => tag.name || tag)
      .join(",");
    params.set(URL_PARAMS.SELECTED_TAGS, tagNames);
  }

  if (settings.excludedTags && settings.excludedTags.length > 0) {
    const tagNames = settings.excludedTags
      .map((tag) => tag.name || tag)
      .join(",");
    params.set(URL_PARAMS.EXCLUDED_TAGS, tagNames);
  }

  if (settings.pathFilter && settings.pathFilter.trim()) {
    params.set(URL_PARAMS.PATH_FILTER, settings.pathFilter);
  }

  if (settings.galleryView) {
    params.set(URL_PARAMS.GALLERY_VIEW, "true");
  }

  if (settings.debug) {
    params.set(URL_PARAMS.DEBUG, "true");
  }

  if (settings.mediaId && settings.mediaId.trim()) {
    params.set(URL_PARAMS.MEDIA_ID, settings.mediaId);
  }

  return params.toString();
};

/**
 * Decodes URL parameters to settings object
 */
export const decodeSettingsFromURL = (
  searchParams = window.location.search,
) => {
  const params = new URLSearchParams(searchParams);

  const settings = {
    mediaType: params.get(URL_PARAMS.MEDIA_TYPE) || "all",
    sortBy: params.get(URL_PARAMS.SORT_BY) || "random",
    selectedTags: [],
    excludedTags: [],
    pathFilter: params.get(URL_PARAMS.PATH_FILTER) || "",
    galleryView: params.get(URL_PARAMS.GALLERY_VIEW) === "true",
    debug: params.get(URL_PARAMS.DEBUG) === "true",
    mediaId: params.get(URL_PARAMS.MEDIA_ID) || "",
  };

  // Parse selected tags
  const selectedTagsParam = params.get(URL_PARAMS.SELECTED_TAGS);
  if (selectedTagsParam) {
    settings.selectedTags = selectedTagsParam
      .split(",")
      .filter((tag) => tag.trim());
  }

  // Parse excluded tags
  const excludedTagsParam = params.get(URL_PARAMS.EXCLUDED_TAGS);
  if (excludedTagsParam) {
    settings.excludedTags = excludedTagsParam
      .split(",")
      .filter((tag) => tag.trim());
  }

  return settings;
};

/**
 * Updates the browser URL with current settings
 */
export const updateURL = (settings, replace = false) => {
  const paramString = encodeSettingsToURL(settings);
  const newURL = paramString
    ? `${window.location.pathname}?${paramString}`
    : window.location.pathname;

  if (replace) {
    window.history.replaceState({}, "", newURL);
  } else {
    window.history.pushState({}, "", newURL);
  }
};

/**
 * Validates media type parameter
 */
export const isValidMediaType = (type) => {
  return ["all", "photos", "videos"].includes(type);
};

/**
 * Validates sort by parameter
 */
export const isValidSortBy = (sortBy) => {
  return ["random", "date_added", "date_created"].includes(sortBy);
};

/**
 * Converts tag names to tag objects (requires tags array from API)
 */
export const resolveTagNames = (tagNames, availableTags) => {
  if (!Array.isArray(tagNames) || !Array.isArray(availableTags)) {
    return [];
  }

  return tagNames
    .map((tagName) => availableTags.find((tag) => tag.name === tagName))
    .filter(Boolean); // Remove undefined values
};

/**
 * Gets current settings from URL
 */
export const getCurrentSettingsFromURL = () => {
  return decodeSettingsFromURL();
};

/**
 * Finds the index of a media file by its hash
 */
export const findMediaIndexByHash = (mediaFiles, hash) => {
  if (!hash || !Array.isArray(mediaFiles)) {
    return -1;
  }

  return mediaFiles.findIndex((file) => file.file_hash === hash);
};

/**
 * Clears all URL parameters
 */
export const clearURLParams = () => {
  window.history.replaceState({}, "", window.location.pathname);
};
