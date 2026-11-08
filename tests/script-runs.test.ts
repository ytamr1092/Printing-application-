import { describe, expect, it } from "vitest";
import { hasArabic, hasLatin, splitScriptRuns } from "../shared/script-runs";

const join = (text: string) =>
  splitScriptRuns(text)
    .map((run) => run.text)
    .join("");

describe("script runs", () => {
  it("detects Arabic and Latin text", () => {
    expect(hasArabic("طباعة")).toBe(true);
    expect(hasArabic("Print")).toBe(false);
    expect(hasLatin("Print")).toBe(true);
    expect(hasLatin("3")).toBe(true);
    expect(hasLatin("طباعة ٣")).toBe(false);
  });

  it("keeps Arabic-only text as one non-Latin run", () => {
    expect(splitScriptRuns("تصفح الملفات")).toEqual([{ text: "تصفح الملفات", latin: false }]);
  });

  it("keeps English-only text as one Latin run", () => {
    expect(splitScriptRuns("Print PDF")).toEqual([{ text: "Print PDF", latin: true }]);
  });

  it("splits Latin words out of an Arabic sentence", () => {
    expect(splitScriptRuns("ملف PDF جديد")).toEqual([
      { text: "ملف ", latin: false },
      { text: "PDF", latin: true },
      { text: " جديد", latin: false },
    ]);
  });

  it("keeps units and joined words together", () => {
    const runs = splitScriptRuns("ورق A4 بوزن 200 g/m² عبر Wi-Fi");
    expect(runs.filter((run) => run.latin).map((run) => run.text)).toEqual(["A4", "200 g/m²", "Wi-Fi"]);
  });

  it("treats Arabic-Indic digits as Arabic", () => {
    expect(splitScriptRuns("٣ نسخ")).toEqual([{ text: "٣ نسخ", latin: false }]);
  });

  it("never loses or reorders characters", () => {
    for (const text of ["", " ", "A", "(PDF) ملف", "عدد: 5 ملفات.", "x ي y ز", "100%"]) {
      expect(join(text)).toBe(text);
    }
  });
});
