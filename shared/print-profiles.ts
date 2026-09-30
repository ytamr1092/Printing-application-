export type PrintProfile = {
  id: string;
  ar: string;
  en: string;
  paperId: string;
  weight: string;
  orientation: "portrait" | "landscape";
  copies: string;
  colorMode: "color" | "bw";
  duplex: boolean;
};

export const printProfiles: PrintProfile[] = [
  { id: "certificate", ar: "شهادة رسمية", en: "Official Certificate", paperId: "certificate", weight: "200 g/m²", orientation: "portrait", copies: "1", colorMode: "color", duplex: false },
  { id: "a4-bw", ar: "A4 أبيض وأسود", en: "A4 Black & White", paperId: "a4", weight: "80 g/m²", orientation: "portrait", copies: "1", colorMode: "bw", duplex: false },
  { id: "photos-a4", ar: "صور A4 ملونة", en: "Color Photos A4", paperId: "a4", weight: "120 g/m²", orientation: "portrait", copies: "1", colorMode: "color", duplex: false },
  { id: "duplex", ar: "طباعة على الوجهين", en: "Duplex Printing", paperId: "a4", weight: "80 g/m²", orientation: "portrait", copies: "1", colorMode: "bw", duplex: true },
  { id: "id-card", ar: "بطاقة هوية وجهين", en: "Two-sided ID Card", paperId: "a4", weight: "200 g/m²", orientation: "portrait", copies: "1", colorMode: "color", duplex: false },
];

export const printProfileById = (id: string) => printProfiles.find((profile) => profile.id === id) ?? printProfiles[0];
