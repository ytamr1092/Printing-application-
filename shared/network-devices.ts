import {
  buildIppRequest,
  IPP_OPERATION,
  ippHttpUrl,
  ippPrinterUri,
  parseIppResponse,
  type IppJobOptions,
} from "./ipp";
import { buildEsclScanSettings, esclBaseUrl, esclBaseUrls, resolveEsclJobUrl, type EsclSettings } from "./escl";

export const IPP_PATHS = ["/ipp/print", "/ipp", "/ipp/printer"];

export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 4000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function ippCall(
  ip: string,
  path: string,
  operation: number,
  options: IppJobOptions,
  document: Uint8Array | undefined,
  ms: number,
): Promise<{ ok: boolean; statusCode: number; timedOut?: boolean } | null> {
  try {
    const response = await fetchWithTimeout(
      ippHttpUrl(ip, 631, path),
      {
        method: "POST",
        headers: {
          Accept: "application/ipp",
          "Content-Type": "application/ipp",
          "User-Agent": "PrintPilot-LAN/1.0",
        },
        body: buildIppRequest(operation, ippPrinterUri(ip, 631, path), options, document) as any,
      },
      ms,
    );
    const parsed = parseIppResponse(new Uint8Array(await response.arrayBuffer()));
    return parsed ? { ok: parsed.ok, statusCode: parsed.statusCode } : null;
  } catch (error) {
    return error instanceof Error && error.name === "AbortError" ? { ok: false, statusCode: -1, timedOut: true } : null;
  }
}

/** Returns the IPP path the printer answers on, or null. */
export async function probeIpp(ip: string, ms = 1200, paths: string[] = IPP_PATHS): Promise<string | null> {
  for (const path of paths) {
    const result = await ippCall(ip, path, IPP_OPERATION.getPrinterAttributes, {}, undefined, ms);
    if (result?.ok) return path;
  }
  return null;
}

export async function probeEscl(ip: string, ms = 1200): Promise<boolean> {
  for (const base of esclBaseUrls(ip)) {
    try {
      const response = await fetchWithTimeout(
        `${base}/ScannerCapabilities`,
        { headers: { Accept: "application/xml, text/xml, */*", "User-Agent": "PrintPilot-LAN/1.0" } },
        ms,
      );
      if (response.ok) return true;
    } catch {
      // Try the other local endpoint.
    }
  }
  return false;
}

/** Sends a document straight to the printer. Resolves true when the printer accepted the job. */
export async function sendIppPrintJob(
  ip: string,
  document: Uint8Array,
  options: IppJobOptions,
  knownPath?: string | null,
): Promise<boolean | "unconfirmed"> {
  const paths = knownPath ? [knownPath, ...IPP_PATHS.filter((path) => path !== knownPath)] : IPP_PATHS;
  for (const path of paths) {
    const result = await ippCall(ip, path, IPP_OPERATION.printJob, options, document, 90000);
    if (result?.ok) return true;
    // The printer took the data but never answered: it may well print, so do not retry or hand over to another path.
    if (result?.timedOut) return "unconfirmed";
  }
  return false;
}

export type FoundDevice = { ip: string; ipp: string | null; escl: boolean };

/** Probes every address of the phone's /24 network for a printer or scanner. */
export async function discoverDevices(
  localIp: string,
  onProgress?: (done: number, total: number) => void,
): Promise<FoundDevice[]> {
  const parts = localIp.split(".");
  if (parts.length !== 4) return [];
  const prefix = parts.slice(0, 3).join(".");
  const hosts = Array.from({ length: 254 }, (_, i) => `${prefix}.${i + 1}`).filter((host) => host !== localIp);
  const found: FoundDevice[] = [];
  let done = 0;
  const batchSize = 64;
  for (let start = 0; start < hosts.length; start += batchSize) {
    const batch = hosts.slice(start, start + batchSize);
    await Promise.all(
      batch.map(async (ip) => {
        const [escl, ipp] = await Promise.all([probeEscl(ip, 2500), probeIpp(ip, 2500, [IPP_PATHS[0]])]);
        if (escl || ipp) found.push({ ip, ipp, escl });
        done += 1;
      }),
    );
    onProgress?.(done, hosts.length);
  }
  return found;
}

/** Scans through eSCL and returns each scanned page/document as bytes. */
export async function runEsclScan(ip: string, settings: EsclSettings): Promise<Uint8Array[]> {
  let base: string | null = null;
  let create: Response | null = null;
  let lastStatus = "unreachable";
  for (const candidate of esclBaseUrls(ip)) {
    try {
      const response = await fetchWithTimeout(
        `${candidate}/ScanJobs`,
        {
          method: "POST",
          headers: {
            Accept: "application/xml, text/xml, */*",
            "Content-Type": "text/xml; charset=utf-8",
            "User-Agent": "PrintPilot-LAN/1.0",
          },
          body: buildEsclScanSettings(settings),
        },
        15000,
      );
      lastStatus = String(response.status);
      if (response.status === 201) {
        base = candidate;
        create = response;
        break;
      }
    } catch {
      // Try the other local endpoint.
    }
  }
  if (!base || !create) throw new Error(`scan-job-${lastStatus}`);
  const job = resolveEsclJobUrl(create.headers.get("Location"), ip, base);
  if (!job) throw new Error("scan-job-location");
  const documents: Uint8Array[] = [];
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const response = await fetchWithTimeout(
      `${job}/NextDocument`,
      { headers: { Accept: "image/jpeg, image/png, application/pdf, */*", "User-Agent": "PrintPilot-LAN/1.0" } },
      60000,
    );
    if (response.status === 200) {
      documents.push(new Uint8Array(await response.arrayBuffer()));
      if (settings.source !== "adf") break;
      continue;
    }
    if (response.status === 503) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }
    break;
  }
  if (!documents.length) throw new Error("scan-empty");
  return documents;
}

/** Probes the usual printer ports and reports, in plain lines, what each one answered. */
export async function diagnoseDevice(ip: string): Promise<string[]> {
  const describe = async (label: string, run: () => Promise<string>) => {
    try {
      return `${label}: ${await run()}`;
    } catch (error) {
      const name = error instanceof Error ? error.name : "error";
      return `${label}: ${name === "AbortError" ? "no answer" : "refused/blocked"}`;
    }
  };
  const ippPort = (port: number) =>
    describe(`IPP ${port}`, async () => {
      const response = await fetchWithTimeout(
        ippHttpUrl(ip, port, "/ipp/print"),
        {
          method: "POST",
          headers: { "Content-Type": "application/ipp" },
          body: buildIppRequest(IPP_OPERATION.getPrinterAttributes, ippPrinterUri(ip, port, "/ipp/print"), {}, undefined) as any,
        },
        2500,
      );
      const parsed = parseIppResponse(new Uint8Array(await response.arrayBuffer()));
      return `HTTP ${response.status}${parsed ? `, IPP 0x${parsed.statusCode.toString(16)}` : ""}`;
    });
  const ippTls = describe("IPP TLS 443", async () => {
    const response = await fetchWithTimeout(
      `https://${ip}/ipp/print`,
      {
        method: "POST",
        headers: { Accept: "application/ipp", "Content-Type": "application/ipp" },
        body: buildIppRequest(IPP_OPERATION.getPrinterAttributes, ippPrinterUri(ip, 443, "/ipp/print"), {}, undefined) as any,
      },
      3500,
    );
    const parsed = parseIppResponse(new Uint8Array(await response.arrayBuffer()));
    return `HTTP ${response.status}${parsed ? `, IPP 0x${parsed.statusCode.toString(16)}` : ""}`;
  });
  const esclPort = (port: number, scheme: "http" | "https" = "http") =>
    describe(`eSCL ${port}`, async () => {
      const host = `${scheme}://${ip}${port === 80 ? "" : `:${port}`}/eSCL`;
      const response = await fetchWithTimeout(
        `${host}/ScannerCapabilities`,
        { headers: { Accept: "application/xml, text/xml, */*", "User-Agent": "PrintPilot-LAN/1.0" } },
        2500,
      );
      return `HTTP ${response.status}`;
    });
  return Promise.all([
    describe("RAW 9100", async () => {
      const { probeRawPort } = await import("./raw-print");
      return `TCP ${await probeRawPort(ip)}`;
    }),
    ippPort(631),
    ippTls,
    ippPort(80),
    ippPort(8000),
    ippPort(8080),
    esclPort(80),
    esclPort(443, "https"),
    esclPort(8080),
    esclPort(9095),
    describe("eSCL status", async () => {
      const response = await fetchWithTimeout(`${esclBaseUrl(ip)}/ScannerStatus`, {}, 2500);
      const body = (await response.text()).replace(/\s+/g, " ");
      const state = /<pwg:State>([^<]+)</.exec(body)?.[1];
      return `HTTP ${response.status}${state ? `, ${state}` : ""}`;
    }),
    describe("eSCL caps", async () => {
      const response = await fetchWithTimeout(`${esclBaseUrl(ip)}/ScannerCapabilities`, {}, 2500);
      const body = (await response.text()).replace(/\s+/g, " ");
      const make = /<pwg:MakeAndModel>([^<]+)</.exec(body)?.[1];
      const formats = Array.from(body.matchAll(/<pwg:DocumentFormat>([^<]+)</g)).map((m) => m[1]).slice(0, 4);
      return `HTTP ${response.status}${make ? `, ${make}` : ""}${formats.length ? `, ${formats.join("/")}` : ""}`;
    }),
    describe("Web 80 /wlmeng/index.htm", async () => `HTTP ${(await fetchWithTimeout(`http://${ip}/wlmeng/index.htm`, {}, 2500)).status}`),
  ]);
}
