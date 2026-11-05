/**
 * "أهلا د.يوسف" as pen strokes for the animated welcome screen. Every stroke is
 * a chain of cubic Béziers (x0,y0, x1,y1, x2,y2, x3,y3) drawn with a chisel
 * nib, so the strokes can be revealed one after another like a pen writing.
 * Coordinates live in WELCOME_VIEWBOX and are already tilted for the rising
 * baseline of Diwani-style writing.
 */
export type WelcomeStroke =
  | { name: string; width: number; segments: number[][]; dot?: undefined }
  | { name: string; dot: [number, number, number]; width?: undefined; segments?: undefined };

export const WELCOME_VIEWBOX = { x: 130, y: 50, width: 830, height: 420 };
/** Chisel nib: copies of each stroke offset along this angle form the thick/thin look. */
export const NIB = { length: 14, angleDeg: -38, copies: [-1, -0.5, 0, 0.5, 1] };

export const WELCOME_STROKES: WelcomeStroke[] = [
  { name: "alef", width: 9, segments: [[899.8, 131.7, 913.6, 185.8, 906.6, 256.5, 890.2, 308.8], [890.2, 308.8, 885.1, 322.1, 873.3, 326.0, 862.8, 318.7]] },
  { name: "hamza", width: 6, segments: [[891.6, 114.2, 872.8, 117.5, 865.8, 104.0, 877.1, 93.1], [877.1, 93.1, 886.5, 84.5, 901.0, 91.5, 893.9, 104.0]] },
  { name: "heh", width: 9, segments: [[849.6, 301.6, 849.3, 269.5, 812.6, 260.0, 804.4, 286.7], [804.4, 286.7, 798.1, 311.2, 827.2, 325.2, 839.9, 306.3], [839.9, 306.3, 847.0, 293.7, 834.1, 280.6, 820.7, 289.6]] },
  { name: "heh-link", width: 6, segments: [[812.9, 322.2, 797.2, 327.3, 781.1, 326.4, 768.7, 321.3]] },
  { name: "lam", width: 9, segments: [[768.7, 321.3, 756.2, 314.1, 749.7, 278.5, 742.2, 228.9], [742.2, 228.9, 734.8, 179.3, 730.0, 139.5, 729.9, 109.5]] },
  { name: "lam-base", width: 7, segments: [[758.6, 320.0, 745.6, 334.9, 718.0, 340.8, 694.9, 326.4]] },
  { name: "alef2", width: 9, segments: [[694.9, 326.4, 693.8, 282.4, 690.4, 232.5, 681.5, 163.0]] },
  { name: "dal", width: 9, segments: [[609.1, 274.3, 638.3, 262.2, 654.4, 291.2, 636.8, 326.5], [636.8, 326.5, 620.6, 353.7, 585.1, 362.2, 553.8, 344.3]] },
  { name: "period", dot: [521.8, 344.5, 9] },
  { name: "ya-tooth", width: 9, segments: [[473.7, 374.0, 470.2, 352.2, 465.1, 336.5, 452.5, 329.3]] },
  { name: "ya-link", width: 6, segments: [[473.7, 374.0, 460.4, 384.9, 436.5, 386.6, 419.8, 377.7]] },
  { name: "ya-d1", dot: [438.7, 418.5, 6] },
  { name: "ya-d2", dot: [458.7, 417.1, 6] },
  { name: "waw", width: 9, segments: [[419.8, 377.7, 395.3, 371.4, 379.3, 342.5, 391.8, 321.5], [391.8, 321.5, 406.8, 306.5, 424.7, 333.3, 408.5, 358.5], [408.5, 358.5, 395.9, 379.4, 398.1, 411.3, 375.9, 436.9]] },
  { name: "sin", width: 9, segments: [[339.7, 379.3, 335.8, 351.5, 319.4, 346.7, 315.0, 369.0], [315.0, 369.0, 312.7, 393.2, 294.7, 394.5, 287.0, 371.0], [287.0, 371.0, 281.2, 345.3, 265.3, 346.4, 261.1, 372.8], [261.1, 372.8, 258.9, 399.0, 241.2, 404.3, 227.7, 411.2]] },
  { name: "fa", width: 9, segments: [[227.7, 411.2, 212.0, 416.3, 194.9, 401.5, 199.4, 379.1], [199.4, 379.1, 203.8, 356.7, 231.8, 354.8, 235.3, 376.6], [235.3, 376.6, 239.0, 400.4, 220.7, 425.7, 179.2, 434.7]] },
  { name: "fa-dot", dot: [214.3, 334.0, 8] },
];

export function strokePath(segments: number[][]): string {
  const [first] = segments;
  return (
    `M${first[0]} ${first[1]}` +
    segments.map((c) => ` C${c[2]} ${c[3]} ${c[4]} ${c[5]} ${c[6]} ${c[7]}`).join("")
  );
}

function cubicPoint(c: number[], t: number): [number, number] {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const d = 3 * u * t * t;
  const e = t * t * t;
  return [a * c[0] + b * c[2] + d * c[4] + e * c[6], a * c[1] + b * c[3] + d * c[5] + e * c[7]];
}

/** Points along a stroke (evenly spaced in parameter), `perSegment` per Bézier. */
export function samplePoints(segments: number[][], perSegment = 16): [number, number][] {
  const points: [number, number][] = [];
  segments.forEach((segment, index) => {
    for (let i = index === 0 ? 0 : 1; i <= perSegment; i += 1) points.push(cubicPoint(segment, i / perSegment));
  });
  return points;
}

export function strokeLength(segments: number[][]): number {
  const points = samplePoints(segments, 24);
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return total;
}

export type StrokeTiming = { stroke: WelcomeStroke; length: number; start: number; end: number };

/**
 * Lays the strokes out on a 0..1 timeline in writing order: time spent on a
 * stroke follows its length; a short pause (pen lift) separates strokes and a
 * dot takes a fixed beat.
 */
export function buildTimeline(strokes: WelcomeStroke[] = WELCOME_STROKES): StrokeTiming[] {
  const DOT_BEAT = 14; // in "length units"
  const LIFT = 10;
  const raw = strokes.map((stroke) => ({ stroke, length: stroke.segments ? strokeLength(stroke.segments) : 0 }));
  const cost = (item: { stroke: WelcomeStroke; length: number }) => (item.stroke.segments ? item.length : DOT_BEAT);
  const total = raw.reduce((sum, item, index) => sum + cost(item) + (index ? LIFT : 0), 0);
  let cursor = 0;
  return raw.map((item, index) => {
    if (index) cursor += LIFT;
    const start = cursor / total;
    cursor += cost(item);
    return { ...item, start, end: cursor / total };
  });
}

/** Pen-tip track for the whole writing time: strictly increasing times with x/y. */
export function buildPenTrack(timeline: StrokeTiming[]): { times: number[]; xs: number[]; ys: number[] } {
  const times: number[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  const push = (time: number, x: number, y: number) => {
    const last = times[times.length - 1];
    times.push(last !== undefined && time <= last ? last + 1e-6 : time);
    xs.push(x);
    ys.push(y);
  };
  for (const { stroke, start, end } of timeline) {
    if (stroke.segments) {
      const points = samplePoints(stroke.segments, 6);
      points.forEach(([x, y], i) => push(start + ((end - start) * i) / (points.length - 1), x, y));
    } else {
      push(start, stroke.dot[0], stroke.dot[1]);
      push(end, stroke.dot[0], stroke.dot[1]);
    }
  }
  return { times, xs, ys };
}
