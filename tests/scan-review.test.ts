import { describe, expect, it } from "vitest";
import { decodeJpegDc, type GrayImage } from "../shared/jpeg-dc";
import { withJpegRotation } from "../shared/jpeg-orientation";
import { estimateSkew, isBlankPage } from "../shared/scan-analysis";
import { pagesForOutput, scanPageGeometry, type ScanPage } from "../shared/scan-pages";

// 40x24 px, white with a black 16x16 square at x 8..23 (4:2:0, quality 90).
const FIXTURE =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAYACgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9U6/lXr+qiv5V6ACv6qK/lXr+qigAooooAKKKKACiiigAooooA//Z";
const bytes = () => Uint8Array.from(Buffer.from(FIXTURE, "base64"));

describe("DC-only JPEG reader", () => {
  it("returns a 1/8 scale grayscale picture", () => {
    const image = decodeJpegDc(bytes())!;
    expect([image.width, image.height]).toEqual([5, 3]);
    const expected = [255, 0, 0, 255, 255, 255, 0, 0, 255, 255, 255, 255, 255, 255, 255];
    Array.from(image.data).forEach((value, index) => expect(Math.abs(value - expected[index])).toBeLessThanOrEqual(3));
  });
  it("returns null for data that is not a baseline JPEG", () => {
    expect(decodeJpegDc(Uint8Array.from([1, 2, 3, 4, 5]))).toBeNull();
    expect(decodeJpegDc(bytes().slice(0, 300))).toBeNull();
  });
});

const page = (width: number, height: number, draw: (x: number, y: number) => boolean): GrayImage => {
  const data = new Uint8Array(width * height).fill(255);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) if (draw(x, y)) data[y * width + x] = 40;
  return { width, height, data };
};
const lines = (angle: number) => (x: number, y: number) => {
  const rad = (angle * Math.PI) / 180;
  const row = (y - 70) * Math.cos(rad) + (x - 50) * Math.sin(rad);
  return Math.abs(((row % 9) + 9) % 9 - 4) < 1.3 && x > 12 && x < 88 && y > 12 && y < 128;
};

describe("scan page analysis", () => {
  it("finds blank pages", () => {
    expect(isBlankPage(page(100, 140, () => false))).toBe(true);
    expect(isBlankPage(page(100, 140, lines(0)))).toBe(false);
  });
  it("measures the tilt of text lines", () => {
    expect(estimateSkew(page(100, 140, lines(0)))).toBe(0);
    expect(estimateSkew(page(100, 140, lines(3)))).toBeGreaterThan(2);
    expect(estimateSkew(page(100, 140, lines(-3)))).toBeLessThan(-2);
    expect(estimateSkew(page(100, 140, () => false))).toBe(0);
  });
});

describe("scan output", () => {
  const pages: ScanPage[] = [
    { id: "a", uri: "a", rotation: 0, blank: false, skew: 0 },
    { id: "b", uri: "b", rotation: 90, blank: true, skew: 2 },
  ];
  it("drops blank pages only when allowed", () => {
    expect(pagesForOutput(pages, false)).toHaveLength(2);
    expect(pagesForOutput(pages, true).map((p) => p.id)).toEqual(["a"]);
  });
  it("places the image on a rotated PDF page", () => {
    expect(scanPageGeometry(600, 800, 0, 0)).toMatchObject({ pageWidth: 600, pageHeight: 800, x: 0, y: 0 });
    expect(scanPageGeometry(600, 800, 90, 0)).toMatchObject({ pageWidth: 800, pageHeight: 600, angle: -90, x: 0, y: 600 });
    expect(scanPageGeometry(600, 800, 0, 2).angle).toBe(-2);
  });
  it("writes an EXIF orientation into a JPEG", () => {
    const rotated = withJpegRotation(bytes(), 90);
    expect(Array.from(rotated.slice(0, 4))).toEqual([0xff, 0xd8, 0xff, 0xe1]);
    expect(new TextDecoder().decode(rotated.slice(6, 10))).toBe("Exif");
    expect(withJpegRotation(withJpegRotation(bytes(), 90), 0).length).toBeLessThan(rotated.length);
    expect(decodeJpegDc(rotated)).not.toBeNull();
  });
});
