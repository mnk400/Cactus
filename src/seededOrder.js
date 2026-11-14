// Random order, made repeatable and stable. Each item's place comes only from
// a hash of the seed and its own id, so:
// - the same seed always gives the same order, whatever order items arrive in;
// - adding or removing items never moves the others relative to each other
//   (new ones slot in at random places), so a rescan keeps your neighbours;
// - a filtered list reads in the same order as the full one, minus the rest.

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

// Items carry their (unique) id in file_hash. Ties, vanishingly rare at 53
// bits, fall back to the id, so the order is always fully defined.
function seededOrder(files, seed) {
  return files
    .map((file) => ({
      file,
      id: file.file_hash,
      key: cyrb53(file.file_hash, seed),
    }))
    .sort((a, b) => a.key - b.key || (a.id < b.id ? -1 : 1))
    .map(({ file }) => file);
}

module.exports = { seededOrder };
