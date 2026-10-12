import PdfThumbnail from "react-native-pdf-thumbnail";

import type { PdfPageThumbnailResult } from "./pdf-thumbnail";

export async function generatePdfPageThumbnail(
  uri: string,
  pageIndex: number,
): Promise<PdfPageThumbnailResult | null> {
  const thumbnail = await PdfThumbnail.generate(uri, pageIndex, {
    quality: 75,
    maxWidth: 240,
    maxHeight: 320,
  });
  return {
    uri: thumbnail.uri,
    width: thumbnail.width,
    height: thumbnail.height,
  };
}
