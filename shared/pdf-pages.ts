export type PageRotation = 0 | 90 | 180 | 270;

export type PdfPageEdit = {
  sourcePage: number;
  rotation: PageRotation;
};

export function parsePageOrder(input: string, pageCount: number): number[] {
  const values = input
    .split(/[،,\s]+/)
    .map((value) => Number(value.trim()))
    .filter(
      (value) => Number.isInteger(value) && value >= 1 && value <= pageCount,
    );
  return Array.from(new Set(values));
}

export function canApplyPageOrder(order: number[], pageCount: number): boolean {
  return (
    pageCount > 0 &&
    order.length > 0 &&
    order.every((page) => page >= 1 && page <= pageCount)
  );
}

export function createPageEdits(pageCount: number): PdfPageEdit[] {
  return Array.from({ length: Math.max(0, pageCount) }, (_, index) => ({
    sourcePage: index + 1,
    rotation: 0 as PageRotation,
  }));
}

export function movePage<T>(items: T[], from: number, to: number): T[] {
  if (
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length ||
    from === to
  ) {
    return items.slice();
  }
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function rotatePage(rotation: PageRotation): PageRotation {
  return ((rotation + 90) % 360) as PageRotation;
}

export function pageOrientation(
  rotation: PageRotation,
): "portrait" | "landscape" {
  return rotation === 90 || rotation === 270 ? "landscape" : "portrait";
}

export function togglePageOrientation(rotation: PageRotation): PageRotation {
  return rotation === 0 || rotation === 180 ? 90 : 0;
}
