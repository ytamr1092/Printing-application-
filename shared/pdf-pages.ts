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
