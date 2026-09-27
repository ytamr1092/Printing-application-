export function hasAtLeastFiles(count: number, minimum = 1): boolean {
  return Number.isInteger(count) && count >= minimum;
}

export function canMergePdfs(count: number): boolean {
  return hasAtLeastFiles(count, 2);
}
