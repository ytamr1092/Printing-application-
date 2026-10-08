export const CR80_CARD_WIDTH_MM = 85.6;
export const CR80_CARD_HEIGHT_MM = 53.98;
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

export type IdDuplexEdge = "long" | "short";

export type IdCardLayout = {
  copies: number;
  columns: number;
  rows: number;
  cardsPerPage: number;
  cardWidthMm: number;
  cardHeightMm: number;
  marginMm: number;
  backTransform: "scaleX(-1)" | "scaleY(-1)";
};

export function normalizeIdCopies(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Math.max(1, Math.min(100, Number.isFinite(parsed) ? Math.floor(parsed) : 1));
}

export function createIdCardLayout(
  copiesInput: string | number,
  marginInput: string | number,
  edge: IdDuplexEdge,
): IdCardLayout {
  const copies = normalizeIdCopies(copiesInput);
  const marginValue = typeof marginInput === "number" ? marginInput : Number(marginInput);
  const marginMm = Math.max(0, Math.min(20, Number.isFinite(marginValue) ? marginValue : 5));
  const usableWidth = A4_WIDTH_MM - marginMm * 2;
  const usableHeight = A4_HEIGHT_MM - marginMm * 2;
  const columns = Math.max(1, Math.floor(usableWidth / CR80_CARD_WIDTH_MM));
  const rows = Math.max(1, Math.floor(usableHeight / CR80_CARD_HEIGHT_MM));
  return {
    copies,
    columns,
    rows,
    cardsPerPage: columns * rows,
    cardWidthMm: CR80_CARD_WIDTH_MM,
    cardHeightMm: CR80_CARD_HEIGHT_MM,
    marginMm,
    backTransform: edge === "long" ? "scaleX(-1)" : "scaleY(-1)",
  };
}
