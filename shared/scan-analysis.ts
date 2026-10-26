import type { GrayImage } from "./jpeg-dc";

const MARGIN = 0.05;
/** A pixel counts as ink when it is this much darker than the paper. */
const INK_DELTA = 25;
/** Fewer ink pixels than this share of the page means it is blank. */
const BLANK_INK_SHARE = 0.0015;

function percentile(values: number[], share: number): number {
  const sorted = Float64Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))];
}

function inkPixels(image: GrayImage): { points: [number, number][]; area: number } {
  const x0 = Math.floor(image.width * MARGIN);
  const x1 = Math.ceil(image.width * (1 - MARGIN));
  const y0 = Math.floor(image.height * MARGIN);
  const y1 = Math.ceil(image.height * (1 - MARGIN));
  const samples: number[] = [];
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) samples.push(image.data[y * image.width + x]);
  if (!samples.length) return { points: [], area: 0 };
  const paper = percentile(samples, 0.9);
  const points: [number, number][] = [];
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      if (image.data[y * image.width + x] < paper - INK_DELTA) points.push([x - image.width / 2, y - image.height / 2]);
    }
  }
  return { points, area: samples.length };
}

/** True when a scanned page has (almost) nothing printed on it. */
export function isBlankPage(image: GrayImage): boolean {
  const { points, area } = inkPixels(image);
  return area > 0 && points.length / area < BLANK_INK_SHARE;
}

/**
 * Estimated counter-clockwise tilt of the text lines in degrees (0 when the
 * page is straight or there is too little text to tell). Positive means the
 * text rises to the right.
 */
export function estimateSkew(image: GrayImage, maxAngle = 6, step = 0.25): number {
  const { points } = inkPixels(image);
  if (points.length < 150) return 0;
  const offset = Math.ceil(Math.hypot(image.width, image.height) / 2) + 2;
  const rows = new Float64Array(offset * 2 + 1);
  const score = (angle: number) => {
    rows.fill(0);
    const rad = (angle * Math.PI) / 180;
    const sin = Math.sin(rad);
    const cos = Math.cos(rad);
    for (const [x, y] of points) rows[Math.round(y * cos + x * sin) + offset] += 1;
    let total = 0;
    for (let i = 0; i < rows.length; i += 1) total += rows[i] * rows[i];
    return total;
  };
  const straight = score(0);
  let best = 0;
  let bestScore = straight;
  for (let angle = -maxAngle; angle <= maxAngle + 1e-9; angle += step) {
    const value = score(angle);
    if (value > bestScore) {
      bestScore = value;
      best = angle;
    }
  }
  if (Math.abs(best) < 0.5 || bestScore < straight * 1.03) return 0;
  return Math.round(best * 100) / 100;
}
