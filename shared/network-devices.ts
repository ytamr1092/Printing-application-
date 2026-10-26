import {
  buildIppRequest,
  IPP_OPERATION,
  ippHttpUrl,
  ippPrinterUri,
  parseIppResponse,
  type IppJobOptions,
} from "./ipp";
import { buildEsclScanSettings, esclBaseUrl, resolveEsclJobUrl, type EsclSettings } from "./escl";

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
): Promise<{ ok: boolean; statusCode: number } | null> {
  try {
    const response = await fetchWithTimeout(
      ippHttpUrl(ip, 631, path),
      {
        method: "POST",
        headers: { "Content-Type": "application/ipp" },
        body: buildIppRequest(operation, ippPrinterUri(ip, 631, path), options, document) as any,
      },
      ms,
    );
    const parsed = parseIppResponse(new Uint8Array(await response.arrayBuffer()));
    return parsed ? { ok: parsed.ok, statusCode: parsed.statusCode } : null;
  } catch {
    return null;
  }
}

/** Returns the IPP path the printer answers on, or null. */
export async function probeIpp(ip: string, ms = 1200): Promise<string | null> {
  for (const path of IPP_PATHS) {
    const result = await ippCall(ip, path, IPP_OPERATION.getPrinterAttributes, {}, undefined, ms);
    if (result?.ok) return path;
  }
  return null;
}

export async function probeEscl(ip: string, ms = 1200): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${esclBaseUrl(ip)}/ScannerCapabilities`, {}, ms);
    return response.ok;
  } catch {
    return false;
  }
}

/** Sends a document straight to the printer. Resolves true when the printer accepted the job. */
export async function sendIppPrintJob(
  ip: string,
  document: Uint8Array,
  options: IppJobOptions,
  knownPath?: string | null,
): Promise<boolean> {
  const paths = knownPath ? [knownPath, ...IPP_PATHS.filter((path) => path !== knownPath)] : IPP_PATHS;
  for (const path of paths) {
    const result = await ippCall(ip, path, IPP_OPERATION.printJob, options, document, 30000);
    if (result?.ok) return true;
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
  const batchSize = 32;
  for (let start = 0; start < hosts.length; start += batchSize) {
    const batch = hosts.slice(start, start + batchSize);
    await Promise.all(
      batch.map(async (ip) => {
        const [escl, ipp] = await Promise.all([probeEscl(ip, 900), probeIpp(ip, 900)]);
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
  const base = esclBaseUrl(ip);
  const create = await fetchWithTimeout(
    `${base}/ScanJobs`,
    { method: "POST", headers: { "Content-Type": "text/xml" }, body: buildEsclScanSettings(settings) },
    15000,
  );
  if (create.status !== 201) throw new Error(`scan-job-${create.status}`);
  const job = resolveEsclJobUrl(create.headers.get("Location"), ip, base);
  if (!job) throw new Error("scan-job-location");
  const documents: Uint8Array[] = [];
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const response = await fetchWithTimeout(`${job}/NextDocument`, {}, 60000);
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
