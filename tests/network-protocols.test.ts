import { readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildIppRequest, IPP_OPERATION, ippPrinterUri, parseIppPrinterAttributes, parseIppResponse } from "../shared/ipp";

const nativeWsd = vi.hoisted(() => ({
  discover: vi.fn(),
  scan: vi.fn(),
  readAsStringAsync: vi.fn(),
}));

vi.mock("react-native", () => ({
  NativeModules: {
    PrintPilotWsdScanner: {
      discover: nativeWsd.discover,
      scan: nativeWsd.scan,
    },
  },
  Platform: { OS: "android" },
}));

vi.mock("expo-file-system/legacy", () => ({
  EncodingType: { Base64: "base64" },
  readAsStringAsync: nativeWsd.readAsStringAsync,
}));

import { clearEvents, getEvents } from "../shared/diagnostic-log";
import { copy } from "../shared/copy";
import { hasWsdScanService, WSD_SCAN_ELEMENT_NAMESPACE } from "../shared/wsd-scanner";
import { readIppPrinterDevice, retainExplicitSelection, runSingleFlight } from "../shared/network-devices";
import {
  discoverDevices,
  discoverNetworkDevices,
  devicesForTask,
  isPrivateIpv4Literal,
  requiresDestinationChangeConfirmation,
  runWsdNetworkScan,
  sendIppPrintJobToDevice,
} from "../shared/network-devices";

const appSource = readFileSync(fileURLToPath(new NodeURL("../app/(tabs)/index.tsx", import.meta.url)), "utf8");
const rawPrintSource = readFileSync(fileURLToPath(new NodeURL("../shared/raw-print.ts", import.meta.url)), "utf8");
const toolWorkflowSource = readFileSync(fileURLToPath(new NodeURL("../components/tool-workflow-screen.tsx", import.meta.url)), "utf8");

const okIpp = () => ({
  ok: true,
  status: 200,
  arrayBuffer: async () => Uint8Array.from([1, 1, 0, 0, 0, 0, 0, 1, 3]).buffer,
  headers: new Headers(),
});

const ippAttributesResponse = (entries: { tag: number; name: string; values: (string | number)[] }[]) => {
  const encoder = new TextEncoder();
  const bytes = [1, 1, 0, 0, 0, 0, 0, 1, 4];
  for (const entry of entries) {
    entry.values.forEach((value, index) => {
      const name = index === 0 ? encoder.encode(entry.name) : new Uint8Array();
      const encoded = typeof value === "number"
        ? Uint8Array.from([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255])
        : encoder.encode(value);
      bytes.push(entry.tag, (name.length >> 8) & 255, name.length & 255, ...name, (encoded.length >> 8) & 255, encoded.length & 255, ...encoded);
    });
  }
  bytes.push(3);
  const body = Uint8Array.from(bytes);
  return { ok: true, status: 200, arrayBuffer: async () => body.buffer, headers: new Headers() };
};

const ippPrinterResponse = (name: string, model: string, formats: string[] | null, operations: number[] | null = [IPP_OPERATION.printJob]) => {
  const entries: { tag: number; name: string; values: (string | number)[] }[] = [
    { tag: 0x42, name: "printer-name", values: [name] },
    { tag: 0x41, name: "printer-make-and-model", values: [model] },
  ];
  if (formats !== null) entries.push({ tag: 0x49, name: "document-format-supported", values: formats });
  if (operations !== null) entries.push({ tag: 0x23, name: "operations-supported", values: operations });
  return ippAttributesResponse(entries);
};

describe("IPP", () => {
  it("builds a Print-Job request with the document appended", () => {
    const doc = Uint8Array.from([37, 80, 68, 70]);
    const body = buildIppRequest(IPP_OPERATION.printJob, ippPrinterUri("192.168.1.50"), { copies: 2, sides: "two-sided-long-edge", colorMode: "monochrome" }, doc);
    expect(Array.from(body.slice(0, 4))).toEqual([1, 1, 0, 2]);
    const text = new TextDecoder().decode(body);
    expect(text).toContain("ipp://192.168.1.50:631/ipp/print");
    expect(text).toContain("document-format");
    expect(text).toContain("two-sided-long-edge");
    expect(Array.from(body.slice(-4))).toEqual([37, 80, 68, 70]);
    expect(body.includes(0x03)).toBe(true);
  });

  it("omits job attributes for a single plain copy and for attribute queries", () => {
    const body = buildIppRequest(IPP_OPERATION.printJob, "ipp://x/ipp/print", { copies: 1 });
    expect(new TextDecoder().decode(body)).not.toContain("copies");
    const query = buildIppRequest(IPP_OPERATION.getPrinterAttributes, "ipp://x/ipp/print");
    expect(Array.from(query.slice(0, 4))).toEqual([1, 1, 0, 11]);
    expect(new TextDecoder().decode(query)).toContain("requested-attributes");
    expect(new TextDecoder().decode(query)).toContain("document-format-supported");
    expect(new TextDecoder().decode(query)).toContain("operations-supported");
    expect(new TextDecoder().decode(query)).not.toContain("application/pdf");
  });

  it("reads the status code and rejects non-IPP bodies", () => {
    expect(parseIppResponse(Uint8Array.from([1, 1, 0, 0, 0, 0, 0, 1, 3]))).toEqual({ statusCode: 0, ok: true });
    expect(parseIppResponse(Uint8Array.from([1, 1, 4, 0, 0, 0, 0, 1, 3]))?.ok).toBe(false);
    expect(parseIppResponse(Uint8Array.from([1, 1]))).toBeNull();
    expect(parseIppResponse(new TextEncoder().encode("<html>HTTP 500</html>"))).toBeNull();
  });

  it("parses printer identity, repeated supported formats, and numeric operation enum values", async () => {
    const response = ippPrinterResponse("Office printer", "Example 9000", ["application/pdf", "image/jpeg"]);
    const parsed = parseIppPrinterAttributes(new Uint8Array(await response.arrayBuffer()));
    expect(parsed).toMatchObject({
      ok: true,
      attributes: {
        "printer-name": ["Office printer"],
        "printer-make-and-model": ["Example 9000"],
        "document-format-supported": ["application/pdf", "image/jpeg"],
        "operations-supported": ["2"],
      },
    });
  });
});

describe("network devices", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    clearEvents();
  });

  it("tries IPP paths only through a capability-verified device and stays on its address", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(url);
      return url.endsWith("/ipp") ? okIpp() : { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0), headers: new Headers() };
    }));
    expect(await sendIppPrintJobToDevice({
      address: "10.0.0.9", ippPath: "/ipp/print", supportedOperations: [IPP_OPERATION.printJob], supportedFormats: ["application/pdf"], supportsPrint: true,
    }, Uint8Array.from([1]), { mimeType: "application/pdf" })).toEqual({ status: "accepted" });
    expect(calls).toEqual(["http://10.0.0.9:631/ipp/print", "http://10.0.0.9:631/ipp"]);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await sendIppPrintJobToDevice({
      address: "10.0.0.9", ippPath: "/ipp/print", supportedOperations: [IPP_OPERATION.printJob], supportedFormats: ["application/pdf"], supportsPrint: true,
    }, Uint8Array.from([1]), { mimeType: "application/pdf" })).toEqual({ status: "failed" });
  });

  it("shares one in-flight discovery and clears the single-flight gate after completion", async () => {
    let finish!: () => void;
    const operation = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const slot: { current: Promise<void> | null } = { current: null };
    const first = runSingleFlight(slot, operation);
    const second = runSingleFlight(slot, operation);
    expect(second).toBe(first);
    await Promise.resolve();
    expect(operation).toHaveBeenCalledTimes(1);
    finish();
    await Promise.all([first, second]);
    expect(slot.current).toBeNull();
  });

  it("preserves only an explicit device selection and never defaults to the first discovered device", () => {
    const candidates = [{ address: "192.168.1.101" }, { address: "192.168.1.102" }];
    expect(retainExplicitSelection(null, candidates, (candidate, selected) => candidate.address === selected.address)).toBeNull();
    expect(retainExplicitSelection({ address: "192.168.1.102" }, candidates, (candidate, selected) => candidate.address === selected.address)).toBe(candidates[1]);
    expect(retainExplicitSelection({ address: "192.168.1.103" }, candidates, (candidate, selected) => candidate.address === selected.address)).toBeNull();
  });

  it("finds printers and scanners on the local /24 network", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.startsWith("http://192.168.1.50/eSCL")) return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0), headers: new Headers() };
      if (url.startsWith("http://192.168.1.50:631/ipp/print")) return okIpp();
      throw new Error("no route");
    }));
    const found = await discoverDevices("192.168.1.20");
    expect(found).toEqual([{ ip: "192.168.1.50", ipp: "/ipp/print", escl: true }]);
    expect(await discoverDevices("bad")).toEqual([]);
  });

  it("merges scanner-only, print-only, dual-capability, and unsupported-format devices from local WSD and IPP", async () => {
    nativeWsd.discover.mockResolvedValue([
      { serviceUrl: "http://192.168.1.101/scan", name: "Scanner One", model: "ScanModel A", address: "192.168.1.101", serviceTypes: [{ namespace: WSD_SCAN_ELEMENT_NAMESPACE, localName: "ScanDeviceType" }] },
      { serviceUrl: "http://192.168.1.102/wsd/scan", name: "Kyocera TASKalfa 306ci", model: "TASKalfa 306ci", address: "192.168.1.102", serviceTypes: [{ namespace: WSD_SCAN_ELEMENT_NAMESPACE, localName: "ScanDeviceType" }] },
      { serviceUrl: "http://192.168.1.103/printer", name: "Printer-only responder", address: "192.168.1.103", serviceTypes: [{ namespace: "http://schemas.xmlsoap.org/ws/2005/04/discovery", localName: "Device" }] },
      { serviceUrl: "http://192.168.1.104/unknown", name: "Typeless responder", address: "192.168.1.104" },
    ]);
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(url);
      if (url === "http://192.168.1.50:631/ipp/print") return ippPrinterResponse("Office Printer", "Example 9000", ["application/pdf"]);
      if (url === "http://192.168.1.60:631/ipp/print") return ippPrinterResponse("Legacy Printer", "Legacy 10", ["application/postscript"]);
      if (url === "http://192.168.1.102:631/ipp/print") return ippPrinterResponse("TASKalfa 306ci", "Kyocera TASKalfa 306ci", ["application/pdf", "image/jpeg"]);
      throw new Error("no local IPP response");
    }));

    const result = await discoverNetworkDevices("192.168.1.20");
    const byIp = new Map(result.devices.map((device) => [device.address, device]));
    expect(devicesForTask(result.devices, "print").map((device) => device.address)).toEqual(["192.168.1.50", "192.168.1.102"]);
    expect(devicesForTask(result.devices, "scan").map((device) => device.address)).toEqual(["192.168.1.101", "192.168.1.102"]);

    expect(byIp.get("192.168.1.101")).toMatchObject({
      name: "Scanner One", model: "ScanModel A", supportsScan: true, supportsPrint: null, supportedOperations: null, supportedFormats: null,
    });
    expect(byIp.get("192.168.1.102")).toMatchObject({
      name: "Kyocera TASKalfa 306ci", model: "Kyocera TASKalfa 306ci", supportsScan: true, supportsPrint: true,
      supportedOperations: [IPP_OPERATION.printJob],
      supportedFormats: ["application/pdf", "image/jpeg"],
    });
    expect(byIp.get("192.168.1.50")).toMatchObject({
      name: "Office Printer", model: "Example 9000", supportsScan: null, supportsPrint: true,
      supportedOperations: [IPP_OPERATION.printJob],
      supportedFormats: ["application/pdf"],
    });
    expect(byIp.get("192.168.1.60")).toMatchObject({
      name: "Legacy Printer", model: "Legacy 10", supportsScan: null, supportsPrint: false, supportedFormats: ["application/postscript"],
    });
    expect(byIp.has("192.168.1.103")).toBe(false);
    expect(byIp.has("192.168.1.104")).toBe(false);
    expect(byIp.has("192.168.1.70")).toBe(false);
    expect(calls.every((url) => url.startsWith("http://192.168.1."))).toBe(true);
    expect(calls.some((url) => url.includes("eSCL"))).toBe(false);
    expect(isPrivateIpv4Literal("192.168.1.20")).toBe(true);
    expect(isPrivateIpv4Literal("8.8.8.8")).toBe(false);
  });

  it.each([
    { formats: ["application/pdf"], operations: [IPP_OPERATION.printJob], expected: true },
    { formats: ["application/pdf"], operations: [IPP_OPERATION.getPrinterAttributes], expected: false },
    { formats: ["application/postscript"], operations: [IPP_OPERATION.printJob], expected: false },
    { formats: ["application/pdf"], operations: null, expected: null },
    { formats: null, operations: [IPP_OPERATION.printJob], expected: null },
  ])("verifies IPP operation and format before setting supportsPrint: %o", async ({ formats, operations, expected }) => {
    vi.stubGlobal("fetch", vi.fn(async () => ippPrinterResponse("Test printer", "Test model", formats, operations)));
    const device = await readIppPrinterDevice("192.168.1.90");
    expect(device?.supportsPrint).toBe(expected);
    expect(device?.supportedOperations).toEqual(operations);
  });

  it("rejects unsupported formats without sending and requires confirmation before changing destination", async () => {
    const fetchMock = vi.fn(async () => okIpp());
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendIppPrintJobToDevice({
      address: "192.168.1.50", ippPath: "/ipp/print", supportedOperations: [IPP_OPERATION.printJob], supportedFormats: ["application/pdf"], supportsPrint: true,
    }, Uint8Array.from([1]), { mimeType: "image/jpeg" });

    expect(result).toEqual({ status: "unsupported-format" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(requiresDestinationChangeConfirmation(result)).toBe(true);
  });

  it.each([
    { supportsPrint: null, supportedOperations: null, supportedFormats: null },
    { supportsPrint: true, supportedOperations: null, supportedFormats: ["application/pdf"] },
    { supportsPrint: null, supportedOperations: [IPP_OPERATION.printJob], supportedFormats: null },
    { supportsPrint: null, supportedOperations: [IPP_OPERATION.printJob], supportedFormats: ["application/pdf"] },
  ])("does not send direct IPP when capability is unconfirmed: %o", async (capability) => {
    const fetchMock = vi.fn(async () => okIpp());
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendIppPrintJobToDevice({
      address: "192.168.1.50", ippPath: "/ipp/print", ...capability,
    }, Uint8Array.from([1]), { mimeType: "application/pdf" });

    expect(result).toEqual({ status: "unconfirmed-capability" });
    expect(requiresDestinationChangeConfirmation(result)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects direct IPP when Print-Job is explicitly not advertised", async () => {
    const fetchMock = vi.fn(async () => okIpp());
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendIppPrintJobToDevice({
      address: "192.168.1.50", ippPath: "/ipp/print", supportedOperations: [IPP_OPERATION.getPrinterAttributes],
      supportedFormats: ["application/pdf"], supportsPrint: false,
    }, Uint8Array.from([1]), { mimeType: "application/pdf" });

    expect(result).toEqual({ status: "unsupported-operation" });
    expect(requiresDestinationChangeConfirmation(result)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps direct IPP printing on the selected target and requires explicit system-dialog confirmation on failure", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(url);
      return { ok: false, status: 503, arrayBuffer: async () => new TextEncoder().encode("unavailable").buffer, headers: new Headers() };
    }));
    const result = await sendIppPrintJobToDevice({
      address: "192.168.1.50", ippPath: "/ipp/print", supportedOperations: [IPP_OPERATION.printJob], supportedFormats: ["application/pdf"], supportsPrint: true,
    }, Uint8Array.from([1]), { mimeType: "application/pdf" });

    expect(result).toEqual({ status: "failed" });
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((url) => url.startsWith("http://192.168.1.50:631/"))).toBe(true);
    expect(requiresDestinationChangeConfirmation(result)).toBe(true);
  });

  it("sends accepted IPP jobs to the selected device's verified endpoint", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(url);
      return okIpp();
    }));
    const result = await sendIppPrintJobToDevice({
      address: "192.168.1.55", ippPath: "/ipp/printer", supportedOperations: [IPP_OPERATION.printJob], supportedFormats: ["application/pdf"], supportsPrint: true,
    }, Uint8Array.from([1]), { mimeType: "application/pdf" });

    expect(result).toEqual({ status: "accepted" });
    expect(calls).toEqual(["http://192.168.1.55:631/ipp/printer"]);
  });

  it("requires a destination-choice confirmation and discloses Android may change destinations", () => {
    const noTargetBranch = appSource.match(/if \(!target\) \{([\s\S]*?)\n\s{4}\}/)?.[1] ?? "";
    expect(noTargetBranch.indexOf("confirmSystemPrintWithoutTarget")).toBeGreaterThanOrEqual(0);
    expect(noTargetBranch.indexOf("confirmSystemPrintWithoutTarget")).toBeLessThan(noTargetBranch.indexOf("Print.printAsync"));
    expect(noTargetBranch).toContain('if (!confirmed) return "cancelled"');
    expect(copy.en.printNoTargetPrompt).toContain("must choose a destination there");
    expect(copy.en.printNoTargetPrompt).toContain("may differ");
    expect(copy.en.printTargetFallbackPrompt).toContain("may use a different destination");
    expect(copy.en.directPrintFallback).toContain("destination may differ from the selected printer");
    expect(copy.en.directPrintFallback).not.toContain("sent to the selected printer");
    expect(copy.en.systemPrintDialogOpened).toContain("choose the destination there");
  });

  it("starts discovery on Print/Scan entry, keeps refresh, and exports no raw print bypass", () => {
    const printEntry = appSource.match(/const startTool = \(kind: PreviewKind\) => \{([\s\S]*?)\n  \};/)?.[1] ?? "";
    const workspaceEntry = appSource.match(/const enterWorkspace = \(next: Workspace\) => \{([\s\S]*?)\n  \};/)?.[1] ?? "";
    expect(printEntry).toContain('if (kind === "print") void searchNetworkDevices();');
    expect(workspaceEntry).toContain('if (next === "print" || next === "scan") void searchNetworkDevices();');
    expect(appSource).toContain('onPress={() => enterWorkspace("scan")}');
    expect(appSource).toContain("const searchNetworkDevices = () => runSingleFlight(networkDiscoveryPromise");
    expect(appSource).toContain("setSelectedPrintDevice((selected) => retainExplicitSelection(");
    expect(appSource).toContain('networkDevicePicker={previewKind === "print"');
    expect(appSource).toContain('onDiscover={() => { void searchNetworkDevices(); }}');
    expect(appSource).not.toContain("setSelectedPrintDevice(result.devices[0])");
    expect(appSource).not.toContain("setSelectedWsdScanner(result.devices[0])");
    expect(rawPrintSource).not.toMatch(/export\s+(?:async\s+)?function\s+sendRawPrintJob/);
    expect(rawPrintSource).not.toContain("sendRawPrintJob");
  });

  it("describes local IPP verification and the confirmed Android-dialog fallback", () => {
    expect(toolWorkflowSource).not.toContain("Leave empty to use system printing");
    expect(toolWorkflowSource).toContain("Android's print dialog");
    expect(toolWorkflowSource).toContain("local IP address");
  });

  it("scans only through the exact selected WSD service and reads locally saved page files", async () => {
    nativeWsd.scan.mockResolvedValue({
      pages: [{ uri: "file:///data/user/0/com.app.printpilotsmart/files/scan-01.jpg", name: "scan-01.jpg", mimeType: "image/jpeg", size: 2 }],
    });
    nativeWsd.readAsStringAsync.mockResolvedValue("CQg=");
    const fetchMock = vi.fn(async () => { throw new Error("unexpected non-WSD network request"); });
    vi.stubGlobal("fetch", fetchMock);

    const pages = await runWsdNetworkScan({
      serviceUrl: "http://192.168.1.102/wsd/scan", name: "Kyocera", address: "192.168.1.102",
    }, {
      dpi: 300, color: "bw", source: "adf", duplex: true, format: "jpg",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(nativeWsd.discover).not.toHaveBeenCalled();
    expect(nativeWsd.scan).toHaveBeenCalledWith("http://192.168.1.102/wsd/scan", "ADF", 300, "bw", true, "jpg");
    expect(nativeWsd.readAsStringAsync).toHaveBeenCalledWith(
      "file:///data/user/0/com.app.printpilotsmart/files/scan-01.jpg",
      { encoding: "base64" },
    );
    expect(Array.from(pages[0])).toEqual([9, 8]);
    expect(getEvents().join("\n")).toContain("WSD-only completed");
  });

  it("surfaces WSD faults with a next step and never falls back to eSCL", async () => {
    nativeWsd.discover.mockResolvedValue([
      { serviceUrl: "http://192.168.1.102/wsd/scan", name: "Kyocera", address: "192.168.1.102" },
    ]);
    nativeWsd.scan.mockRejectedValue(new Error("WSD CreateScanJob HTTP 500: Scanner busy"));
    const fetchMock = vi.fn(async () => { throw new Error("unexpected eSCL fallback"); });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      runWsdNetworkScan({ serviceUrl: "http://192.168.1.102/wsd/scan", name: "Kyocera", address: "192.168.1.102" }, { dpi: 300, color: "color", source: "glass", duplex: false, format: "jpg" }),
    ).rejects.toThrow(/WSD CreateScanJob HTTP 500: Scanner busy[\s\S]*Next:[\s\S]*No eSCL fallback was attempted/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getEvents().join("\n")).toContain("No eSCL fallback was attempted");
  });

  it("returns an empty combined result while keeping discovery limited to local IPP and WSD", async () => {
    nativeWsd.discover.mockResolvedValue([]);
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      calls.push(url);
      throw new Error("no local IPP printer");
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(discoverNetworkDevices("192.168.1.20")).resolves.toEqual({ devices: [] });
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((url) => url.startsWith("http://192.168.1."))).toBe(true);
    expect(calls.some((url) => url.includes("eSCL"))).toBe(false);
  });
});
