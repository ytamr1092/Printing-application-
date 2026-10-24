import PdfThumbnail from "react-native-pdf-thumbnail";

import type { PdfPageThumbnailResult, PdfThumbnailOptions } from "./pdf-thumbnail";

export async function generatePdfPageThumbnail(
  uri: string,
  pageIndex: number,
  options?: PdfThumbnailOptions,
): Promise<PdfPageThumbnailResult | null> {
  const thumbnail = await PdfThumbnail.generate(uri, pageIndex, {
    quality: options?.quality ?? 75,
    maxWidth: options?.maxWidth ?? 240,
    maxHeight: options?.maxHeight ?? 320,
  });
  return {
    uri: thumbnail.uri,
    width: thumbnail.width,
    height: thumbnail.height,
  };
}
