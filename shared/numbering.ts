export type NumberWhich = "all" | "odd" | "even";
export type NumberNumerals = "latin" | "indic" | "roman-l" | "roman-u";

function toRoman(value: number, upper = false): string {
  const table: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let result = "";
  let remaining = Math.max(1, Math.floor(value));
  for (const [unit, glyph] of table) {
    while (remaining >= unit) {
      result += glyph;
      remaining -= unit;
    }
  }
  return upper ? result : result.toLowerCase();
}

export function formatNumberValue(value: number, numerals: NumberNumerals): string {
  if (numerals === "roman-l") return toRoman(value);
  if (numerals === "roman-u") return toRoman(value, true);
  const text = String(value);
  return numerals === "indic" ? text.replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]) : text;
}

export function getNumberingPages(totalPages: number, from: number, to: number, which: NumberWhich): number[] {
  const start = Math.max(1, Math.floor(from) || 1);
  const end = Math.min(totalPages, Math.max(start, Math.floor(to) || totalPages));
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index)
    .filter((page) => which === "all" || (which === "odd" ? page % 2 === 1 : page % 2 === 0));
}
