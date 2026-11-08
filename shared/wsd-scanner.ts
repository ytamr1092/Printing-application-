import type { EsclSettings } from "./escl";

export const WSD_SCAN_ELEMENT_NAMESPACE = "http://schemas.microsoft.com/windows/2006/08/wdp/scan";
export const WSD_SCAN_ACTION_BASE = "http://schemas.microsoft.com/windows/2006/08/wdp/scan";
export type WsdScanOperation = "CreateScanJob" | "GetJobElements" | "RetrieveImage" | "CancelJob";
export type WsdServiceType = { namespace: string; localName: string };

export function hasWsdScanService(serviceTypes?: WsdServiceType[] | null): boolean {
  return serviceTypes?.some((type) =>
    type.namespace === WSD_SCAN_ELEMENT_NAMESPACE && type.localName === "ScanDeviceType",
  ) ?? false;
}

export function wsdScanActionUri(operation: WsdScanOperation): string {
  return `${WSD_SCAN_ACTION_BASE}/${operation}`;
}

export type WsdScannerDevice = {
  serviceUrl: string;
  name?: string;
  model?: string;
  address: string;
  /** QName values from the matching WS-Discovery ProbeMatch, with prefixes resolved to namespaces. */
  serviceTypes?: WsdServiceType[];
};

export type DiscoveredWsdScanner = WsdScannerDevice & {
  supportsScan: true;
  /** True only when the local IPP probe receives a valid IPP response. */
  supportsPrint: boolean;
};

export type WsdScanPageFile = {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
};

export type WsdScannerBridge = {
  discover(): Promise<WsdScannerDevice[]>;
  scan(
    serviceUrl: string,
    inputSource: "ADF" | "Platen",
    dpi: number,
    color: "color" | "bw",
    duplex: boolean,
    outputFormat: "jpg" | "png",
  ): Promise<{ pages: WsdScanPageFile[] }>;
};

/** Runs WS-Scan only through the exact scanner selected by the user. */
export async function runWsdScan(
  bridge: WsdScannerBridge,
  scanner: WsdScannerDevice,
  settings: EsclSettings,
  readLocalPage: (uri: string) => Promise<Uint8Array>,
): Promise<Uint8Array[]> {
  if (!scanner?.serviceUrl || !scanner.address) {
    throw new Error("Choose a discovered WSD scanner before starting the scan.");
  }

  const result = await bridge.scan(
    scanner.serviceUrl,
    settings.source === "adf" ? "ADF" : "Platen",
    settings.dpi,
    settings.color,
    settings.source === "adf" && settings.duplex,
    settings.format === "png" ? "png" : "jpg",
  );
  if (!Array.isArray(result.pages) || result.pages.length === 0) {
    throw new Error("The local WSD scan returned no pages.");
  }

  const pages: Uint8Array[] = [];
  for (const page of result.pages) {
    if (!page.uri.startsWith("file://")) {
      throw new Error("WSD scan returned a non-local file; the scan was stopped.");
    }
    const bytes = await readLocalPage(page.uri);
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
      throw new Error(`Could not read the local WSD scan page ${page.name}.`);
    }
    pages.push(bytes);
  }
  return pages;
}

export function wsdScannerSetupHint(): string {
  return "No WSD Scan service was discovered on the local network. Check that the phone and printer are on the same Wi-Fi/LAN and that the access point allows WS-Discovery multicast (UDP 3702) without client isolation. This scan path uses the local network only and does not require Internet access.";
}
