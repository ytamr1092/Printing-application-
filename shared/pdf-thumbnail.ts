export type PdfPageThumbnailResult = {
  uri: string;
  width: number;
  height: number;
};

/** Web has no native PDF rasterizer in this app; the UI offers an external-open fallback. */
export async function generatePdfPageThumbnail(
  _uri: string,
  _pageIndex: number,
): Promise<PdfPageThumbnailResult | null> {
  return null;
}
