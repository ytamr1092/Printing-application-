const ILLEGAL = /[\\/:*?"<>|\u0000-\u001f]/g;
const KNOWN_EXTENSION = /\.(pdf|jpe?g|png|webp)$/i;

/** A name safe to use for a saved file; empty input gives the fallback. */
export function sanitizeFileName(input: string, fallback = ""): string {
  const cleaned = input
    .replace(ILLEGAL, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(KNOWN_EXTENSION, "")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 80)
    .trim();
  return cleaned || fallback;
}

/** "file:///a/b/Report.pdf" -> "Report" */
export function fileBaseName(uri: string): string {
  const last = decodeSafe(uri.split("?")[0].split("/").pop() ?? "");
  return last.replace(/\.[^./]+$/, "");
}

/** "file:///a/b/Report.pdf" -> ".pdf" (empty when there is none) */
export function fileExtension(uri: string): string {
  const match = /\.[A-Za-z0-9]{1,5}$/.exec(uri.split("?")[0]);
  return match ? match[0].toLowerCase() : "";
}

/** One file keeps the chosen name; several get -01, -02 ... */
export function numberedFileName(base: string, index: number, total: number): string {
  return total > 1 ? `${base}-${String(index + 1).padStart(2, "0")}` : base;
}

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
