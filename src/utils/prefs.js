// Display preferences. Each one is kept in localStorage and mirrored as a
// data attribute on <html>, where index.css reads it.
function pref(key, attribute, fallback) {
  return {
    get: () => localStorage.getItem(key) || fallback,
    set(value) {
      localStorage.setItem(key, value);
      document.documentElement.dataset[attribute] = value;
    },
  };
}

// The finish, "soft" or "matte" (data-skin).
export const skin = pref("cactus-skin", "skin", "soft");
// Whether the video's tide shows in the dock, "shown" or "hidden"
// (data-progress). Hiding it leaves the scrub gesture alone.
export const videoProgress = pref("cactus-video-progress", "progress", "shown");

export const initPrefs = () =>
  [skin, videoProgress].forEach((p) => p.set(p.get()));
