import { describe, expect, it } from "vitest";
import {
  WELCOME_STROKES,
  WELCOME_VIEWBOX,
  buildPenTrack,
  buildTimeline,
  samplePoints,
  strokeLength,
  strokePath,
} from "../shared/welcome-calligraphy";

describe("welcome calligraphy", () => {
  it("has well-formed strokes inside the view box", () => {
    expect(WELCOME_STROKES.length).toBeGreaterThan(10);
    const { x, y, width, height } = WELCOME_VIEWBOX;
    for (const stroke of WELCOME_STROKES) {
      const points = stroke.segments ? stroke.segments.flatMap((c) => [[c[0], c[1]], [c[6], c[7]]]) : [[stroke.dot![0], stroke.dot![1]]];
      for (const [px, py] of points) {
        expect(px).toBeGreaterThan(x);
        expect(px).toBeLessThan(x + width);
        expect(py).toBeGreaterThan(y);
        expect(py).toBeLessThan(y + height);
      }
      for (const c of stroke.segments ?? []) expect(c).toHaveLength(8);
    }
  });

  it("builds SVG paths and measures their length", () => {
    expect(strokePath([[0, 0, 0, 10, 0, 20, 0, 30], [0, 30, 10, 30, 20, 30, 30, 30]])).toBe("M0 0 C0 10 0 20 0 30 C10 30 20 30 30 30");
    expect(strokeLength([[0, 0, 0, 10, 0, 20, 0, 30]])).toBeCloseTo(30, 1);
    expect(samplePoints([[0, 0, 0, 10, 0, 20, 0, 30]], 4)).toHaveLength(5);
  });

  it("orders the writing on a 0..1 timeline", () => {
    const timeline = buildTimeline();
    expect(timeline).toHaveLength(WELCOME_STROKES.length);
    expect(timeline[0].start).toBe(0);
    expect(timeline[timeline.length - 1].end).toBeCloseTo(1, 6);
    timeline.forEach((item, i) => {
      expect(item.end).toBeGreaterThan(item.start);
      if (i) expect(item.start).toBeGreaterThan(timeline[i - 1].end);
    });
  });

  it("gives a strictly increasing pen track", () => {
    const track = buildPenTrack(buildTimeline());
    expect(track.times.length).toBe(track.xs.length);
    for (let i = 1; i < track.times.length; i += 1) expect(track.times[i]).toBeGreaterThan(track.times[i - 1]);
  });
});
