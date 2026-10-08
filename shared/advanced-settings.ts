export type PrintScale = "fit" | "actual" | "fill";
export type ScannerSource = "glass" | "adf";
export type ScannerFormat = "pdf" | "jpg" | "png";
export type IdSize = "fit" | "actual";
export type IdQuality = "standard" | "high";
export type ImageFit = "contain" | "fill";
export type ExtractFormat = "jpg" | "png";

export interface AdvancedSettings {
  printPages: string;
  printScale: PrintScale;
  printMargins: string;
  printCollate: boolean;
  scannerSource: ScannerSource;
  scannerDuplex: boolean;
  scannerFormat: ScannerFormat;
  scannerDeskew: boolean;
  scannerBlankPages: boolean;
  idSize: IdSize;
  idMargin: string;
  idQuality: IdQuality;
  idCopies: string;
  numberPosition: "left" | "center" | "right";
  numberVertical: "top" | "middle" | "bottom";
  numberMargin: string;
  numberFrom: string;
  numberTo: string;
  numberStart: string;
  numberWhich: "all" | "odd" | "even";
  numberFormat: string;
  numberNumerals: "latin" | "indic" | "roman-u" | "roman-l";
  numberSize: string;
  numberColor: string;
  numberFont: "helvetica" | "times" | "courier";
  numberBold: boolean;
  numberMirror: boolean;
  imageFit: ImageFit;
  extractFormat: ExtractFormat;
}

export const advancedSettingsStorageKey = "printpilot.advanced-settings.v1";

export const defaultAdvancedSettings: AdvancedSettings = {
  printPages: "",
  printScale: "fit",
  printMargins: "5",
  printCollate: true,
  scannerSource: "adf",
  scannerDuplex: false,
  scannerFormat: "pdf",
  scannerDeskew: true,
  scannerBlankPages: true,
  idSize: "actual",
  idMargin: "12",
  idQuality: "high",
  idCopies: "1",
  numberPosition: "center",
  numberVertical: "bottom",
  numberMargin: "10",
  numberFrom: "1",
  numberTo: "",
  numberStart: "1",
  numberWhich: "all",
  numberFormat: "{n} / {t}",
  numberNumerals: "latin",
  numberSize: "9",
  numberColor: "#526270",
  numberFont: "helvetica",
  numberBold: false,
  numberMirror: false,
  imageFit: "contain",
  extractFormat: "jpg",
};

const values = <T extends string>(
  allowed: readonly T[],
  value: unknown,
  fallback: T,
): T =>
  typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;

const text = (value: unknown, fallback: string) =>
  typeof value === "string" ? value : fallback;

export function normalizeAdvancedSettings(input: unknown): AdvancedSettings {
  const source =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  return {
    printPages: text(source.printPages, defaultAdvancedSettings.printPages),
    printScale: values(
      ["fit", "actual", "fill"] as const,
      source.printScale,
      defaultAdvancedSettings.printScale,
    ),
    printMargins: text(
      source.printMargins,
      defaultAdvancedSettings.printMargins,
    ),
    printCollate:
      typeof source.printCollate === "boolean"
        ? source.printCollate
        : defaultAdvancedSettings.printCollate,
    scannerSource: values(
      ["glass", "adf"] as const,
      source.scannerSource,
      defaultAdvancedSettings.scannerSource,
    ),
    scannerDuplex:
      typeof source.scannerDuplex === "boolean"
        ? source.scannerDuplex
        : defaultAdvancedSettings.scannerDuplex,
    scannerFormat: values(
      ["pdf", "jpg", "png"] as const,
      source.scannerFormat,
      defaultAdvancedSettings.scannerFormat,
    ),
    scannerDeskew:
      typeof source.scannerDeskew === "boolean"
        ? source.scannerDeskew
        : defaultAdvancedSettings.scannerDeskew,
    scannerBlankPages:
      typeof source.scannerBlankPages === "boolean"
        ? source.scannerBlankPages
        : defaultAdvancedSettings.scannerBlankPages,
    idSize: values(
      ["fit", "actual"] as const,
      source.idSize,
      defaultAdvancedSettings.idSize,
    ),
    idMargin: text(source.idMargin, defaultAdvancedSettings.idMargin),
    idQuality: values(
      ["standard", "high"] as const,
      source.idQuality,
      defaultAdvancedSettings.idQuality,
    ),
    idCopies: text(source.idCopies, defaultAdvancedSettings.idCopies),
    numberPosition: values(
      ["left", "center", "right"] as const,
      source.numberPosition,
      defaultAdvancedSettings.numberPosition,
    ),
    numberVertical: values(
      ["top", "middle", "bottom"] as const,
      source.numberVertical,
      defaultAdvancedSettings.numberVertical,
    ),
    numberMargin: text(
      source.numberMargin,
      defaultAdvancedSettings.numberMargin,
    ),
    numberFrom: text(source.numberFrom, defaultAdvancedSettings.numberFrom),
    numberTo: text(source.numberTo, defaultAdvancedSettings.numberTo),
    numberStart: text(source.numberStart, defaultAdvancedSettings.numberStart),
    numberWhich: values(
      ["all", "odd", "even"] as const,
      source.numberWhich,
      defaultAdvancedSettings.numberWhich,
    ),
    numberFormat: text(
      source.numberFormat,
      defaultAdvancedSettings.numberFormat,
    ),
    numberNumerals: values(
      ["latin", "indic", "roman-u", "roman-l"] as const,
      source.numberNumerals,
      defaultAdvancedSettings.numberNumerals,
    ),
    numberSize: text(source.numberSize, defaultAdvancedSettings.numberSize),
    numberColor: text(source.numberColor, defaultAdvancedSettings.numberColor),
    numberFont: values(
      ["helvetica", "times", "courier"] as const,
      source.numberFont,
      defaultAdvancedSettings.numberFont,
    ),
    numberBold:
      typeof source.numberBold === "boolean"
        ? source.numberBold
        : defaultAdvancedSettings.numberBold,
    numberMirror:
      typeof source.numberMirror === "boolean"
        ? source.numberMirror
        : defaultAdvancedSettings.numberMirror,
    imageFit: values(
      ["contain", "fill"] as const,
      source.imageFit,
      defaultAdvancedSettings.imageFit,
    ),
    extractFormat: values(
      ["jpg", "png"] as const,
      source.extractFormat,
      defaultAdvancedSettings.extractFormat,
    ),
  };
}
