import { describe, expect, it } from "vitest";

import { paperOptions, paperPresetById, supportedPaperWeights } from "../shared/print-options";
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
