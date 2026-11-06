import { describe, expect, it } from "vitest";
import { GREETING_LINES, GREETING_VIEW } from "../shared/welcome-greeting-data";
import { easeInOut, lineProgress, revealEdge, revealPolygon } from "../shared/welcome-writing";

describe("welcome greeting data", () => {
  it("has the two lines laid out inside the view box", () => {
    expect(GREETING_LINES).toHaveLength(2);
    for (const line of GREETING_LINES) {
      expect(line.glyphs.length).toBeGreaterThan(2);
      expect(line.left).toBeGreaterThanOrEqual(0);
      expect(line.right).toBeLessThanOrEqual(GREETING_VIEW.width);
      expect(line.top).toBeGreaterThanOrEqual(0);
      expect(line.bottom).toBeLessThanOrEqual(GREETING_VIEW.height);
      for (const glyph of line.glyphs) expect(glyph.d.startsWith("M")).toBe(true);
    }
    expect(GREETING_LINES[1].top).toBeGreaterThan(GREETING_LINES[0].bottom);
  });
});

describe("welcome writing", () => {
  it("writes the first line, then the second", () => {
    expect(lineProgress(0)).toEqual([0, 0]);
    expect(lineProgress(1)).toEqual([1, 1]);
    const middle = lineProgress(0.5);
    expect(middle[0]).toBe(1);
    expect(middle[1]).toBeLessThan(0.7);
    for (let p = 0.1; p <= 1; p += 0.1) {
      const now = lineProgress(p);
      const before = lineProgress(p - 0.1);
      expect(now[0]).toBeGreaterThanOrEqual(before[0]);
      expect(now[1]).toBeGreaterThanOrEqual(before[1]);
    }
  });

  it("moves the writing front from right to left", () => {
    const line = GREETING_LINES[0];
    expect(revealEdge(line, 0)).toBeGreaterThan(line.right);
    expect(revealEdge(line, 1)).toBeLessThan(line.left);
    expect(revealEdge(line, 0.5)).toBeLessThan(revealEdge(line, 0.2));
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBeCloseTo(1, 9);
  });

  it("builds a four-point clip polygon", () => {
    expect(revealPolygon(GREETING_LINES[1], 0.4).split(" ")).toHaveLength(4);
  });
});
