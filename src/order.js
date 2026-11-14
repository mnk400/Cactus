// The order of the list, in one place. The server orders every list with
// orderFiles, and the client finds its way through a filter with indexAfter;
// both go by the same key, so they can never disagree.
//
// Each item's place comes only from its own key (and, for ties, its id), never
// from which other items are in the list. So:
// - the same sort (and seed) always gives the same order, whatever order the
//   provider returns items in;
// - adding or removing items never moves the others relative to each other
//   (new ones slot in at their place), so a rescan keeps your neighbours;
// - a filtered list reads in the same order as the full one, minus the rest.
//
// Random is a seed: the key is a hash of the seed and the item's id. The date
// sorts are newest first, undated items last.

// cyrb53: a small, well-mixed 53-bit string hash (not cryptographic; it only
// has to scatter items evenly). Seeded, so each seed is its own order.
function cyrb53(str, seed) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// Newest first: the key is minus the time, so undated (no or unreadable date)
// is +Infinity and sorts last.
const newestFirst = (field) => (file) => {
  const t = Date.parse(file[field]);
  return Number.isNaN(t) ? Infinity : -t;
};

// Each sort's key: ascending key is the order.
const KEYS = {
  random: (seed) => (file) => cyrb53(file.file_hash, seed),
  date_added: () => newestFirst("date_added"),
  date_created: () => newestFirst("date_created"),
};

// Items carry their (unique) id in file_hash; equal keys (two photos from the
// same day, or a hash collision) fall back to it, so the order is always fully
// defined.
const byKey = (a, b) => {
  if (a.key !== b.key) return a.key < b.key ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
};

const keyOf = (sortBy, seed) => (KEYS[sortBy] || KEYS.random)(seed);
const ranked = (key) => (file) => ({
  file,
  id: file.file_hash,
  key: key(file),
});

export function orderFiles(files, sortBy, seed) {
  return files
    .map(ranked(keyOf(sortBy, seed)))
    .sort(byKey)
    .map(({ file }) => file);
}

// Where `file` falls among `files` (a list orderFiles ordered with the same
// sort and seed): the index of the first one that comes after it, or 0 when
// none does, since the feed wraps. Every filtered list is the full list with
// items left out, so "after" means the same in all of them; this is how a
// filter that hides the item you are on lands on the next one it kept.
export function indexAfter(files, file, sortBy, seed) {
  const rank = ranked(keyOf(sortBy, seed));
  const anchor = rank(file);
  const index = files.findIndex((f) => byKey(rank(f), anchor) > 0);
  return index === -1 ? 0 : index;
}
