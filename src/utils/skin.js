// The finish ("soft" or "matte") is a data-skin attribute on <html>; the
// tokens for each live in index.css.
const KEY = "cactus-skin";

export const getSkin = () => localStorage.getItem(KEY) || "soft";

export function setSkin(skin) {
  localStorage.setItem(KEY, skin);
  document.documentElement.dataset.skin = skin;
}

export const initSkin = () => setSkin(getSkin());
