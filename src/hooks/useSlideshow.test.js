import { describe, expect, it } from "bun:test";
import { computeSlideshowTiming } from "./useSlideshow";

describe("computeSlideshowTiming", () => {
  it("uses the selected image interval", () => {
    expect(computeSlideshowTiming({ media_type: "image" }, "fast")).toEqual({
      startTime: 0,
      duration: 3000,
    });
  });

  it("shows a short video for its actual duration", () => {
    expect(
      computeSlideshowTiming({ media_type: "video", duration: 6 }),
    ).toEqual({ startTime: 0, duration: 6000 });
  });

  it("caps medium videos at the preset duration", () => {
    expect(
      computeSlideshowTiming({ media_type: "video", duration: 20 }),
    ).toEqual({ startTime: 0, duration: 10000 });
  });

  it("skips the intro of long videos", () => {
    expect(
      computeSlideshowTiming({ media_type: "video", duration: 100 }, "fast"),
    ).toEqual({ startTime: 10, duration: 6000 });
  });

  it("falls back to normal timing for an unknown preset", () => {
    expect(computeSlideshowTiming({ media_type: "image" }, "turbo")).toEqual({
      startTime: 0,
      duration: 5000,
    });
  });
});
