export function hasAtLeastFiles(count: number, minimum = 1): boolean {
  return Number.isInteger(count) && count >= minimum;
}

export function canMergePdfs(count: number): boolean {
  return hasAtLeastFiles(count, 2);
}

export function findJpegByteRanges(
  bytes: Uint8Array,
): Array<{ start: number; end: number }> {
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

export function findPngByteRanges(
  bytes: Uint8Array,
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const ending = [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
  for (let index = 0; index <= bytes.length - signature.length; index += 1) {
    if (!signature.every((value, offset) => bytes[index + offset] === value))
      continue;
    for (
      let end = index + signature.length;
      end <= bytes.length - ending.length;
      end += 1
    ) {
      if (!ending.every((value, offset) => bytes[end + offset] === value))
        continue;
      ranges.push({ start: index, end: end + ending.length });
      index = end + ending.length - 1;
      break;
    }
  }
  return ranges;
}
