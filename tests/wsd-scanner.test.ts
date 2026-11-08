import { describe, expect, it, vi } from "vitest";
import {
  runWsdScan,
  wsdScannerSetupHint,
  type WsdScannerBridge,
} from "../shared/wsd-scanner";

const selectedScanner = {
  serviceUrl: "http://192.168.1.102/wsd/scan",
  name: "Kyocera TASKalfa 306ci",
  model: "TASKalfa 306ci",
  address: "192.168.1.102",
};

describe("WSD scanner selection and local scan bridge", () => {
  it("passes the exact explicitly selected service and settings to the native bridge", async () => {
    const bridge: WsdScannerBridge = {
      discover: vi.fn(async () => [selectedScanner]),
      scan: vi.fn(async () => ({
        pages: [
          { uri: "file:///data/user/0/com.app.printpilotsmart/files/scan-01.jpg", name: "scan-01.jpg", mimeType: "image/jpeg", size: 3 },
          { uri: "file:///data/user/0/com.app.printpilotsmart/files/scan-02.jpg", name: "scan-02.jpg", mimeType: "image/jpeg", size: 2 },
        ],
      })),
    };
    const readLocalPage = vi.fn(async (uri: string) =>
      uri.endsWith("01.jpg") ? Uint8Array.from([255, 216, 255]) : Uint8Array.from([255, 217]),
    );

    const pages = await runWsdScan(
      bridge,
      selectedScanner,
      { dpi: 300, color: "bw", source: "adf", duplex: true, format: "pdf" },
      readLocalPage,
    );

    expect(bridge.scan).toHaveBeenCalledWith("http://192.168.1.102/wsd/scan", "ADF", 300, "bw", true, "jpg");
    expect(bridge.discover).not.toHaveBeenCalled();
    expect(readLocalPage).toHaveBeenCalledTimes(2);
    expect(Array.from(pages[0])).toEqual([255, 216, 255]);
    expect(Array.from(pages[1])).toEqual([255, 217]);
  });

  it("refuses to start without an explicitly selected scanner", async () => {
    const bridge: WsdScannerBridge = {
      discover: async () => [selectedScanner],
      scan: vi.fn(async () => ({ pages: [] })),
    };
    await expect(
      runWsdScan(bridge, null as never, { dpi: 300, color: "color", source: "glass", duplex: false, format: "jpg" }, async () => new Uint8Array([1])),
    ).rejects.toThrow("Choose a discovered WSD scanner");
    expect(bridge.scan).not.toHaveBeenCalled();
  });

  it("refuses a remote page URL instead of reading it", async () => {
    const bridge: WsdScannerBridge = {
      discover: async () => [selectedScanner],
      scan: async () => ({
        pages: [{ uri: "https://example.invalid/scan.jpg", name: "scan.jpg", mimeType: "image/jpeg", size: 10 }],
      }),
    };
    await expect(
      runWsdScan(bridge, selectedScanner, { dpi: 300, color: "color", source: "glass", duplex: false, format: "jpg" }, async () => new Uint8Array([1])),
    ).rejects.toThrow("non-local file");
  });

  it("explains local WS-Discovery requirements without asking for a manual IP", () => {
    const hint = wsdScannerSetupHint();
    expect(hint).toContain("UDP 3702");
    expect(hint).toContain("does not require Internet");
    expect(hint).not.toContain("192.168.1.102");
  });
});
