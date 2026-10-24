/** Normalized rectangle on the displayed page: top-left origin, values 0..1. */
export type CropRect = { x: number; y: number; w: number; h: number };

export type CropHandle = "tl" | "tr" | "bl" | "br" | "t" | "b" | "l" | "r";

export type PdfBox = { x: number; y: number; width: number; height: number };

export type PageRange = { from: number; to: number };

export const MIN_CROP_SIZE = 0.05;
export const FULL_CROP_RECT: CropRect = { x: 0, y: 0, w: 1, h: 1 };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);

export function clampRect(rect: CropRect, minSize = MIN_CROP_SIZE): CropRect {
  const w = clamp(rect.w, minSize, 1);
  const h = clamp(rect.h, minSize, 1);
  return {
    x: clamp(rect.x, 0, 1 - w),
    y: clamp(rect.y, 0, 1 - h),
    w,
    h,
  };
}

/** Moves the whole rectangle, keeping it inside the page. */
export function moveRect(rect: CropRect, dx: number, dy: number): CropRect {
  return clampRect({ ...rect, x: rect.x + dx, y: rect.y + dy });
}

/** Resizes by dragging one handle; the opposite edge stays fixed. */
export function resizeRect(
  rect: CropRect,
  handle: CropHandle,
  dx: number,
  dy: number,
  minSize = MIN_CROP_SIZE,
): CropRect {
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.w;
  let bottom = rect.y + rect.h;
  if (handle.includes("l")) left = clamp(left + dx, 0, right - minSize);
  if (handle.includes("r")) right = clamp(right + dx, left + minSize, 1);
  if (handle === "t" || handle === "tl" || handle === "tr") top = clamp(top + dy, 0, bottom - minSize);
  if (handle === "b" || handle === "bl" || handle === "br") bottom = clamp(bottom + dy, top + minSize, 1);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Rectangle spanning two points (used when drawing a new selection). */
export function rectFromPoints(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  minSize = MIN_CROP_SIZE,
): CropRect {
  const left = clamp(Math.min(ax, bx), 0, 1);
  const right = clamp(Math.max(ax, bx), 0, 1);
  const top = clamp(Math.min(ay, by), 0, 1);
  const bottom = clamp(Math.max(ay, by), 0, 1);
  return clampRect({ x: left, y: top, w: right - left, h: bottom - top }, minSize);
}

export function isFullRect(rect: CropRect): boolean {
  return rect.x <= 0.001 && rect.y <= 0.001 && rect.w >= 0.999 && rect.h >= 0.999;
}

export function isValidCropRect(rect: CropRect | null | undefined): rect is CropRect {
  return (
    !!rect &&
    [rect.x, rect.y, rect.w, rect.h].every(Number.isFinite) &&
    rect.w >= MIN_CROP_SIZE &&
    rect.h >= MIN_CROP_SIZE &&
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.w <= 1.0001 &&
    rect.y + rect.h <= 1.0001
  );
}

/**
 * Converts a rectangle drawn on the displayed (possibly rotated) page into a PDF
 * box in the page's own, unrotated coordinates (origin bottom-left).
 * `base` is the page's current visible box (its CropBox / MediaBox).
 */
export function displayRectToPdfBox(
  rect: CropRect,
  base: PdfBox,
  rotation: number,
): PdfBox {
  const angle = (((Math.round(rotation / 90) * 90) % 360) + 360) % 360;
  // Unrotated top-left normalized coordinates (a right, b down) of a displayed point.
  const toUnrotated = (u: number, v: number): [number, number] => {
    switch (angle) {
      case 90:
        return [v, 1 - u];
      case 180:
        return [1 - u, 1 - v];
      case 270:
        return [1 - v, u];
      default:
        return [u, v];
    }
  };
  const [a1, b1] = toUnrotated(rect.x, rect.y);
  const [a2, b2] = toUnrotated(rect.x + rect.w, rect.y + rect.h);
  const left = Math.min(a1, a2);
  const right = Math.max(a1, a2);
  const top = Math.min(b1, b2);
  const bottom = Math.max(b1, b2);
  return {
    x: base.x + left * base.width,
    y: base.y + (1 - bottom) * base.height,
    width: (right - left) * base.width,
    height: (bottom - top) * base.height,
  };
}

/** Aspect ratio (width / height) of a page as displayed, after rotation. */
export function displayedAspect(width: number, height: number, rotation: number): number {
  if (!(width > 0) || !(height > 0)) return 0.7071;
  const swapped = Math.abs(Math.round(rotation / 90)) % 2 === 1;
  return swapped ? height / width : width / height;
}

/**
 * Parses page ranges like "1-3, 5, 7-9" (Arabic commas and digits allowed).
 * Each range becomes one output file. Returns null for any invalid input.
 */
export function parsePageRanges(input: string, pageCount: number): PageRange[] | null {
  const normalized = input
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[–—ـ]/g, "-");
  const parts = normalized
    .split(/[،,;\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length || !(pageCount > 0)) return null;
  const ranges: PageRange[] = [];
  for (const part of parts) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!match) return null;
    const from = Number(match[1]);
    const to = match[2] === undefined ? from : Number(match[2]);
    if (from < 1 || to < from || to > pageCount) return null;
    ranges.push({ from, to });
  }
  return ranges;
}

/** "1, 2, 3 ..." — one single-page file per page. */
export function eachPageRanges(pageCount: number): string {
  return Array.from({ length: Math.max(0, pageCount) }, (_, i) => String(i + 1)).join(", ");
}

export function rangePageIndexes(range: PageRange): number[] {
  return Array.from({ length: range.to - range.from + 1 }, (_, i) => range.from - 1 + i);
}
