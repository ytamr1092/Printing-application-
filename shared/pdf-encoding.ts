export type NumberFont = "helvetica" | "times" | "courier";

export function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob
    ? globalThis.atob(base64)
    : Buffer.from(base64, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1)
    binary += String.fromCharCode(bytes[index]);
  return globalThis.btoa
    ? globalThis.btoa(binary)
    : Buffer.from(binary, "binary").toString("base64");
}

export function getNumberFont(
  StandardFonts: Record<string, string>,
  font: NumberFont,
  bold: boolean,
): string {
  if (font === "times")
    return StandardFonts[bold ? "TimesRomanBold" : "TimesRoman"];
  if (font === "courier")
    return StandardFonts[bold ? "CourierBold" : "Courier"];
  return StandardFonts[bold ? "HelveticaBold" : "Helvetica"];
}
