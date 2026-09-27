export type PaperOption = {
  id: string;
  ar: string;
  en: string;
  size: string;
  weight: string;
};

export const paperOptions: PaperOption[] = [
  { id: "a4", ar: "A4 — قياسي", en: "A4 — Standard", size: "210 × 297 mm", weight: "80 g/m²" },
  { id: "a3", ar: "A3 — كبير", en: "A3 — Large", size: "297 × 420 mm", weight: "100 g/m²" },
  { id: "letter", ar: "Letter — أمريكي", en: "Letter — US", size: "216 × 279 mm", weight: "90 g/m²" },
  { id: "certificate", ar: "شهادة — A4 سميك", en: "Certificate — A4", size: "210 × 297 mm", weight: "200 g/m²" },
];

export const supportedPaperWeights = ["80 g/m²", "120 g/m²", "200 g/m²"] as const;

export const paperPresetById = (id: string) => paperOptions.find((paper) => paper.id === id) ?? paperOptions[0];
