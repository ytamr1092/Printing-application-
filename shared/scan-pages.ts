export type ScanPage = {
  id: string;
  uri: string;
  /** 0 / 90 / 180 / 270 clockwise */
  rotation: number;
  /** flagged as blank by the page analysis */
  blank: boolean;
  /** counter-clockwise tilt of the text in degrees (0 = straight / unknown) */
  skew: number;
};

/** Pages that go into the output: blank ones are left out only when the person agreed. */
export function pagesForOutput(pages: ScanPage[], dropBlank: boolean): ScanPage[] {
  return dropBlank ? pages.filter((page) => !page.blank) : pages;
}

/**
 * Where to draw an image (W x H points) on a PDF page so that it ends up turned
 * `rotation` degrees clockwise plus `skew` degrees corrected (also clockwise),
 * centred on the page. `angle` is the counter-clockwise angle pdf-lib expects.
 */
export function scanPageGeometry(width: number, height: number, rotation: number, skew: number) {
  const turns = ((Math.round(rotation / 90) % 4) + 4) % 4;
  const sideways = turns % 2 === 1;
  const pageWidth = sideways ? height : width;
  const pageHeight = sideways ? width : height;
  const angle = -(turns * 90 + skew);
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Vector from the image's lower-left corner to its centre, after rotating.
  const cx = (width / 2) * cos - (height / 2) * sin;
  const cy = (width / 2) * sin + (height / 2) * cos;
  return { pageWidth, pageHeight, angle, x: pageWidth / 2 - cx, y: pageHeight / 2 - cy };
}
