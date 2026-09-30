export function hasAtLeastFiles(count: number, minimum = 1): boolean {
  return Number.isInteger(count) && count >= minimum;
}

export function canMergePdfs(count: number): boolean {
  return hasAtLeastFiles(count, 2);
}

export function findJpegByteRanges(bytes: Uint8Array): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (let index = 0; index < bytes.length - 1; index += 1) {
    if (bytes[index] !== 0xff || bytes[index + 1] !== 0xd8) continue;
    for (let end = index + 2; end < bytes.length - 1; end += 1) {
      if (bytes[end] === 0xff && bytes[end + 1] === 0xd9) {
        ranges.push({ start: index, end: end + 2 });
        index = end + 1;
        break;
      }
    }
  }
  return ranges;
}
