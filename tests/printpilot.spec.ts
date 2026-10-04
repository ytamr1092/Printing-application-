import { describe, expect, it } from "vitest";

import {
  paperOptions,
  paperPresetById,
  supportedPaperWeights,
} from "../shared/print-options";
import {
  canMergePdfs,
  findJpegByteRanges,
  hasAtLeastFiles,
} from "../shared/file-operations";
import { printProfiles, printProfileById } from "../shared/print-profiles";
import {
  canStartKyoceraScan,
  hasBothIdFaces,
  isValidIpv4,
} from "../shared/device-operations";
import { formatNumberValue, getNumberingPages } from "../shared/numbering";
import { duplexEdgeLabel, isDuplexEdge } from "../shared/duplex-settings";
import { hasPreviewContent, previewKinds } from "../shared/preview";
import {
  canApplyPageOrder,
  createPageEdits,
  movePage,
  pageOrientation,
  parsePageOrder,
  rotatePage,
  togglePageOrientation,
} from "../shared/pdf-pages";
import { workspaceKinds } from "../shared/workspaces";
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
    expect(supportedPaperWeights).toEqual([
      "70 g/m²",
      "80 g/m²",
      "120 g/m²",
      "200 g/m²",
    ]);
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
    const bytes = new Uint8Array([
      0, 0xff, 0xd8, 1, 2, 0xff, 0xd9, 4, 0xff, 0xd8, 9, 0xff, 0xd9,
    ]);
    expect(findJpegByteRanges(bytes)).toEqual([
      { start: 1, end: 7 },
      { start: 8, end: 13 },
    ]);
  });
});

describe("PrintPilot print profiles", () => {
  it("includes useful ready-to-use profiles", () => {
    expect(printProfiles.map((profile) => profile.id)).toEqual([
      "certificate",
      "a4-bw",
      "photos-a4",
      "duplex",
      "id-card",
    ]);
    expect(printProfileById("duplex").duplex).toBe(true);
    expect(printProfileById("photos-a4").colorMode).toBe("color");
  });
});

describe("PrintPilot ID card and device validation", () => {
  it("requires both ID card faces and validates local IPv4 addresses", () => {
    expect(hasBothIdFaces("front.jpg", null)).toBe(false);
    expect(hasBothIdFaces("front.jpg", "back.jpg")).toBe(true);
    expect(isValidIpv4("192.168.1.50")).toBe(true);
    expect(isValidIpv4("999.1.1.2")).toBe(false);
    expect(canStartKyoceraScan("192.168.1.50", true)).toBe(true);
    expect(canStartKyoceraScan("192.168.1.50", false)).toBe(false);
  });
});

describe("PrintPilot numbering settings", () => {
  it("selects the requested page range and odd/even pages", () => {
    expect(getNumberingPages(8, 2, 7, "all")).toEqual([2, 3, 4, 5, 6, 7]);
    expect(getNumberingPages(8, 2, 7, "odd")).toEqual([3, 5, 7]);
    expect(getNumberingPages(8, 2, 7, "even")).toEqual([2, 4, 6]);
  });

  it("formats Latin, Arabic-Indic, and Roman numerals", () => {
    expect(formatNumberValue(12, "latin")).toBe("12");
    expect(formatNumberValue(12, "indic")).toBe("١٢");
    expect(formatNumberValue(12, "roman-l")).toBe("xii");
    expect(formatNumberValue(12, "roman-u")).toBe("XII");
  });
});

describe("PrintPilot duplex settings", () => {
  it("supports long-edge and short-edge flip modes", () => {
    expect(isDuplexEdge("long")).toBe(true);
    expect(isDuplexEdge("short")).toBe(true);
    expect(isDuplexEdge("top")).toBe(false);
    expect(duplexEdgeLabel("long", "ar")).toBe("الحافة الطويلة");
    expect(duplexEdgeLabel("short", "en")).toBe("Short edge");
  });
});

describe("PrintPilot separate previews", () => {
  it("keeps every workflow in its own preview section", () => {
    expect(previewKinds).toEqual([
      "merge",
      "images",
      "extract",
      "numbering",
      "pages",
      "id",
      "print",
    ]);
    expect(new Set(previewKinds).size).toBe(7);
    expect(hasPreviewContent("print", ["document.pdf"], null, null)).toBe(true);
    expect(hasPreviewContent("id", [], "front.jpg", null)).toBe(true);
    expect(hasPreviewContent("id", [], null, null)).toBe(false);
  });
});

describe("PrintPilot PDF page editor", () => {
  it("parses, deduplicates, reorders, and removes invalid pages", () => {
    expect(parsePageOrder("3, 1, 3, 9, 0, 2", 3)).toEqual([3, 1, 2]);
    expect(canApplyPageOrder([3, 1, 2], 3)).toBe(true);
    expect(canApplyPageOrder([], 3)).toBe(false);
    expect(canApplyPageOrder([4], 3)).toBe(false);
  });

  it("supports drag-like moves and page orientation transforms", () => {
    const edits = createPageEdits(3);
    expect(movePage(edits, 0, 2).map((page) => page.sourcePage)).toEqual([
      2, 3, 1,
    ]);
    expect(rotatePage(0)).toBe(90);
    expect(rotatePage(270)).toBe(0);
    expect(togglePageOrientation(0)).toBe(90);
    expect(pageOrientation(90)).toBe("landscape");
    expect(pageOrientation(180)).toBe("portrait");
  });
});

describe("PrintPilot widget workspaces", () => {
  it("keeps the dashboard and every dedicated workspace available", () => {
    expect(workspaceKinds).toEqual([
      "home",
      "pdf",
      "print",
      "scan",
      "id",
      "results",
      "ai",
    ]);
    expect(new Set(workspaceKinds).size).toBe(7);
  });
});
