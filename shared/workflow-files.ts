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
