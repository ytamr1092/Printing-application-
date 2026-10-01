export type DuplexEdge = "long" | "short";

export function duplexEdgeLabel(edge: DuplexEdge, language: "ar" | "en"): string {
  if (language === "ar") return edge === "long" ? "الحافة الطويلة" : "الحافة القصيرة";
  return edge === "long" ? "Long edge" : "Short edge";
}

export function isDuplexEdge(value: unknown): value is DuplexEdge {
  return value === "long" || value === "short";
}
