import { describe, expect, it } from "vitest";
import { fileBaseName, fileExtension, numberedFileName, sanitizeFileName } from "../shared/file-name";

describe("file names", () => {
  it("cleans illegal characters, extensions and blanks", () => {
    expect(sanitizeFileName('  تقرير: نهائي?/2.pdf ')).toBe("تقرير نهائي 2");
    expect(sanitizeFileName("...", "fallback")).toBe("fallback");
    expect(sanitizeFileName("", "x")).toBe("x");
    expect(sanitizeFileName("a".repeat(200)).length).toBe(80);
  });
  it("reads base name and extension from a uri", () => {
    expect(fileBaseName("file:///a/Print%20Pilot-1.pdf")).toBe("Print Pilot-1");
    expect(fileExtension("file:///a/b.PDF")).toBe(".pdf");
    expect(fileExtension("file:///a/noext")).toBe("");
  });
  it("numbers only multi-file output", () => {
    expect(numberedFileName("doc", 0, 1)).toBe("doc");
    expect(numberedFileName("doc", 1, 3)).toBe("doc-02");
  });
});
