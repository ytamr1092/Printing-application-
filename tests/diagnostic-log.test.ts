import { describe, expect, it } from "vitest";
import { buildDiagnosticReport, clearEvents, getEvents, logEvent, summarizeIppResponse } from "../shared/diagnostic-log";

describe("diagnostic log", () => {
  it("keeps recent events and caps the list", () => {
    clearEvents();
    for (let i = 0; i < 60; i += 1) logEvent("print", `job ${i}`);
    const events = getEvents();
    expect(events).toHaveLength(40);
    expect(events[events.length - 1]).toContain("job 59");
  });

  it("builds a sectioned plain-text report", () => {
    const report = buildDiagnosticReport([{ title: "A", lines: ["x"] }, { title: "B", lines: [] }], new Date("2026-01-01T00:00:00Z"));
    expect(report).toContain("== A ==\nx");
    expect(report).toContain("(nothing recorded)");
    expect(report).toContain("2026-01-01");
  });

  it("reads the model and formats out of an IPP answer", () => {
    const name = "printer-make-and-model";
    const value = "Kyocera TASKalfa 306ci";
    const bytes = new Uint8Array([
      ...Array.from(name, (c) => c.charCodeAt(0)),
      0,
      value.length,
      ...Array.from(value, (c) => c.charCodeAt(0)),
      ...Array.from("application/pdf", (c) => c.charCodeAt(0)),
    ]);
    const lines = summarizeIppResponse(bytes);
    expect(lines[0]).toBe("Model: Kyocera TASKalfa 306ci");
    expect(lines[1]).toContain("application/pdf");
  });
});
