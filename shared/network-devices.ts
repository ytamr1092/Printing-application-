import {
  buildIppRequest,
  IPP_OPERATION,
  ippHttpUrl,
  ippPrinterUri,
  parseIppPrinterAttributes,
  parseIppResponse,
  type IppJobOptions,
} from "./ipp";
import { esclBaseUrl, esclBaseUrls, type EsclSettings } from "./escl";
import { logEvent } from "./diagnostic-log";
import { base64ToBytes } from "./pdf-encoding";
import { hasWsdScanService, runWsdScan, type WsdScannerBridge, type WsdScannerDevice } from "./wsd-scanner";

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
async function sendIppPrintJob(
  ip: string,
  document: Uint8Array,
  options: IppJobOptions,
  knownPath?: string | null,
): Promise<boolean | "unconfirmed"> {
  const paths = knownPath ? [knownPath, ...IPP_PATHS.filter((path) => path !== knownPath)] : IPP_PATHS;
  for (const path of paths) {
    logEvent("print", `IPP attempt: ${ippHttpUrl(ip, 631, path)}`);
    const result = await ippCall(ip, path, IPP_OPERATION.printJob, options, document, 90000);
    if (result?.ok) {
      logEvent("print", `IPP accepted: ${ippHttpUrl(ip, 631, path)} status=0x${result.statusCode.toString(16)}`);
      return true;
    }
    // The printer took the data but never answered: it may well print, so do not retry or hand over to another path.
    if (result?.timedOut) {
      logEvent("print", `IPP unconfirmed/timeout: ${ippHttpUrl(ip, 631, path)}`);
      return "unconfirmed";
    }
    logEvent("print", `IPP rejected/no IPP response: ${ippHttpUrl(ip, 631, path)} status=${result?.statusCode ?? "none"}`);
  }
  return false;
}

export type IppPrintAttempt =
  | { status: "accepted" }
  | { status: "unconfirmed" }
  | { status: "failed" }
  | { status: "unconfirmed-capability" }
  | { status: "unsupported-operation" }
  | { status: "unsupported-format" };

/** Sends only when Print-Job and the requested app format are both advertised by the exact selected device. */
export async function sendIppPrintJobToDevice(
  device: Pick<NetworkPrinterDevice, "address" | "ippPath" | "supportedOperations" | "supportedFormats" | "supportsPrint">,
  document: Uint8Array,
  options: IppJobOptions,
): Promise<IppPrintAttempt> {
  const mimeType = options.mimeType?.toLowerCase();
  if (!mimeType || !APP_PRINT_FORMATS.includes(mimeType)) return { status: "unsupported-format" };
  if (!device.supportedOperations) return { status: "unconfirmed-capability" };
  if (!device.supportedOperations.includes(IPP_OPERATION.printJob)) return { status: "unsupported-operation" };
  if (device.supportsPrint === false) return { status: "unsupported-format" };
  if (device.supportsPrint !== true || !device.supportedFormats) return { status: "unconfirmed-capability" };
  if (!device.supportedFormats.includes(mimeType)) return { status: "unsupported-format" };
  const result = await sendIppPrintJob(device.address, document, options, device.ippPath);
  if (result === "unconfirmed") return { status: "unconfirmed" };
  return result ? { status: "accepted" } : { status: "failed" };
}

/** A chosen destination must never be replaced by Android's print dialog without user confirmation. */
export function requiresDestinationChangeConfirmation(attempt: IppPrintAttempt): boolean {
  return attempt.status === "unsupported-format" || attempt.status === "unsupported-operation" || attempt.status === "unconfirmed-capability" || attempt.status === "failed";
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

export function isPrivateIpv4Literal(value: string): boolean {
  const parts = value.trim().split(".").map(Number);
  if (parts.length !== 4 || parts.some((part, index) => !Number.isInteger(part) || part < 0 || part > 255 || String(part) !== value.trim().split(".")[index])) return false;
  return parts[0] === 10 || parts[0] === 192 && parts[1] === 168 || parts[0] === 169 && parts[1] === 254 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
}

export type IppPrinterDevice = {
  address: string;
  name?: string;
  model?: string;
  ippPath: string;
  supportedOperations: number[] | null;
  supportedFormats: string[] | null;
  supportsPrint: boolean | null;
};

export type NetworkPrinterDevice = {
  address: string;
  name?: string;
  model?: string;
  serviceUrl?: string;
  ippPath?: string;
  supportedOperations: number[] | null;
  supportedFormats: string[] | null;
  /** True only when the WSD ScanDeviceType service is discovered; null means not verified. */
  supportsScan: true | null;
  /** True only when both Print-Job support and a compatible document format were advertised. */
  supportsPrint: boolean | null;
};

export type NetworkDiscoveryResult = {
  devices: NetworkPrinterDevice[];
  wsdError?: string;
};

export function runSingleFlight<T>(
  slot: { current: Promise<T> | null },
  operation: () => Promise<T>,
): Promise<T> {
  if (slot.current) return slot.current;
  const pending = Promise.resolve().then(operation);
  slot.current = pending;
  const clear = () => {
    if (slot.current === pending) slot.current = null;
  };
  void pending.then(clear, clear);
  return pending;
}

/** Keeps only an already explicit selection; candidates never imply a default choice. */
export function retainExplicitSelection<T>(
  selected: T | null,
  candidates: T[],
  isSame: (candidate: T, selected: T) => boolean,
): T | null {
  return selected ? candidates.find((candidate) => isSame(candidate, selected)) ?? null : null;
}

export function devicesForTask(
  devices: NetworkPrinterDevice[],
  task: "print" | "scan",
): NetworkPrinterDevice[] {
  return devices.filter((device) => task === "print"
    ? device.supportsPrint === true
    : device.supportsScan === true && Boolean(device.serviceUrl));
}

const APP_PRINT_FORMATS = ["application/pdf", "image/jpeg"];

/** Reads identity, supported formats, and operations from a successful local IPP Get-Printer-Attributes response. */
export async function readIppPrinterDevice(ip: string, ms = 900): Promise<IppPrinterDevice | null> {
  if (!isPrivateIpv4Literal(ip)) return null;
  for (const path of IPP_PATHS) {
    try {
      const response = await fetchWithTimeout(
        ippHttpUrl(ip, 631, path),
        {
          method: "POST",
          headers: { Accept: "application/ipp", "Content-Type": "application/ipp", "User-Agent": "PrintPilot-LAN/1.0" },
          body: buildIppRequest(IPP_OPERATION.getPrinterAttributes, ippPrinterUri(ip, 631, path), {}, undefined) as any,
        },
        ms,
      );
      const parsed = parseIppPrinterAttributes(new Uint8Array(await response.arrayBuffer()));
      if (!response.ok || !parsed?.ok) continue;
      const formats = parsed.attributes["document-format-supported"]?.map((value) => value.trim().toLowerCase()).filter(Boolean) ?? null;
      const operations = parsed.attributes["operations-supported"]?.map(Number).filter(Number.isInteger) ?? null;
      const supportsPrint = operations !== null && formats !== null
        ? operations.includes(IPP_OPERATION.printJob) && formats.some((format) => APP_PRINT_FORMATS.includes(format))
        : null;
      return {
        address: ip,
        name: parsed.attributes["printer-name"]?.find(Boolean),
        model: parsed.attributes["printer-make-and-model"]?.find(Boolean),
        ippPath: path,
        supportedOperations: operations,
        supportedFormats: formats,
        supportsPrint,
      };
    } catch {
      // Try the next standard IPP endpoint, always on the local private address.
    }
  }
  return null;
}

/** Finds IPP printers in the phone's private IPv4 /24 only; no eSCL or Internet requests are made. */
export async function discoverIppPrinters(
  localIp: string,
  onProgress?: (done: number, total: number) => void,
): Promise<IppPrinterDevice[]> {
  if (!isPrivateIpv4Literal(localIp)) return [];
  const parts = localIp.split(".");
  const prefix = parts.slice(0, 3).join(".");
  const hosts = Array.from({ length: 254 }, (_, index) => `${prefix}.${index + 1}`).filter((host) => host !== localIp);
  const found: IppPrinterDevice[] = [];
  let done = 0;
  const batchSize = 64;
  for (let start = 0; start < hosts.length; start += batchSize) {
    const batch = hosts.slice(start, start + batchSize);
    const results = await Promise.all(batch.map((ip) => readIppPrinterDevice(ip, 700)));
    found.push(...results.filter((device): device is IppPrinterDevice => Boolean(device)));
    done += batch.length;
    onProgress?.(done, hosts.length);
  }
  return found.sort((left, right) => left.address.localeCompare(right.address, undefined, { numeric: true }));
}

/** Combines WSD scan services and IPP printers found on the current private LAN. */
export async function discoverNetworkDevices(localIp: string): Promise<NetworkDiscoveryResult> {
  const { NativeModules, Platform } = await import("react-native");
  if (Platform.OS !== "android") {
    throw new Error("Local WSD/IPP discovery requires the Android app and local Wi-Fi/LAN.");
  }
  const bridge = NativeModules.PrintPilotWsdScanner as WsdScannerBridge | undefined;
  let wsdDevices: WsdScannerDevice[] = [];
  let wsdError: string | undefined;
  if (bridge?.discover) {
    try {
      wsdDevices = await bridge.discover();
    } catch (error) {
      wsdError = error instanceof Error ? error.message : "WSD scanner discovery failed.";
    }
  } else {
    wsdError = "The Android WSD scanner module is missing from this installed app version.";
  }
  const ippDevices = await discoverIppPrinters(localIp);
  const devices = new Map<string, NetworkPrinterDevice>();
  for (const device of wsdDevices) {
    if (!hasWsdScanService(device.serviceTypes)) continue;
    const address = device.address.trim();
    if (!address) continue;
    devices.set(address.toLowerCase(), {
      address,
      name: device.name?.trim() || undefined,
      model: device.model?.trim() || undefined,
      serviceUrl: device.serviceUrl,
      supportedOperations: null,
      supportedFormats: null,
      supportsScan: true,
      supportsPrint: null,
    });
  }
  for (const ipp of ippDevices) {
    const key = ipp.address.toLowerCase();
    const existing = devices.get(key);
    const candidateName = existing?.name && !existing.name.startsWith("WSD scanner (") ? existing.name : ipp.name;
    devices.set(key, {
      address: ipp.address,
      name: candidateName || existing?.name,
      model: ipp.model || existing?.model,
      serviceUrl: existing?.serviceUrl,
      ippPath: ipp.ippPath,
      supportedOperations: ipp.supportedOperations,
      supportedFormats: ipp.supportedFormats,
      supportsScan: existing?.supportsScan ?? null,
      supportsPrint: ipp.supportsPrint,
    });
  }
  return {
    devices: Array.from(devices.values()).sort((left, right) => left.address.localeCompare(right.address, undefined, { numeric: true })),
    ...(wsdError ? { wsdError } : {}),
  };
}

/** Runs a local WSD/WS-Scan job on the exact discovered scanner selected by the user; no eSCL fallback. */
export async function runWsdNetworkScan(scanner: WsdScannerDevice, settings: EsclSettings): Promise<Uint8Array[]> {
  const { NativeModules, Platform } = await import("react-native");
  if (Platform.OS !== "android") {
    throw new Error("Local WSD scanning requires the Android app. Next: run this scan from the Android app on the printer's local Wi-Fi.");
  }
  const bridge = NativeModules.PrintPilotWsdScanner as WsdScannerBridge | undefined;
  if (!bridge?.discover || !bridge.scan) {
    throw new Error("The Android WSD scanner module is missing from this installed app version. Next: install an Android build that includes the WSD scanner module.");
  }
  if (!scanner?.serviceUrl || !scanner.address) {
    throw new Error("Choose a discovered WSD scanner before starting the scan.");
  }
  const FileSystem = await import("expo-file-system/legacy");
  logEvent("scan", `WSD-only start for ${scanner.name} (${scanner.address}): ${settings.source}, ${settings.dpi}dpi, ${settings.format}`);
  try {
    const documents = await runWsdScan(bridge, scanner, settings, async (uri) => {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64ToBytes(base64);
    });
    logEvent("scan", `WSD-only completed: ${documents.length} page(s) from ${scanner.address}`);
    return documents;
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    const message = `WSD scan failed for ${scanner.address}: ${cause}\nNext: confirm the phone and printer are on the same local Wi-Fi without client isolation, WSD Scan is enabled, paper is loaded, and the scanner is idle; check the printer panel for an error, then retry. No eSCL fallback was attempted.`;
    logEvent("scan", message);
    throw new Error(message);
  }
}

/** Probes the usual printer ports and reports, in plain lines, what each one answered. */
export async function diagnoseDevice(ip: string): Promise<string[]> {
  // Printers have tiny web servers: probing everything at once makes them drop
  // requests and report false timeouts, so the probes run one after another.
  let queue: Promise<unknown> = Promise.resolve();
  const describe = (label: string, run: () => Promise<string>): Promise<string> => {
    const result = queue.then(() => describeNow(label, run));
    queue = result.then(() => new Promise((resolve) => setTimeout(resolve, 150)));
    return result;
  };
  const describeNow = async (label: string, run: () => Promise<string>) => {
    const started = Date.now();
    try {
      return `${label}: ${await run()} (${Date.now() - started}ms)`;
    } catch (error) {
      const name = error instanceof Error ? error.name : "error";
      const message = error instanceof Error && error.message ? ` — ${error.message.slice(0, 120)}` : "";
      return `${label}: ${name === "AbortError" ? "timeout/no answer" : `failed (${name})`}${message} (${Date.now() - started}ms)`;
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
        6000,
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
      6000,
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
    describe("LPD 515", async () => {
      const { probeLpd } = await import("./raw-print");
      return `LPD ${await probeLpd(ip)}`;
    }),
    describe("IPP printer info", async () => {
      const response = await fetchWithTimeout(
        ippHttpUrl(ip, 631, "/ipp/print"),
        {
          method: "POST",
          headers: { "Content-Type": "application/ipp" },
          body: buildIppRequest(IPP_OPERATION.getPrinterAttributes, ippPrinterUri(ip, 631, "/ipp/print"), {}, undefined) as any,
        },
        6000,
      );
      const { summarizeIppResponse } = await import("./diagnostic-log");
      return summarizeIppResponse(new Uint8Array(await response.arrayBuffer())).join("; ");
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
