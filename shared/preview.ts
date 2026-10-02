export const previewKinds = [
  "merge",
  "images",
  "extract",
  "numbering",
  "pages",
  "id",
  "print",
] as const;

export type PreviewKind = (typeof previewKinds)[number];

export function hasPreviewContent(
  kind: PreviewKind,
  selectedFiles: string[],
  frontUri: string | null,
  backUri: string | null,
): boolean {
  if (kind === "id") return Boolean(frontUri || backUri);
  return selectedFiles.length > 0;
}
