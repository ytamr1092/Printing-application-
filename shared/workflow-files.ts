export type RotatableWorkflowFile = {
  rotation?: number;
};

export function moveWorkflowItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length ||
    from === to
  ) {
    return [...items];
  }

  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function rotateWorkflowFile<T extends RotatableWorkflowFile>(file: T): T {
  const current = Number.isFinite(file.rotation) ? Number(file.rotation) : 0;
  const normalized = ((Math.round(current / 90) * 90) % 360 + 360) % 360;
  return { ...file, rotation: (normalized + 90) % 360 };
}

export function normalizeRotation(rotation?: number): 0 | 90 | 180 | 270 {
  const current = Number.isFinite(rotation) ? Number(rotation) : 0;
  return (((Math.round(current / 90) * 90) % 360 + 360) % 360) as
    | 0
    | 90
    | 180
    | 270;
}

/**
 * Index a dragged row should occupy, given where the drag started, how far the
 * finger moved vertically and the height of one row. Always within the list.
 */
export function dragTargetIndex(
  startIndex: number,
  deltaY: number,
  rowHeight: number,
  total: number,
): number {
  if (total <= 0) return 0;
  const clampedStart = Math.min(Math.max(Math.trunc(startIndex) || 0, 0), total - 1);
  if (!Number.isFinite(deltaY) || !Number.isFinite(rowHeight) || rowHeight <= 0) {
    return clampedStart;
  }
  const target = clampedStart + Math.round(deltaY / rowHeight);
  return Math.min(Math.max(target, 0), total - 1);
}

/** One step from `current` toward `target` (rows swap one slot at a time). */
export function stepToward(current: number, target: number): number {
  if (target > current) return current + 1;
  if (target < current) return current - 1;
  return current;
}

export function toggleSelected(selected: readonly string[], key: string): string[] {
  return selected.includes(key)
    ? selected.filter((item) => item !== key)
    : [...selected, key];
}

/** Drops selected keys that no longer exist (e.g. after removing a file). */
export function pruneSelection(
  selected: readonly string[],
  validKeys: readonly string[],
): string[] {
  const valid = new Set(validKeys);
  return selected.filter((key) => valid.has(key));
}

/** Rotates only the files whose uri is selected; order and others untouched. */
export function rotateSelectedFiles<T extends RotatableWorkflowFile & { uri: string }>(
  files: readonly T[],
  selectedUris: readonly string[],
): T[] {
  const selected = new Set(selectedUris);
  return files.map((file) => (selected.has(file.uri) ? rotateWorkflowFile(file) : file));
}

export const PREVIEW_ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3] as const;

/** Next zoom level in the given direction; stays within the available steps. */
export function stepPreviewZoom(current: number, direction: -1 | 1): number {
  const steps = PREVIEW_ZOOM_STEPS;
  let nearest = 0;
  for (let i = 1; i < steps.length; i += 1) {
    if (Math.abs(steps[i] - current) < Math.abs(steps[nearest] - current)) nearest = i;
  }
  return steps[Math.min(Math.max(nearest + direction, 0), steps.length - 1)];
}

/**
 * Slot a dragged grid cell should occupy after the finger moved (dx, dy) from
 * where the drag started. `cols` cells per row, each `cellWidth` x `cellHeight`.
 */
export function gridTargetIndex(
  startIndex: number,
  dx: number,
  dy: number,
  cols: number,
  cellWidth: number,
  cellHeight: number,
  total: number,
): number {
  if (total <= 0 || !(cols >= 1)) return 0;
  const start = Math.min(Math.max(Math.trunc(startIndex) || 0, 0), total - 1);
  if (
    !Number.isFinite(dx) ||
    !Number.isFinite(dy) ||
    !(cellWidth > 0) ||
    !(cellHeight > 0)
  ) {
    return start;
  }
  const columns = Math.trunc(cols);
  const rows = Math.ceil(total / columns);
  const col = Math.min(
    Math.max(Math.round((start % columns) + dx / cellWidth), 0),
    columns - 1,
  );
  const row = Math.min(
    Math.max(Math.round(Math.floor(start / columns) + dy / cellHeight), 0),
    rows - 1,
  );
  return Math.min(row * columns + col, total - 1);
}

/**
 * Scroll speed (px per tick, negative = up) while dragging near the edge of a
 * scrollable window. `pointer` and `top` share the same coordinate space.
 */
export function edgeScrollSpeed(
  pointer: number,
  top: number,
  height: number,
  edge = 90,
  maxSpeed = 18,
): number {
  if (
    !Number.isFinite(pointer) ||
    !Number.isFinite(top) ||
    !(height > 0) ||
    !(edge > 0) ||
    height < edge * 2
  ) {
    return 0;
  }
  const fromTop = pointer - top;
  const fromBottom = top + height - pointer;
  if (fromTop < edge) {
    return -Math.min(1, (edge - fromTop) / edge) * maxSpeed;
  }
  if (fromBottom < edge) {
    return Math.min(1, (edge - fromBottom) / edge) * maxSpeed;
  }
  return 0;
}

/**
 * Scroll speed (px per frame, negative = up) while dragging near the top or
 * bottom edge of a scrolling viewport. Zero when the finger is away from edges.
 */
export function autoScrollSpeed(
  fingerY: number,
  viewportTop: number,
  viewportHeight: number,
  zone = 90,
  maxSpeed = 18,
): number {
  if (
    !Number.isFinite(fingerY) ||
    !Number.isFinite(viewportTop) ||
    !(viewportHeight > 0) ||
    !(zone > 0)
  ) {
    return 0;
  }
  const effectiveZone = Math.min(zone, viewportHeight / 2);
  const topEdge = viewportTop + effectiveZone;
  const bottomEdge = viewportTop + viewportHeight - effectiveZone;
  if (fingerY < topEdge) {
    return -Math.min(1, (topEdge - fingerY) / effectiveZone) * maxSpeed;
  }
  if (fingerY > bottomEdge) {
    return Math.min(1, (fingerY - bottomEdge) / effectiveZone) * maxSpeed;
  }
  return 0;
}
