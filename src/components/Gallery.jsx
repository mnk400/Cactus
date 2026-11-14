import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const SIDE = 14; // the grid's side margin: tiles start 18px in, like the feed's card
const CELL = 4; // space around each tile, so half the gap between tiles
const BOTTOM = 96; // room below the last row for the dock
// The scroller runs this far past the stage's bottom edge, so where the
// browser floats its own bar over the page there (Safari on a folded
// iPhone) tiles carry on under it instead of ending on a line. Everywhere
// else that part is off screen. "The view" below is the stage's share.
const UNDER = 160;
const viewOf = (scroller) => scroller.clientHeight - UNDER;
const OVERSCAN = 0.75; // viewports of tiles kept drawn beyond each edge
export const TILE_RADIUS = 8;

const aspectOf = (file) =>
  file?.width && file?.height ? file.width / file.height : 1.2;

const columnsFor = (width) => {
  if (width < 520) return 2;
  if (width < 860) return 3;
  if (width < 1180) return 4;
  if (width < 1500) return 5;
  return 6;
};

// Masonry: each item goes to the shortest column. Every item's shape is
// known before anything is drawn, so this is the exact layout, not an
// estimate: any tile's position is a lookup.
const layOut = (files, width) => {
  const count = columnsFor(width);
  const w = (width - SIDE * 2) / count;
  const n = files.length;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const h = new Float64Array(n);
  const heights = new Array(count).fill(0);
  const columns = Array.from({ length: count }, () => []);
  for (let i = 0; i < n; i++) {
    let c = 0;
    for (let k = 1; k < count; k++) if (heights[k] < heights[c]) c = k;
    x[i] = SIDE + c * w;
    y[i] = heights[c];
    h[i] = (w - CELL * 2) / aspectOf(files[i]) + CELL * 2;
    heights[c] += h[i];
    columns[c].push(i);
  }
  return { w, x, y, h, columns, height: Math.max(0, ...heights) + BOTTOM };
};

// Tiles overlapping [top, bottom). Within a column, tops only grow, so each
// column is a binary search plus a short walk.
const tilesIn = ({ columns, y, h }, top, bottom) => {
  const out = [];
  for (const column of columns) {
    let lo = 0;
    let hi = column.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (y[column[mid]] + h[column[mid]] <= top) lo = mid + 1;
      else hi = mid;
    }
    for (let k = lo; k < column.length && y[column[k]] < bottom; k++) {
      out.push(column[k]);
    }
  }
  return out;
};

const Tile = memo(function Tile({
  file,
  index,
  x,
  y,
  w,
  h,
  selected,
  hidden,
  onSelect,
}) {
  return (
    <button
      type="button"
      data-gallery-index={index}
      className={`absolute top-0 left-0 cursor-pointer rounded-[12px] border-0 bg-transparent text-left text-inherit outline-offset-[-2px] ${
        selected ? "outline outline-2 outline-white/90" : ""
      }`}
      style={{
        padding: CELL,
        width: w,
        height: h,
        transform: `translate(${x}px, ${y}px)`,
        visibility: hidden ? "hidden" : undefined,
      }}
      onClick={() => onSelect(index)}
      aria-label={`Open ${file.displayName || `media ${index + 1}`}`}
    >
      <div
        className="relative h-full w-full overflow-hidden bg-white/[0.04]"
        style={{ borderRadius: TILE_RADIUS }}
      >
        <img
          src={`/thumbnails?hash=${file.file_hash}`}
          alt=""
          className="pointer-events-none block h-full w-full object-cover"
          decoding="async"
          draggable={false}
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />
        {file.media_type === "video" && (
          <span
            className="pointer-events-none absolute right-1.5 bottom-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-[15px] w-[15px]"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        )}
      </div>
    </button>
  );
});

// The grid. It lays itself out (see layOut), draws only the tiles near the
// viewport, and keeps the current item in view whenever that item or the
// list changes (a tap, arrow keys, a filter); only the user's own scrolling
// takes the current tile off screen. The zoom between feed and gallery asks
// it where a tile is (rectOf), to bring one into view (reveal), and to hide
// the tile the flying photo stands in for (setHidden).
const Gallery = forwardRef(function Gallery(
  { files, currentIndex, onSelect },
  ref,
) {
  // For the layout effect below, which must not rerun on every move.
  const currentRef = useRef(currentIndex);
  useLayoutEffect(() => {
    currentRef.current = currentIndex;
  });
  const scrollerRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState([]);
  const [hidden, setHidden] = useState(null);
  const visibleKey = useRef("");
  const frame = useRef(0);
  // Which tile is at the middle of the viewport, and where, so a new width
  // (rotation, fold) keeps the same part of the library in view.
  const anchor = useRef(null);
  const previous = useRef({ files: null, layout: null });

  const layout = useMemo(
    () => (width > 0 ? layOut(files, width) : null),
    [files, width],
  );

  const update = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !layout) return;
    const top = scroller.scrollTop;
    const view = viewOf(scroller);
    const tiles = tilesIn(
      layout,
      top - view * OVERSCAN,
      top + view * (1 + OVERSCAN) + UNDER,
    );
    const key = tiles.join(",");
    if (key !== visibleKey.current) {
      visibleKey.current = key;
      setVisible(tiles);
    }
    const middle = top + view / 2;
    let best = null;
    for (const i of tilesIn(layout, middle - 1, middle + 1)) {
      if (best === null || layout.x[i] < layout.x[best]) best = i;
    }
    if (best !== null) {
      anchor.current = {
        index: best,
        at: (layout.y[best] + layout.h[best] / 2 - top) / view,
      };
    }
  }, [layout]);

  const scrollTo = useCallback(
    (top) => {
      const scroller = scrollerRef.current;
      const max = Math.max(0, layout.height - viewOf(scroller));
      scroller.scrollTop = Math.max(0, Math.min(max, top));
      update();
    },
    [layout, update],
  );

  const centerOn = useCallback(
    (index, at = 0.5) => {
      const view = viewOf(scrollerRef.current);
      scrollTo(layout.y[index] + layout.h[index] / 2 - at * view);
    },
    [layout, scrollTo],
  );

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const observer = new ResizeObserver(() => setWidth(scroller.clientWidth));
    observer.observe(scroller);
    setWidth(scroller.clientWidth);
    return () => observer.disconnect();
  }, []);

  // Scroll just enough to show the tile: centered if it was out of view,
  // untouched if most of it was already showing (a tile taller than the
  // viewport counts as showing when it fills most of it).
  const reveal = useCallback(
    (index) => {
      const scroller = scrollerRef.current;
      if (!layout || !scroller || !files[index]) return;
      const top = layout.y[index];
      const height = layout.h[index];
      const view = viewOf(scroller);
      const shown =
        Math.min(top + height, scroller.scrollTop + view) -
        Math.max(top, scroller.scrollTop);
      if (shown < Math.min(height, view) * 0.9) centerOn(index);
    },
    [layout, files, centerOn],
  );

  // A new layout. A new width keeps the anchor tile where it was on screen;
  // anything else (first show, a new list) puts the current item in view.
  useLayoutEffect(() => {
    if (!layout) return;
    const before = previous.current;
    previous.current = { files, layout };
    const resized = before.layout && before.files === files;
    if (resized && anchor.current && files[anchor.current.index]) {
      centerOn(anchor.current.index, anchor.current.at);
    } else if (files[currentRef.current]) {
      anchor.current = null;
      if (!resized) centerOn(currentRef.current);
      else reveal(currentRef.current);
    } else {
      scrollTo(0);
    }
  }, [layout, files, centerOn, reveal, scrollTo]);

  // The current item moved (arrow keys, a tap, the feed): follow it. Only
  // on a move, so a new width alone keeps the user's place.
  const followed = useRef(currentIndex);
  useLayoutEffect(() => {
    if (followed.current === currentIndex) return;
    followed.current = currentIndex;
    reveal(currentIndex);
  }, [currentIndex, reveal]);

  const onScroll = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      update();
    });
  }, [update]);

  useLayoutEffect(() => () => cancelAnimationFrame(frame.current), []);

  useImperativeHandle(
    ref,
    () => ({
      // The tile's picture (inside its padding) relative to the gallery's
      // own box, whether or not it is drawn or on screen. Pure layout math:
      // no measuring, so a transform on the gallery does not skew it.
      rectOf(index) {
        const scroller = scrollerRef.current;
        if (!layout || !scroller || !files[index]) return null;
        return {
          left: layout.x[index] + CELL,
          top: layout.y[index] + CELL - scroller.scrollTop,
          width: layout.w - CELL * 2,
          height: layout.h[index] - CELL * 2,
        };
      },
      reveal,
      setHidden,
    }),
    [layout, files, reveal],
  );

  return (
    <div
      ref={scrollerRef}
      className="w-full overflow-x-hidden overflow-y-auto scrollbar-hide [-webkit-overflow-scrolling:touch]"
      // The padding keeps that part from counting as "in view" when the
      // browser brings a focused tile into view.
      style={{ height: `calc(100% + ${UNDER}px)`, scrollPaddingBottom: UNDER }}
      onScroll={onScroll}
    >
      {layout && (
        <div
          className="relative w-full"
          style={{ height: layout.height + UNDER }}
        >
          {visible.map((i) =>
            files[i] ? (
              <Tile
                key={files[i].file_hash}
                file={files[i]}
                index={i}
                x={layout.x[i]}
                y={layout.y[i]}
                w={layout.w}
                h={layout.h[i]}
                selected={i === currentIndex}
                hidden={i === hidden}
                onSelect={onSelect}
              />
            ) : null,
          )}
        </div>
      )}
    </div>
  );
});

export default Gallery;
