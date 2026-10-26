const ORIENTATION: Record<number, number> = { 0: 1, 90: 6, 180: 3, 270: 8 };

/**
 * Returns the JPEG with an EXIF orientation tag that shows it turned
 * `rotation` degrees clockwise. Pixels are untouched; any old EXIF block is replaced.
 */
export function withJpegRotation(bytes: Uint8Array, rotation: number): Uint8Array {
  const turns = (((Math.round(rotation / 90) % 4) + 4) % 4) * 90;
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const orientation = ORIENTATION[turns];
  // Drop an existing EXIF (APP1) segment.
  let pos = 2;
  const kept: Uint8Array[] = [];
  while (pos + 4 <= bytes.length && bytes[pos] === 0xff) {
    const marker = bytes[pos + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = (bytes[pos + 2] << 8) | bytes[pos + 3];
    const isExif =
      marker === 0xe1 && bytes[pos + 4] === 0x45 && bytes[pos + 5] === 0x78 && bytes[pos + 6] === 0x69 && bytes[pos + 7] === 0x66;
    if (!isExif) kept.push(bytes.slice(pos, pos + 2 + length));
    pos += 2 + length;
  }
  const rest = bytes.slice(pos);
  if (turns === 0) {
    const out = [Uint8Array.from([0xff, 0xd8]), ...kept, rest];
    return concat(out);
  }
  const tiff = [
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // big-endian TIFF header, IFD at 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00, // Orientation, SHORT, 1
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ];
  const body = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
  const length = body.length + 2;
  const exif = Uint8Array.from([0xff, 0xe1, (length >> 8) & 255, length & 255, ...body]);
  return concat([Uint8Array.from([0xff, 0xd8]), exif, ...kept, rest]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
