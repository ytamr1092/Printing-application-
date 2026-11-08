/**
 * Minimal IPP 1.1 client pieces (RFC 8010). IPP travels over plain HTTP POST,
 * so the app can print straight to a network printer without a native socket.
 */
export const IPP_OPERATION = {
  printJob: 0x0002,
  getPrinterAttributes: 0x000b,
} as const;

export type IppJobOptions = {
  jobName?: string;
  mimeType?: string;
  copies?: number;
  /** "one-sided" | "two-sided-long-edge" | "two-sided-short-edge" */
  sides?: string;
  /** "color" | "monochrome" */
  colorMode?: string;
};

const TAG = {
  operation: 0x01,
  job: 0x02,
  end: 0x03,
  integer: 0x21,
  enum: 0x23,
  nameWithoutLanguage: 0x42,
  keyword: 0x44,
  uri: 0x45,
  charset: 0x47,
  naturalLanguage: 0x48,
  mimeMediaType: 0x49,
} as const;

const encoder = new TextEncoder();

function attribute(tag: number, name: string, value: string | number): number[] {
  const nameBytes = Array.from(encoder.encode(name));
  const valueBytes =
    typeof value === "number"
      ? [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]
      : Array.from(encoder.encode(value));
  return [
    tag,
    (nameBytes.length >> 8) & 255,
    nameBytes.length & 255,
    ...nameBytes,
    (valueBytes.length >> 8) & 255,
    valueBytes.length & 255,
    ...valueBytes,
  ];
}

function multiValueAttribute(tag: number, name: string, values: string[]): number[] {
  const nameBytes = Array.from(encoder.encode(name));
  const result: number[] = [];
  values.forEach((value, index) => {
    const valueBytes = Array.from(encoder.encode(value));
    result.push(
      tag,
      ...(index === 0 ? [(nameBytes.length >> 8) & 255, nameBytes.length & 255, ...nameBytes] : [0, 0]),
      (valueBytes.length >> 8) & 255,
      valueBytes.length & 255,
      ...valueBytes,
    );
  });
  return result;
}

export function ippPrinterUri(ip: string, port = 631, path = "/ipp/print"): string {
  return `ipp://${ip}:${port}${path}`;
}

export function ippHttpUrl(ip: string, port = 631, path = "/ipp/print"): string {
  return `http://${ip}:${port}${path}`;
}

/** Builds a request body; `document` (Print-Job) is appended after the attributes. */
export function buildIppRequest(
  operation: number,
  printerUri: string,
  options: IppJobOptions = {},
  document?: Uint8Array,
  requestId = 1,
): Uint8Array {
  const bytes: number[] = [
    0x01, 0x01,
    (operation >> 8) & 255, operation & 255,
    (requestId >>> 24) & 255, (requestId >>> 16) & 255, (requestId >>> 8) & 255, requestId & 255,
    TAG.operation,
    ...attribute(TAG.charset, "attributes-charset", "utf-8"),
    ...attribute(TAG.naturalLanguage, "attributes-natural-language", "en"),
    ...attribute(TAG.uri, "printer-uri", printerUri),
  ];
  if (operation === IPP_OPERATION.printJob) {
    bytes.push(...attribute(TAG.nameWithoutLanguage, "requesting-user-name", "PrintPilot"));
    bytes.push(...attribute(TAG.nameWithoutLanguage, "job-name", options.jobName || "PrintPilot"));
    bytes.push(...attribute(TAG.mimeMediaType, "document-format", options.mimeType || "application/pdf"));
    const job: number[] = [];
    if (options.copies && options.copies > 1) job.push(...attribute(TAG.integer, "copies", Math.min(999, Math.floor(options.copies))));
    if (options.sides) job.push(...attribute(TAG.keyword, "sides", options.sides));
    if (options.colorMode) job.push(...attribute(TAG.keyword, "print-color-mode", options.colorMode));
    if (job.length) bytes.push(TAG.job, ...job);
  } else if (operation === IPP_OPERATION.getPrinterAttributes) {
    bytes.push(...multiValueAttribute(TAG.keyword, "requested-attributes", [
      "printer-name",
      "printer-make-and-model",
      "document-format-supported",
      "operations-supported",
    ]));
  }
  bytes.push(TAG.end);
  const head = Uint8Array.from(bytes);
  if (!document?.length) return head;
  const out = new Uint8Array(head.length + document.length);
  out.set(head, 0);
  out.set(document, head.length);
  return out;
}

/** status-code < 0x0100 means success (successful-ok, ...-ignored-or-substituted). */
export function parseIppResponse(body: Uint8Array): { statusCode: number; ok: boolean } | null {
  // A web-console HTML error must not be interpreted as an IPP response.
  if (body.length < 8 || (body[0] !== 0x01 && body[0] !== 0x02)) return null;
  const statusCode = (body[2] << 8) | body[3];
  return { statusCode, ok: statusCode < 0x0100 };
}

export type ParsedIppPrinterAttributes = {
  statusCode: number;
  ok: boolean;
  attributes: Record<string, string[]>;
};

/** Parses IPP attribute groups while preserving multiple values for each attribute. */
export function parseIppPrinterAttributes(body: Uint8Array): ParsedIppPrinterAttributes | null {
  const response = parseIppResponse(body);
  if (!response) return null;
  const decoder = new TextDecoder();
  const attributes: Record<string, string[]> = {};
  let offset = 8;
  let previousName = "";

  while (offset < body.length) {
    const tag = body[offset++];
    if (tag === TAG.end) break;
    if (tag > 0 && tag <= 0x0f) {
      previousName = "";
      continue;
    }
    if (offset + 2 > body.length) return null;
    const nameLength = (body[offset] << 8) | body[offset + 1];
    offset += 2;
    if (offset + nameLength + 2 > body.length) return null;
    const name = nameLength ? decoder.decode(body.subarray(offset, offset + nameLength)) : previousName;
    offset += nameLength;
    const valueLength = (body[offset] << 8) | body[offset + 1];
    offset += 2;
    if (offset + valueLength > body.length) return null;
    const valueBytes = body.subarray(offset, offset + valueLength);
    const value = (tag === TAG.integer || tag === TAG.enum) && valueLength === 4
      ? String(((valueBytes[0] << 24) | (valueBytes[1] << 16) | (valueBytes[2] << 8) | valueBytes[3]) >>> 0)
      : decoder.decode(valueBytes);
    offset += valueLength;
    if (nameLength) previousName = name;
    if (name) (attributes[name.toLowerCase()] ??= []).push(value);
  }

  return { ...response, attributes };
}
