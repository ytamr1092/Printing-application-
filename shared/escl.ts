/** eSCL ("AirScan"/Mopria scan): scanning over plain HTTP + XML. */
export type EsclSettings = {
  dpi: number;
  color: "color" | "bw";
  source: "glass" | "adf";
  duplex: boolean;
  format: "pdf" | "jpg" | "png";
};

export const ESCL_MIME: Record<EsclSettings["format"], string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
};

export function esclBaseUrl(ip: string, port = 80, root = "eSCL"): string {
  return `http://${ip}${port === 80 ? "" : `:${port}`}/${root}`;
}

export function buildEsclScanSettings(settings: EsclSettings): string {
  const dpi = [75, 100, 150, 200, 300, 400, 600].includes(settings.dpi) ? settings.dpi : 300;
  const input = settings.source === "adf" ? "Feeder" : "Platen";
  const mode = settings.color === "bw" ? "Grayscale8" : "RGB24";
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<scan:ScanSettings xmlns:scan="http://schemas.hp.com/imaging/escl/2011/05/03" xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm">` +
    `<pwg:Version>2.0</pwg:Version>` +
    `<pwg:InputSource>${input}</pwg:InputSource>` +
    `<scan:ColorMode>${mode}</scan:ColorMode>` +
    `<scan:XResolution>${dpi}</scan:XResolution>` +
    `<scan:YResolution>${dpi}</scan:YResolution>` +
    `<scan:DocumentFormat>${ESCL_MIME[settings.format]}</scan:DocumentFormat>` +
    (settings.source === "adf" && settings.duplex ? `<scan:Duplex>true</scan:Duplex>` : "") +
    `</scan:ScanSettings>`
  );
}

/** The job URL comes back in the Location header (absolute or relative). */
export function resolveEsclJobUrl(location: string | null | undefined, ip: string, base: string): string | null {
  if (!location) return null;
  const trimmed = location.trim().replace(/\/$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return `http://${ip}${trimmed}`;
  return `${base}/ScanJobs/${trimmed}`;
}
