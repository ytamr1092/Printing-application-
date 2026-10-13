import { describe, expect, it } from "vitest";
import { PDFDocument, degrees } from "pdf-lib";

import {
  paperOptions,
  paperPresetById,
  supportedPaperWeights,
} from "../shared/print-options";
import {
  canMergePdfs,
  findJpegByteRanges,
  findPngByteRanges,
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
  dragDirection,
  movePage,
  pageOrientation,
  parsePageOrder,
  rotatePage,
  synchronizePageOrder,
  togglePageOrientation,
} from "../shared/pdf-pages";
import { generatePdfPageThumbnail } from "../shared/pdf-thumbnail";
import { workspaceKinds } from "../shared/workspaces";
import {
  createIdCardLayout,
  normalizeIdCopies,
  CR80_CARD_HEIGHT_MM,
  CR80_CARD_WIDTH_MM,
} from "../shared/id-card";
import { moveWorkflowItem, normalizeRotation, rotateWorkflowFile } from "../shared/workflow-files";
import { themeColors } from "../theme.config";
import {
  advancedSettingsStorageKey,
  defaultAdvancedSettings,
  normalizeAdvancedSettings,
} from "../shared/advanced-settings";

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

  it("finds complete PNG byte ranges for PNG extraction", () => {
    const png = [
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 0x49, 0x45, 0x4e,
      0x44, 0xae, 0x42, 0x60, 0x82,
    ];
    expect(findPngByteRanges(new Uint8Array([9, ...png, 8]))).toEqual([
      { start: 1, end: 20 },
    ]);
  });
});

describe("PrintPilot advanced settings", () => {
  it("normalizes invalid persisted values to safe defaults", () => {
    const settings = normalizeAdvancedSettings({
      printScale: "broken",
      numberBold: true,
    });
    expect(settings.printScale).toBe(defaultAdvancedSettings.printScale);
    expect(settings.numberBold).toBe(true);
    expect(settings.scannerFormat).toBe("pdf");
  });

  it("uses a dedicated storage key", () => {
    expect(advancedSettingsStorageKey).toBe("printpilot.advanced-settings.v1");
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

  it("ignores short drags and reports a stable direction after the threshold", () => {
    expect(dragDirection(37, 38)).toBe(0);
    expect(dragDirection(38, 38)).toBe(1);
    expect(dragDirection(-40, 38)).toBe(-1);
    expect(dragDirection(Number.NaN, 38)).toBe(0);
  });

  it("applies typed page order and preserves each page's rotation", () => {
    const edits = createPageEdits(3).map((page) =>
      page.sourcePage === 3 ? { ...page, rotation: 90 as const } : page,
    );
    expect(synchronizePageOrder(edits, "3, 1, 3, 0, 9, 2", 3)).toEqual([
      { sourcePage: 3, rotation: 90 },
      { sourcePage: 1, rotation: 0 },
      { sourcePage: 2, rotation: 0 },
    ]);
  });

  it("writes the requested order, omission, and rotation into a real PDF", async () => {
    const source = await PDFDocument.create();
    source.addPage([100, 200]);
    source.addPage([300, 400]);
    source.addPage([500, 600]);
    const sourceBytes = await source.save();
    const input = await PDFDocument.load(sourceBytes);
    const edits = createPageEdits(3).map((page) =>
      page.sourcePage === 3 ? { ...page, rotation: 90 as const } : page,
    );
    const orderedEdits = synchronizePageOrder(edits, "3, 1, 3, 0", 3);
    const output = await PDFDocument.create();
    const copied = await output.copyPages(
      input,
      orderedEdits.map((page) => page.sourcePage - 1),
    );
    copied.forEach((page, index) => {
      if (orderedEdits[index].rotation)
        page.setRotation(degrees(orderedEdits[index].rotation));
      output.addPage(page);
    });
    const reopened = await PDFDocument.load(await output.save());
    expect(reopened.getPageCount()).toBe(2);
    expect(reopened.getPage(0).getWidth()).toBe(500);
    expect(reopened.getPage(1).getWidth()).toBe(100);
    expect(reopened.getPage(0).getRotation().angle).toBe(90);
  });
});

describe("PrintPilot workflow file order and image rotation", () => {
  it("moves selected files without changing the item values or losing order", () => {
    const files = [
      { uri: "file:///first.jpg", name: "first.jpg" },
      { uri: "file:///second.jpg", name: "second.jpg" },
      { uri: "file:///third.jpg", name: "third.jpg" },
    ];
    expect(moveWorkflowItem(files, 0, 2).map((file) => file.uri)).toEqual([
      "file:///second.jpg",
      "file:///third.jpg",
      "file:///first.jpg",
    ]);
    expect(moveWorkflowItem(files, 4, 1)).toEqual(files);
  });

  it("rotates an image by quarter-turns and normalizes stored angles", () => {
    const photo = { uri: "file:///photo.jpg", name: "photo.jpg", rotation: 0 };
    const rotated = rotateWorkflowFile(photo);
    expect(rotated).toEqual({ ...photo, rotation: 90 });
    expect(rotateWorkflowFile({ ...rotated, rotation: 270 }).rotation).toBe(0);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(45)).toBe(90);
  });
});

describe("PrintPilot web PDF preview fallback", () => {
  it("reports a deliberate unavailable preview instead of a fake thumbnail", async () => {
    await expect(generatePdfPageThumbnail("blob:local-file", 0)).resolves.toBeNull();
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

describe("PrintPilot CR80 ID card layout", () => {
  it("normalizes copy counts and fits natural-size cards on A4", () => {
    expect(normalizeIdCopies("0")).toBe(1);
    expect(normalizeIdCopies("12")).toBe(12);
    expect(normalizeIdCopies("999")).toBe(100);
    const layout = createIdCardLayout(12, 5, "long");
    expect(layout.cardWidthMm).toBe(CR80_CARD_WIDTH_MM);
    expect(layout.cardHeightMm).toBe(CR80_CARD_HEIGHT_MM);
    expect(layout.cardsPerPage).toBeGreaterThanOrEqual(10);
    expect(layout.backTransform).toBe("scaleX(-1)");
  });

  it("mirrors the back vertically for short-edge duplex printing", () => {
    expect(createIdCardLayout(1, 5, "short").backTransform).toBe("scaleY(-1)");
  });
});
