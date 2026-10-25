import { describe, expect, it } from "vitest";
import {
  deleteSelectedPages,
  keepSelectedPages,
  rotateSelectedPages,
  type PdfPageEdit,
} from "../shared/pdf-pages";
import {
  dragTargetIndex,
  edgeScrollSpeed,
  gridTargetIndex,
  pruneSelection,
  rotateSelectedFiles,
  stepPreviewZoom,
  stepToward,
  toggleSelected,
} from "../shared/workflow-files";

describe("drag reordering", () => {
  it("maps finger movement to the slot the row should occupy", () => {
    expect(dragTargetIndex(0, 50, 62, 3)).toBe(1);
    expect(dragTargetIndex(0, 20, 62, 3)).toBe(0);
    expect(dragTargetIndex(2, -200, 62, 3)).toBe(0);
    expect(dragTargetIndex(1, 999, 62, 3)).toBe(2);
  });

  it("stays safe for empty lists and invalid input", () => {
    expect(dragTargetIndex(0, 10, 62, 0)).toBe(0);
    expect(dragTargetIndex(1, Number.NaN, 62, 3)).toBe(1);
    expect(dragTargetIndex(1, 40, 0, 3)).toBe(1);
  });

  it("moves one slot at a time toward the target", () => {
    expect(stepToward(0, 3)).toBe(1);
    expect(stepToward(3, 0)).toBe(2);
    expect(stepToward(2, 2)).toBe(2);
  });
});

describe("multi-select rotation", () => {
  it("toggles and prunes selected keys", () => {
    expect(toggleSelected(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleSelected(["a", "b"], "a")).toEqual(["b"]);
    expect(pruneSelection(["a", "b"], ["b", "c"])).toEqual(["b"]);
  });

  it("rotates only the selected files and keeps order", () => {
    const files = [
      { uri: "a", rotation: 0 },
      { uri: "b" },
      { uri: "c", rotation: 270 },
    ];
    const next = rotateSelectedFiles(files, ["b", "c"]);
    expect(next.map((file) => file.uri)).toEqual(["a", "b", "c"]);
    expect(next.map((file) => file.rotation)).toEqual([0, 90, 0]);
    expect(files[1].rotation).toBeUndefined();
  });
});

describe("preview zoom", () => {
  it("steps through fixed zoom levels without leaving the range", () => {
    expect(stepPreviewZoom(1, 1)).toBe(1.5);
    expect(stepPreviewZoom(1, -1)).toBe(0.75);
    expect(stepPreviewZoom(0.5, -1)).toBe(0.5);
    expect(stepPreviewZoom(3, 1)).toBe(3);
  });
});

describe("grid drag reordering", () => {
  // 2 columns, 100 x 150 cells, 5 items: rows [0 1] [2 3] [4]
  it("maps a finger movement to the grid slot under it", () => {
    expect(gridTargetIndex(0, 110, 0, 2, 100, 150, 5)).toBe(1);
    expect(gridTargetIndex(0, 0, 160, 2, 100, 150, 5)).toBe(2);
    expect(gridTargetIndex(0, 110, 160, 2, 100, 150, 5)).toBe(3);
    expect(gridTargetIndex(3, -110, -160, 2, 100, 150, 5)).toBe(0);
  });

  it("stays inside the grid, including the short last row", () => {
    expect(gridTargetIndex(0, 999, 999, 2, 100, 150, 5)).toBe(4);
    expect(gridTargetIndex(4, 999, 0, 2, 100, 150, 5)).toBe(4);
    expect(gridTargetIndex(2, -999, -999, 2, 100, 150, 5)).toBe(0);
    expect(gridTargetIndex(1, 20, 20, 2, 100, 150, 5)).toBe(1);
  });

  it("is safe for invalid input", () => {
    expect(gridTargetIndex(0, 10, 10, 2, 100, 150, 0)).toBe(0);
    expect(gridTargetIndex(1, Number.NaN, 0, 2, 100, 150, 5)).toBe(1);
    expect(gridTargetIndex(1, 10, 10, 2, 0, 150, 5)).toBe(1);
    expect(gridTargetIndex(1, 10, 10, 0, 100, 150, 5)).toBe(0);
  });
});

describe("selected page operations", () => {
  const pages: PdfPageEdit[] = [1, 2, 3, 4].map((sourcePage) => ({ sourcePage, rotation: 0 }));

  it("rotates, deletes and extracts only the selected pages", () => {
    expect(rotateSelectedPages(pages, [2, 4]).map((page) => page.rotation)).toEqual([0, 90, 0, 90]);
    expect(deleteSelectedPages(pages, [1, 3]).map((page) => page.sourcePage)).toEqual([2, 4]);
    expect(keepSelectedPages(pages, [3, 1]).map((page) => page.sourcePage)).toEqual([1, 3]);
    expect(keepSelectedPages(pages, [])).toHaveLength(4);
    expect(pages.every((page) => page.rotation === 0)).toBe(true);
  });
});

describe("edge auto-scroll", () => {
  it("scrolls toward the edge the finger is near, faster the closer it gets", () => {
    expect(edgeScrollSpeed(300, 0, 600)).toBe(0);
    expect(edgeScrollSpeed(595, 0, 600)).toBeGreaterThan(edgeScrollSpeed(530, 0, 600));
    expect(edgeScrollSpeed(530, 0, 600)).toBeGreaterThan(0);
    expect(edgeScrollSpeed(5, 0, 600)).toBeLessThan(0);
    expect(edgeScrollSpeed(-50, 0, 600)).toBeCloseTo(-18, 6);
    expect(edgeScrollSpeed(700, 0, 600)).toBeCloseTo(18, 6);
  });

  it("respects the window's position and ignores invalid or tiny windows", () => {
    expect(edgeScrollSpeed(160, 100, 600)).toBeLessThan(0);
    expect(edgeScrollSpeed(400, 100, 600)).toBe(0);
    expect(edgeScrollSpeed(Number.NaN, 0, 600)).toBe(0);
    expect(edgeScrollSpeed(10, 0, 0)).toBe(0);
    expect(edgeScrollSpeed(10, 0, 100)).toBe(0);
  });
});
