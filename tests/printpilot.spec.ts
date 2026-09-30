import { describe, expect, it } from "vitest";

import { paperOptions, paperPresetById, supportedPaperWeights } from "../shared/print-options";
import { canMergePdfs, findJpegByteRanges, hasAtLeastFiles } from "../shared/file-operations";
import { themeColors } from "../theme.config";

describe("PrintPilot paper presets", () => {
  it("includes certificate stock with A4 dimensions", () => {
    const certificate = paperPresetById("certificate");
    expect(certificate.size).toBe("210 × 297 mm");
    expect(certificate.weight).toBe("200 g/m²");
  });

  it("keeps paper presets selectable and uniquely identified", () => {
    const ids = paperOptions.map((paper) => paper.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("a4");
    expect(ids).toContain("certificate");
    expect(supportedPaperWeights).toEqual(["70 g/m²", "80 g/m²", "120 g/m²", "200 g/m²"]);
  });
});

describe("PrintPilot theme", () => {
  it("provides readable light and dark palettes", () => {
    expect(themeColors.primary.light).toBe("#0A7EA4");
    expect(themeColors.primary.dark).toBe("#42C4D9");
    expect(themeColors.background.dark).toBe("#0C1725");
    expect(themeColors.foreground.dark).toBe("#F3F8FC");
    expect(themeColors.foreground.light).toBe("#071A2B");
    expect(themeColors.muted.light).toBe("#4B6377");
  });
});

describe("PrintPilot file operations", () => {
  it("requires at least two files for a PDF merge", () => {
    expect(canMergePdfs(1)).toBe(false);
    expect(canMergePdfs(2)).toBe(true);
    expect(canMergePdfs(0)).toBe(false);
  });

  it("rejects empty or fractional file counts", () => {
    expect(hasAtLeastFiles(0)).toBe(false);
    expect(hasAtLeastFiles(1)).toBe(true);
    expect(hasAtLeastFiles(1.5)).toBe(false);
  });

  it("finds complete JPEG byte ranges without treating unrelated bytes as images", () => {
    const bytes = new Uint8Array([0, 0xff, 0xd8, 1, 2, 0xff, 0xd9, 4, 0xff, 0xd8, 9, 0xff, 0xd9]);
    expect(findJpegByteRanges(bytes)).toEqual([{ start: 1, end: 7 }, { start: 8, end: 13 }]);
  });
});
