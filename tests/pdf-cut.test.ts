import { describe, expect, it } from "vitest";
import {
  clampRect,
  displayRectToPdfBox,
  displayedAspect,
  eachPageRanges,
  isFullRect,
  isValidCropRect,
  moveRect,
  parsePageRanges,
  rangePageIndexes,
  rectFromPoints,
  resizeRect,
} from "../shared/pdf-cut";

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe("crop rectangle editing", () => {
  it("moves a rectangle but never outside the page", () => {
    const moved = moveRect({ x: 0.1, y: 0.1, w: 0.5, h: 0.4 }, 0.9, -0.5);
    close(moved.x, 0.5);
    close(moved.y, 0);
    close(moved.w, 0.5);
    close(moved.h, 0.4);
  });

  it("resizes from a corner while the opposite corner stays fixed", () => {
    const next = resizeRect({ x: 0.2, y: 0.2, w: 0.4, h: 0.4 }, "br", 0.2, 0.1);
    close(next.x, 0.2);
    close(next.y, 0.2);
    close(next.w, 0.6);
    close(next.h, 0.5);
    const top = resizeRect({ x: 0.2, y: 0.2, w: 0.4, h: 0.4 }, "tl", -0.1, -0.1);
    close(top.x, 0.1);
    close(top.y, 0.1);
    close(top.x + top.w, 0.6);
    close(top.y + top.h, 0.6);
  });

  it("keeps a minimum size and stays inside the page when resizing past limits", () => {
    const small = resizeRect({ x: 0.2, y: 0.2, w: 0.4, h: 0.4 }, "r", -5, 0);
    expect(small.w).toBeGreaterThanOrEqual(0.05 - 1e-9);
    const big = resizeRect({ x: 0.2, y: 0.2, w: 0.4, h: 0.4 }, "bl", -5, 5);
    close(big.x, 0);
    close(big.y + big.h, 1);
  });

  it("builds a selection from two points in any direction", () => {
    const rect = rectFromPoints(0.8, 0.9, 0.3, 0.2);
    close(rect.x, 0.3);
    close(rect.y, 0.2);
    close(rect.w, 0.5);
    close(rect.h, 0.7);
  });

  it("validates rectangles", () => {
    expect(isValidCropRect({ x: 0, y: 0, w: 1, h: 1 })).toBe(true);
    expect(isFullRect({ x: 0, y: 0, w: 1, h: 1 })).toBe(true);
    expect(isValidCropRect({ x: 0.9, y: 0, w: 0.5, h: 1 })).toBe(false);
    expect(isValidCropRect(null)).toBe(false);
    expect(isValidCropRect({ x: 0, y: 0, w: Number.NaN, h: 1 })).toBe(false);
    expect(clampRect({ x: -1, y: 2, w: 3, h: 0 }).w).toBe(1);
  });
});

describe("displayed rectangle to PDF box", () => {
  const base = { x: 0, y: 0, width: 600, height: 800 };
  const rect = { x: 0.1, y: 0.2, w: 0.5, h: 0.25 };

  it("maps an unrotated page with a bottom-left origin", () => {
    const box = displayRectToPdfBox(rect, base, 0);
    close(box.x, 60);
    close(box.width, 300);
    close(box.height, 200);
    close(box.y, 800 * (1 - 0.45));
  });

  it("handles 90, 180 and 270 degree pages and a non-zero base origin", () => {
    // Top-left corner of a page displayed rotated 90deg clockwise is the
    // unrotated bottom-left corner.
    const box90 = displayRectToPdfBox({ x: 0, y: 0, w: 0.5, h: 0.5 }, base, 90);
    close(box90.x, 0);
    close(box90.y, 0);
    close(box90.width, 300);
    close(box90.height, 400);
    const box180 = displayRectToPdfBox({ x: 0, y: 0, w: 0.5, h: 0.5 }, base, 180);
    close(box180.x, 300);
    close(box180.y, 0);
    const box270 = displayRectToPdfBox({ x: 0, y: 0, w: 0.5, h: 0.5 }, base, 270);
    close(box270.x, 300);
    close(box270.y, 400);
    const shifted = displayRectToPdfBox({ x: 0, y: 0, w: 1, h: 1 }, { x: 10, y: 20, width: 100, height: 50 }, 0);
    expect(shifted).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it("swaps the displayed aspect ratio for sideways pages", () => {
    close(displayedAspect(600, 800, 0), 0.75);
    close(displayedAspect(600, 800, 90), 800 / 600);
    close(displayedAspect(0, 800, 0), 0.7071);
  });
});

describe("page ranges for splitting", () => {
  it("parses ranges, single pages and Arabic digits", () => {
    expect(parsePageRanges("1-3, 5, 7-9", 10)).toEqual([
      { from: 1, to: 3 },
      { from: 5, to: 5 },
      { from: 7, to: 9 },
    ]);
    expect(parsePageRanges("١-٣، ٥", 10)).toEqual([
      { from: 1, to: 3 },
      { from: 5, to: 5 },
    ]);
  });

  it("rejects out-of-range, reversed or malformed input", () => {
    expect(parsePageRanges("", 5)).toBeNull();
    expect(parsePageRanges("0-2", 5)).toBeNull();
    expect(parsePageRanges("3-2", 5)).toBeNull();
    expect(parsePageRanges("1-9", 5)).toBeNull();
    expect(parsePageRanges("a, 2", 5)).toBeNull();
    expect(parsePageRanges("1-2", 0)).toBeNull();
  });

  it("builds one range per page and lists page indexes", () => {
    expect(eachPageRanges(3)).toBe("1, 2, 3");
    expect(eachPageRanges(0)).toBe("");
    expect(rangePageIndexes({ from: 2, to: 4 })).toEqual([1, 2, 3]);
  });
});
