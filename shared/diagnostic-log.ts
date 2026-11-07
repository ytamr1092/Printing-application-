/** Session + persistent log of print/scan attempts, included in the diagnostic report. */
const MAX_EVENTS = 40;
const STORAGE_KEY = "printpilot.diagnostic-events.v1";
const events: string[] = [];

let storageReady = false;

async function storage() {
  try {
    const module = await import("@react-native-async-storage/async-storage");
    return module.default;
  } catch {
    return null;
  }
}

/** Loads the last events from the device before a report is generated. */
export async function hydrateEvents(): Promise<void> {
  if (storageReady) return;
  storageReady = true;
  const store = await storage();
  if (!store) return;
  try {
    const saved = JSON.parse((await store.getItem(STORAGE_KEY)) ?? "[]");
    if (Array.isArray(saved)) {
      events.push(...saved.filter((item): item is string => typeof item === "string").slice(-MAX_EVENTS));
    }
  } catch {
    // A damaged local log must never block the application.
  }
}

function persistEvents(): void {
  void storage().then((store) => {
    if (!store) return;
    return store.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  }).catch(() => undefined);
}

export function logEvent(kind: string, message: string): void {
  const stamp = new Date().toISOString().slice(11, 19);
  events.push(`${stamp} [${kind}] ${message}`);
  if (events.length > MAX_EVENTS) events.shift();
  persistEvents();
}

export function getEvents(): string[] {
  return [...events];
}

export function clearEvents(): void {
  events.length = 0;
  void storage().then((store) => store?.removeItem(STORAGE_KEY)).catch(() => undefined);
}

export type ReportSection = { title: string; lines: string[] };

/** Plain-text report that the person can share with whoever is helping. */
export function buildDiagnosticReport(sections: ReportSection[], generatedAt = new Date()): string {
  const parts = [`PrintPilot diagnostic report`, `Generated: ${generatedAt.toISOString()}`, ""];
  for (const section of sections) {
    parts.push(`== ${section.title} ==`, ...(section.lines.length ? section.lines : ["(nothing recorded)"]), "");
  }
  return parts.join("\n");
}

/** Pulls human-readable facts out of a raw IPP Get-Printer-Attributes response. */
export function summarizeIppResponse(body: Uint8Array): string[] {
  const text = Array.from(body, (byte) => String.fromCharCode(byte)).join("");
  const lines: string[] = [];
  const valueAfter = (name: string) => {
    const at = text.indexOf(name);
    if (at < 0) return null;
    let i = at + name.length;
    const length = (body[i] << 8) | body[i + 1];
    i += 2;
    return length > 0 && length < 200 ? text.slice(i, i + length) : null;
  };
  const model = valueAfter("printer-make-and-model");
  if (model) lines.push(`Model: ${model}`);
  const formats = ["application/pdf", "image/jpeg", "image/urf", "image/pwg-raster", "application/postscript", "application/octet-stream", "application/vnd.hp-PCL"].filter(
    (mime) => text.includes(mime),
  );
  lines.push(`Document formats seen: ${formats.length ? formats.join(", ") : "none recognised"}`);
  return lines;
}
