import { afterEach, describe, expect, it, vi } from "vitest";
import { base64ToBytes, bytesToBase64, getNumberFont } from "../shared/pdf-encoding";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PDF encoding helpers", () => {
  it("round-trips arbitrary byte values through base64", () => {
    const bytes = Uint8Array.from([0, 1, 2, 127, 128, 200, 255]);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });

  it("uses the Buffer fallback when browser base64 functions are unavailable", () => {
    vi.stubGlobal("atob", undefined);
    vi.stubGlobal("btoa", undefined);
    const bytes = Uint8Array.from([0, 16, 127, 128, 255]);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });

  it("selects the requested standard font and weight", () => {
    const fonts = {
      Helvetica: "Helvetica",
      HelveticaBold: "Helvetica-Bold",
      TimesRoman: "Times-Roman",
      TimesRomanBold: "Times-Bold",
      Courier: "Courier",
      CourierBold: "Courier-Bold",
    };

    expect(getNumberFont(fonts, "helvetica", false)).toBe("Helvetica");
    expect(getNumberFont(fonts, "helvetica", true)).toBe("Helvetica-Bold");
    expect(getNumberFont(fonts, "times", false)).toBe("Times-Roman");
    expect(getNumberFont(fonts, "times", true)).toBe("Times-Bold");
    expect(getNumberFont(fonts, "courier", false)).toBe("Courier");
    expect(getNumberFont(fonts, "courier", true)).toBe("Courier-Bold");
  });
});
