export function hasBothIdFaces(frontUri: string | null, backUri: string | null): boolean {
  return Boolean(frontUri && backUri);
}

export function isValidIpv4(value: string): boolean {
  const parts = value.trim().split(".");
  return parts.length === 4 && parts.every((part) => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}
