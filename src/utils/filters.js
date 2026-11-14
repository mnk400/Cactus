// What the list is, in one place: which items (the filters) and in what order
// (the sort, and a seed when random). Everything that compares, fetches or
// shows the list goes through here; the order itself is src/order.js.
//
// A filter is anything that hides items: search, tags, excluded tags, media
// type. Sort is not one; it orders the same items. So clearing leaves the
// sort alone, and only filters count toward the dock's count, the badge's ×
// and the history's filter session.

export const MEDIA_TYPES = [
  { value: "all", label: "all" },
  { value: "photos", label: "photos" },
  { value: "videos", label: "videos" },
];

// `long` is how the badge names a sort that is not the default.
export const SORT_OPTIONS = [
  { value: "random", label: "random" },
  { value: "date_added", label: "added", long: "by date added" },
  { value: "date_created", label: "created", long: "by date created" },
];

export const NO_FILTERS = {
  mediaType: "all",
  selectedTags: [],
  excludedTags: [],
  search: "",
};

// Tags are objects once resolved, names in the URL; either reads as names.
export const tagNames = (list = []) => list.map((tag) => tag.name || tag);

// Spaces alone are no search (the server trims it too).
const searchOf = (settings) => settings.search?.trim() || "";

// Two settings with the same key show the same list.
export const listKey = (settings) =>
  JSON.stringify([
    settings.mediaType,
    settings.sortBy,
    settings.sortBy === "random" ? settings.seed : 0,
    tagNames(settings.selectedTags),
    tagNames(settings.excludedTags),
    searchOf(settings),
  ]);

// The /api/media query for the list.
export const apiQuery = (settings) => {
  const params = new URLSearchParams({
    type: settings.mediaType,
    sortBy: settings.sortBy,
  });
  if (settings.sortBy === "random") params.set("seed", settings.seed);
  const tags = tagNames(settings.selectedTags).join(",");
  const excluded = tagNames(settings.excludedTags).join(",");
  if (tags) params.set("tags", tags);
  if (excluded) params.set("exclude-tags", excluded);
  if (searchOf(settings)) params.set("search", searchOf(settings));
  return params.toString();
};

// One short label per active filter, in the order the badge reads them.
export const filterParts = (settings) => [
  ...(searchOf(settings) ? [searchOf(settings)] : []),
  ...tagNames(settings.selectedTags),
  ...tagNames(settings.excludedTags).map((name) => `−${name}`),
  ...(settings.mediaType && settings.mediaType !== "all"
    ? [settings.mediaType]
    : []),
];

export const isFiltered = (settings) => filterParts(settings).length > 0;

// The sort, when it is not the default random; otherwise "".
export const sortLabel = (settings) =>
  SORT_OPTIONS.find((option) => option.value === settings.sortBy)?.long || "";
