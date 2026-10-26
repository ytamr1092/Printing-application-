/**
 * DC-only baseline JPEG reader. It walks the entropy-coded data but skips the
 * AC coefficients and the IDCT, which yields a 1/8-size grayscale picture
 * (one pixel per 8x8 block) cheaply. That is plenty to find blank pages and
 * measure skew on a scanned page. Returns null for anything it cannot read
 * (progressive, arithmetic-coded, 12-bit, malformed...).
 */
export type GrayImage = { width: number; height: number; data: Uint8Array };

type Huffman = { maxcode: Int32Array; valptr: Int32Array; mincode: Int32Array; values: Uint8Array };

function buildHuffman(counts: number[], values: Uint8Array): Huffman {
  const maxcode = new Int32Array(18).fill(-1);
  const valptr = new Int32Array(17);
  const mincode = new Int32Array(17);
  let code = 0;
  let k = 0;
  for (let length = 1; length <= 16; length += 1) {
    valptr[length] = k;
    mincode[length] = code;
    code += counts[length - 1];
    k += counts[length - 1];
    maxcode[length] = counts[length - 1] ? code - 1 : -1;
    code <<= 1;
  }
  return { maxcode, valptr, mincode, values };
}

export function decodeJpegDc(bytes: Uint8Array): GrayImage | null {
  try {
    return decode(bytes);
  } catch {
    return null;
  }
}

function decode(bytes: Uint8Array): GrayImage | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const quant: Record<number, Uint16Array> = {};
  const dcTables: Record<number, Huffman> = {};
  const acTables: Record<number, Huffman> = {};
  let width = 0;
  let height = 0;
  let restartInterval = 0;
  let components: { id: number; h: number; v: number; tq: number }[] = [];
  let pos = 2;

  while (pos + 4 <= bytes.length) {
    if (bytes[pos] !== 0xff) {
      pos += 1;
      continue;
    }
    const marker = bytes[pos + 1];
    if (marker === 0xff) {
      pos += 1;
      continue;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01 || marker === 0x00) {
      pos += 2;
      continue;
    }
    if (marker === 0xd9) return null;
    const length = (bytes[pos + 2] << 8) | bytes[pos + 3];
    const segment = pos + 4;
    const end = pos + 2 + length;
    if (marker === 0xdb) {
      let p = segment;
      while (p < end) {
        const info = bytes[p++];
        const precision = info >> 4;
        const table = new Uint16Array(64);
        for (let i = 0; i < 64; i += 1) {
          table[i] = precision ? (bytes[p] << 8) | bytes[p + 1] : bytes[p];
          p += precision ? 2 : 1;
        }
        quant[info & 15] = table;
      }
    } else if (marker === 0xc4) {
      let p = segment;
      while (p < end) {
        const info = bytes[p++];
        const counts: number[] = [];
        let total = 0;
        for (let i = 0; i < 16; i += 1) {
          counts.push(bytes[p + i]);
          total += bytes[p + i];
        }
        p += 16;
        const huffman = buildHuffman(counts, bytes.slice(p, p + total));
        p += total;
        if (info >> 4) acTables[info & 15] = huffman;
        else dcTables[info & 15] = huffman;
      }
    } else if (marker === 0xdd) {
      restartInterval = (bytes[segment] << 8) | bytes[segment + 1];
    } else if (marker === 0xc0 || marker === 0xc1) {
      if (bytes[segment] !== 8) return null;
      height = (bytes[segment + 1] << 8) | bytes[segment + 2];
      width = (bytes[segment + 3] << 8) | bytes[segment + 4];
      const count = bytes[segment + 5];
      components = [];
      for (let i = 0; i < count; i += 1) {
        const p = segment + 6 + i * 3;
        components.push({ id: bytes[p], h: bytes[p + 1] >> 4, v: bytes[p + 1] & 15, tq: bytes[p + 2] });
      }
    } else if (marker >= 0xc2 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return null; // progressive / lossless / arithmetic
    } else if (marker === 0xda) {
      if (!width || !height || !components.length) return null;
      const scanCount = bytes[segment];
      if (scanCount !== components.length) return null; // multi-scan baseline is not supported
      const tables: { dc: number; ac: number }[] = [];
      for (let i = 0; i < scanCount; i += 1) {
        const id = bytes[segment + 1 + i * 2];
        const t = bytes[segment + 2 + i * 2];
        const index = components.findIndex((component) => component.id === id);
        if (index < 0) return null;
        tables[index] = { dc: t >> 4, ac: t & 15 };
      }
      return decodeScan(bytes, end, width, height, components, tables, quant, dcTables, acTables, restartInterval);
    }
    pos = end;
  }
  return null;
}

function decodeScan(
  bytes: Uint8Array,
  start: number,
  width: number,
  height: number,
  components: { id: number; h: number; v: number; tq: number }[],
  tables: { dc: number; ac: number }[],
  quant: Record<number, Uint16Array>,
  dcTables: Record<number, Huffman>,
  acTables: Record<number, Huffman>,
  restartInterval: number,
): GrayImage | null {
  const hMax = Math.max(...components.map((c) => c.h));
  const vMax = Math.max(...components.map((c) => c.v));
  const mcuWidth = 8 * hMax;
  const mcuHeight = 8 * vMax;
  const mcusX = Math.ceil(width / mcuWidth);
  const mcusY = Math.ceil(height / mcuHeight);
  const luma = components[0];
  const lumaQ = quant[luma.tq]?.[0];
  if (!lumaQ) return null;
  const blocksX = mcusX * luma.h;
  const blocksY = mcusY * luma.v;
  const dc = new Int32Array(blocksX * blocksY);
  const predictors = new Int32Array(components.length);

  let pos = start;
  let bitBuffer = 0;
  let bitCount = 0;
  const readBit = (): number => {
    if (bitCount === 0) {
      if (pos >= bytes.length) throw new Error("eof");
      let byte = bytes[pos++];
      if (byte === 0xff) {
        const next = bytes[pos];
        if (next === 0x00) pos += 1;
        else throw new Error("marker");
      }
      bitBuffer = byte;
      bitCount = 8;
    }
    bitCount -= 1;
    return (bitBuffer >> bitCount) & 1;
  };
  const receive = (n: number): number => {
    let value = 0;
    for (let i = 0; i < n; i += 1) value = (value << 1) | readBit();
    return value;
  };
  const extend = (value: number, n: number) => (n === 0 ? 0 : value < 1 << (n - 1) ? value - (1 << n) + 1 : value);
  const decodeSymbol = (table: Huffman): number => {
    let code = 0;
    for (let length = 1; length <= 16; length += 1) {
      code = (code << 1) | readBit();
      const max = table.maxcode[length];
      if (max >= 0 && code <= max && code >= table.mincode[length]) {
        return table.values[table.valptr[length] + code - table.mincode[length]];
      }
    }
    throw new Error("bad-huffman");
  };

  let decoded = 0;
  for (let my = 0; my < mcusY; my += 1) {
    for (let mx = 0; mx < mcusX; mx += 1) {
      if (restartInterval && decoded > 0 && decoded % restartInterval === 0) {
        bitCount = 0;
        // skip to and past the RSTn marker
        while (pos + 1 < bytes.length && !(bytes[pos] === 0xff && bytes[pos + 1] >= 0xd0 && bytes[pos + 1] <= 0xd7)) pos += 1;
        pos += 2;
        predictors.fill(0);
      }
      for (let ci = 0; ci < components.length; ci += 1) {
        const component = components[ci];
        const table = tables[ci];
        const dcTable = dcTables[table.dc];
        const acTable = acTables[table.ac];
        if (!dcTable || !acTable) return null;
        for (let by = 0; by < component.v; by += 1) {
          for (let bx = 0; bx < component.h; bx += 1) {
            const size = decodeSymbol(dcTable);
            predictors[ci] += extend(receive(size), size);
            if (ci === 0) dc[(my * luma.v + by) * blocksX + mx * luma.h + bx] = predictors[ci];
            for (let k = 1; k < 64; ) {
              const symbol = decodeSymbol(acTable);
              const run = symbol >> 4;
              const bits = symbol & 15;
              if (bits === 0) {
                if (run === 15) k += 16;
                else break;
              } else {
                k += run + 1;
                receive(bits);
              }
            }
          }
        }
      }
      decoded += 1;
    }
  }

  const outWidth = Math.ceil(width / 8);
  const outHeight = Math.ceil(height / 8);
  const data = new Uint8Array(outWidth * outHeight);
  for (let y = 0; y < outHeight; y += 1) {
    for (let x = 0; x < outWidth; x += 1) {
      const value = (dc[y * blocksX + x] * lumaQ) / 8 + 128;
      data[y * outWidth + x] = value < 0 ? 0 : value > 255 ? 255 : Math.round(value);
    }
  }
  return { width: outWidth, height: outHeight, data };
}
