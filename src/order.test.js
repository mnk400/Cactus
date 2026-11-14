import { describe, expect, test } from "bun:test";
import { createHash, randomBytes } from "crypto";
import { indexAfter, orderFiles } from "./order";

const seededOrder = (files, seed) => orderFiles(files, "random", seed);

// Local ids are sha256 hex; sb ids are short and sequential (the harder case
// for a hash to scatter evenly).
const localIds = (n) =>
  Array.from({ length: n }, () => ({
    file_hash: randomBytes(32).toString("hex"),
  }));
// Fixed local-style ids, for the statistical test to give the same answer
// on every run.
const fixedLocalIds = (n) =>
  Array.from({ length: n }, (_, i) => ({
    file_hash: createHash("sha256").update(String(i)).digest("hex"),
  }));
const sbIds = (n, from = 1) =>
  Array.from({ length: n }, (_, i) => ({ file_hash: `sb_${from + i}` }));
const ids = (list) => list.map((f) => f.file_hash);
const shuffled = (list) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
// Share of item pairs two orders agree on: 1 is identical, ~0.5 unrelated.
const pairAgreement = (a, b) => {
  const pos = new Map(ids(b).map((id, i) => [id, i]));
  const p = ids(a).map((id) => pos.get(id));
  let same = 0;
  let total = 0;
  for (let k = 0; k < 20000; k++) {
    const i = Math.floor(Math.random() * p.length);
    const j = Math.floor(Math.random() * p.length);
    if (i === j) continue;
    total++;
    if (i < j === p[i] < p[j]) same++;
  }
  return same / total;
};
const seeds = [1, 2, 42, 189193851, 2147483646, 2147483647];

describe("random order", () => {
  test("is a permutation: nothing lost, nothing doubled", () => {
    for (const n of [0, 1, 2, 10, 1000]) {
      const list = localIds(n);
      const out = seededOrder(list, 42);
      expect(out.length).toBe(n);
      expect(new Set(ids(out))).toEqual(new Set(ids(list)));
    }
  });

  test("same seed, same order, whatever order items arrive in", () => {
    const list = [...localIds(500), ...sbIds(500)];
    for (const seed of seeds) {
      const first = ids(seededOrder(list, seed));
      for (let k = 0; k < 5; k++)
        expect(ids(seededOrder(shuffled(list), seed))).toEqual(first);
    }
  });

  test("does not change its input", () => {
    const list = localIds(50);
    const before = ids(list);
    seededOrder(list, 7);
    expect(ids(list)).toEqual(before);
  });

  test("different seeds give unrelated orders, adjacent seeds too", () => {
    for (const make of [localIds, sbIds]) {
      const list = make(5000);
      for (const [a, b] of [
        [1, 2],
        [42, 43],
        [189193851, 7],
        [2147483646, 2147483647],
      ]) {
        const agree = pairAgreement(seededOrder(list, a), seededOrder(list, b));
        expect(agree).toBeGreaterThan(0.47);
        expect(agree).toBeLessThan(0.53);
      }
    }
  });

  test("adding items never reorders the existing ones", () => {
    for (const seed of seeds) {
      for (const [make, more] of [
        [localIds, localIds(1)],
        [localIds, localIds(500)],
        [sbIds, sbIds(50, 10001)],
      ]) {
        const list = make(2000);
        const before = ids(seededOrder(list, seed));
        const after = ids(seededOrder([...list, ...more], seed));
        const old = new Set(before);
        expect(after.filter((id) => old.has(id))).toEqual(before);
      }
    }
  });

  test("new items land spread through the order, not bunched at one end", () => {
    const list = localIds(4000);
    const added = localIds(400);
    const fresh = new Set(ids(added));
    const after = ids(seededOrder([...list, ...added], 42));
    const quarters = [0, 0, 0, 0];
    after.forEach(
      (id, i) =>
        fresh.has(id) && quarters[Math.floor((4 * i) / after.length)]++,
    );
    for (const q of quarters) expect(q).toBeGreaterThan(60); // 100 expected each
  });

  test("removing items never reorders the rest", () => {
    for (const seed of seeds) {
      const list = localIds(2000);
      const kept = list.filter(() => Math.random() > 0.3);
      const keep = new Set(ids(kept));
      const before = ids(seededOrder(list, seed)).filter((id) => keep.has(id));
      expect(ids(seededOrder(kept, seed))).toEqual(before);
    }
  });

  test("a filtered list is the full order with the rest left out", () => {
    const list = [...localIds(1000), ...sbIds(1000)];
    for (const seed of seeds) {
      const full = ids(seededOrder(list, seed));
      const subset = list.filter((f, i) => i % 3 === 0);
      const keep = new Set(ids(subset));
      expect(ids(seededOrder(subset, seed))).toEqual(
        full.filter((id) => keep.has(id)),
      );
    }
  });

  // Over many seeds, each item should take each place 1/6 of the time.
  // Sequential seeds, as a worst case for correlation between seeds. Fixed
  // ids and seeds, so this never fails by chance on one run and not the next.
  test("every item is equally likely in every place", () => {
    for (const list of [sbIds(6), fixedLocalIds(6)]) {
      const runs = 60000;
      const counts = Object.fromEntries(
        ids(list).map((id) => [id, [0, 0, 0, 0, 0, 0]]),
      );
      for (let seed = 1; seed <= runs; seed++)
        ids(seededOrder(list, seed)).forEach(
          (id, place) => counts[id][place]++,
        );
      // Pearson's statistic over the 6x6 table. Each run fills every row and
      // column once, so for uniform orders it is 6/5 of a chi-square with 25
      // degrees of freedom (mean 30, not 25); p = 0.001 cut-off is 52.6.
      const expected = runs / 6;
      let t = 0;
      for (const row of Object.values(counts))
        for (const c of row) t += (c - expected) ** 2 / expected;
      expect((t * 5) / 6).toBeLessThan(52.6);
    }
  });
});

// A B C D E F G is the full order; a filter keeps B D F.
describe("indexAfter", () => {
  const letters = (order) => {
    const [a, b, c, d, e, f, g] = order;
    return { a, b, c, d, e, f, g, kept: [b, d, f] };
  };

  test("random: lands on the next item the filter kept, wrapping", () => {
    for (const seed of seeds) {
      const { a, c, e, g, kept } = letters(seededOrder(localIds(7), seed));
      expect(indexAfter(kept, a, "random", seed)).toBe(0); // A → B
      expect(indexAfter(kept, c, "random", seed)).toBe(1); // C → D
      expect(indexAfter(kept, e, "random", seed)).toBe(2); // E → F
      expect(indexAfter(kept, g, "random", seed)).toBe(0); // G → B (wraps)
    }
  });

  test("random: works between two filters that share nothing", () => {
    for (const seed of seeds) {
      const full = seededOrder(localIds(500), seed);
      const one = full.filter((_, i) => i % 2 === 0);
      const other = full.filter((_, i) => i % 2 === 1);
      // Each item of one lands on the item right after it in the full order.
      one.forEach((file, i) => {
        const next = full[(full.indexOf(file) + 1) % full.length];
        const expected = other.indexOf(next);
        expect(indexAfter(other, one[i], "random", seed)).toBe(
          expected === -1 ? 0 : expected,
        );
      });
    }
  });

  test("date sorts: newest first, the next older kept item", () => {
    const day = (n) => new Date(Date.UTC(2026, 0, 10 - n)).toISOString();
    const full = Array.from({ length: 7 }, (_, n) => ({
      file_hash: String(n),
      date_added: day(n),
      date_created: day(n),
    }));
    for (const sortBy of ["date_added", "date_created"]) {
      expect(ids(orderFiles(shuffled(full), sortBy))).toEqual(ids(full));
      const { c, g, kept } = letters(full);
      expect(indexAfter(kept, c, sortBy, 0)).toBe(1); // C → D
      expect(indexAfter(kept, g, sortBy, 0)).toBe(0); // G → B (wraps)
    }
  });

  // sb dates are often a day with no time, so many items share one.
  test("date sorts: same-day items keep one order and none is skipped", () => {
    const full = orderFiles(
      sbIds(7).map((f) => ({ ...f, date_created: "2024-05-01" })),
      "date_created",
    );
    expect(ids(orderFiles(shuffled(full), "date_created"))).toEqual(ids(full));
    const { c, e, kept } = letters(full);
    expect(indexAfter(kept, c, "date_created", 0)).toBe(1); // C → D
    expect(indexAfter(kept, e, "date_created", 0)).toBe(2); // E → F
  });

  test("date sorts: undated items come last", () => {
    const dated = { file_hash: "a", date_added: "2024-05-01T10:00:00Z" };
    const none = { file_hash: "b" };
    const junk = { file_hash: "c", date_added: "not a date" };
    expect(ids(orderFiles([junk, none, dated], "date_added"))).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(indexAfter([none, junk], dated, "date_added", 0)).toBe(0);
    expect(indexAfter([dated, junk], none, "date_added", 0)).toBe(1);
  });
});
