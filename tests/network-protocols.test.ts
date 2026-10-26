import { describe, expect, it } from "vitest";
import { buildIppRequest, IPP_OPERATION, ippPrinterUri, parseIppResponse } from "../shared/ipp";
import { buildEsclScanSettings, esclBaseUrl, resolveEsclJobUrl } from "../shared/escl";

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
    expect(new TextDecoder().decode(query)).not.toContain("document-format");
  });
  it("reads the status code", () => {
    expect(parseIppResponse(Uint8Array.from([1, 1, 0, 0, 0, 0, 0, 1, 3]))).toEqual({ statusCode: 0, ok: true });
    expect(parseIppResponse(Uint8Array.from([1, 1, 4, 0, 0, 0, 0, 1, 3]))?.ok).toBe(false);
    expect(parseIppResponse(Uint8Array.from([1, 1]))).toBeNull();
  });
});

describe("eSCL", () => {
  it("builds scan settings", () => {
    const xml = buildEsclScanSettings({ dpi: 300, color: "bw", source: "adf", duplex: true, format: "pdf" });
    expect(xml).toContain("<pwg:InputSource>Feeder</pwg:InputSource>");
    expect(xml).toContain("Grayscale8");
    expect(xml).toContain("application/pdf");
    expect(xml).toContain("<scan:Duplex>true</scan:Duplex>");
    const glass = buildEsclScanSettings({ dpi: 123, color: "color", source: "glass", duplex: true, format: "jpg" });
    expect(glass).toContain("Platen");
    expect(glass).toContain("<scan:XResolution>300</scan:XResolution>");
    expect(glass).not.toContain("Duplex");
  });
  it("resolves job locations", () => {
    const base = esclBaseUrl("10.0.0.5");
    expect(base).toBe("http://10.0.0.5/eSCL");
    expect(resolveEsclJobUrl("http://10.0.0.5/eSCL/ScanJobs/7/", "10.0.0.5", base)).toBe("http://10.0.0.5/eSCL/ScanJobs/7");
    expect(resolveEsclJobUrl("/eSCL/ScanJobs/7", "10.0.0.5", base)).toBe("http://10.0.0.5/eSCL/ScanJobs/7");
    expect(resolveEsclJobUrl("7", "10.0.0.5", base)).toBe("http://10.0.0.5/eSCL/ScanJobs/7");
    expect(resolveEsclJobUrl(null, "10.0.0.5", base)).toBeNull();
  });
});

import { afterEach, vi } from "vitest";
import { discoverDevices, runEsclScan, sendIppPrintJob } from "../shared/network-devices";

const okIpp = () => ({ ok: true, status: 200, arrayBuffer: async () => Uint8Array.from([1, 1, 0, 0, 0, 0, 0, 1, 3]).buffer, headers: new Headers() });

describe("network devices", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("prints through the first IPP path that accepts the job", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(url);
      return url.endsWith("/ipp") ? okIpp() : { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0), headers: new Headers() };
    }));
    expect(await sendIppPrintJob("10.0.0.9", Uint8Array.from([1]), { mimeType: "application/pdf" })).toBe(true);
    expect(calls).toEqual(["http://10.0.0.9:631/ipp/print", "http://10.0.0.9:631/ipp"]);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await sendIppPrintJob("10.0.0.9", Uint8Array.from([1]), {})).toBe(false);
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

  it("scans every page from the feeder", async () => {
    let pages = 2;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") return { ok: true, status: 201, arrayBuffer: async () => new ArrayBuffer(0), headers: new Headers({ Location: "/eSCL/ScanJobs/4" }) };
      if (pages > 0) { pages -= 1; return { ok: true, status: 200, arrayBuffer: async () => Uint8Array.from([9]).buffer, headers: new Headers() }; }
      return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0), headers: new Headers() };
    }));
    const docs = await runEsclScan("10.0.0.5", { dpi: 300, color: "color", source: "adf", duplex: false, format: "jpg" });
    expect(docs).toHaveLength(2);
  });
});
