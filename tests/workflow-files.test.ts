import { describe, expect, it } from "vitest";
import {
  dragTargetIndex,
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
