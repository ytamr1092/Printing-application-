import { describe, expect, it } from "vitest";
import { getAppId } from "../server/_core/env";

describe("server app ID configuration", () => {
  it("prefers the documented Expo public app ID", () => {
    expect(
      getAppId({
        EXPO_PUBLIC_APP_ID: "printpilot-app",
        VITE_APP_ID: "legacy-app",
      }),
    ).toBe("printpilot-app");
  });

  it("falls back to the legacy Vite variable when the Expo value is blank", () => {
    expect(
      getAppId({ EXPO_PUBLIC_APP_ID: "", VITE_APP_ID: "legacy-app" }),
    ).toBe("legacy-app");
  });

  it("returns an empty string when neither variable is configured", () => {
    expect(getAppId({})).toBe("");
  });
});
