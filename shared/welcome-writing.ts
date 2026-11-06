import { GREETING_LINES, GREETING_VIEW, type GreetingLine } from "./welcome-greeting-data";

/** Slant of the writing front (view-box x shift per unit of height). */
export const WRITING_SLANT = 0.22;
const PAUSE = 0.07; // share of the timeline between two lines
const MARGIN = 160;

export function easeInOut(u: number): number {
  const c = Math.min(1, Math.max(0, u));
  return 0.5 - Math.cos(Math.PI * c) / 2;
}

/** 0..1 progress of each line for the overall 0..1 progress: lines are written one after another. */
export function lineProgress(progress: number, lines: GreetingLine[] = GREETING_LINES): number[] {
  const widths = lines.map((line) => line.right - line.left);
  const total = widths.reduce((a, b) => a + b, 0);
  const span = 1 - PAUSE * (lines.length - 1);
  let cursor = 0;
  return lines.map((_, index) => {
    const share = (widths[index] / total) * span;
    const start = cursor;
    cursor += share + PAUSE;
    return easeInOut((progress - start) / share);
  });
}

/** Where the writing front is (x in view-box units); the text is written right to left. */
export function revealEdge(line: GreetingLine, u: number): number {
  const from = line.right + MARGIN;
  const to = line.left - MARGIN - (line.bottom - line.top) * WRITING_SLANT;
  return from - (from - to) * u;
}

/** Polygon (SVG points) of the part of a line that is already written. */
export function revealPolygon(line: GreetingLine, u: number): string {
  const edge = revealEdge(line, u);
  const top = line.top - 40;
  const bottom = line.bottom + 40;
  const mid = (line.top + line.bottom) / 2;
  const right = line.right + MARGIN * 2;
  const xTop = edge + (top - mid) * WRITING_SLANT * -1;
  const xBottom = edge + (bottom - mid) * WRITING_SLANT * -1;
  return `${Math.round(xTop)},${top} ${right},${top} ${right},${bottom} ${Math.round(xBottom)},${bottom}`;
}

export { GREETING_VIEW };
