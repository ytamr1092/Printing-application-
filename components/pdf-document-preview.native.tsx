import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import type { PdfDocumentPreviewProps } from "./pdf-document-preview";

type NativePdfView = typeof import("@kishannareshpal/expo-pdf").PdfView;

export function PdfDocumentPreview({ uri, style, onError, unavailableLabel, isArabic = false }: PdfDocumentPreviewProps) {
  const [PdfView, setPdfView] = useState<NativePdfView | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const errorHandler = useRef(onError);

  useEffect(() => {
    errorHandler.current = onError;
  }, [onError]);

  useEffect(() => {
    void import("@kishannareshpal/expo-pdf")
      .then(({ PdfView }) => setPdfView(() => PdfView as NativePdfView))
      .catch(() => errorHandler.current?.());
  }, []);

  if (!PdfView) {
    return (
      <View style={[{ flex: 1, alignItems: "center", justifyContent: "center" }, style]}>
        <Text style={{ color: "#64748B", textAlign: "center", fontSize: 12 }}>
          {unavailableLabel || "PDF viewer unavailable. Use the external open option."}
        </Text>
      </View>
    );
  }

  return (
    <View style={[{ flex: 1, minHeight: 0 }, style]}>
      <PdfView
        uri={uri}
        style={{ flex: 1, minHeight: 0 }}
        fitMode="width"
        pagingEnabled={false}
        pageGap={8}
        doubleTapToZoom
        onLoadComplete={({ pageCount: count }) => {
          setPageCount(count);
          setPageIndex(0);
        }}
        onPageChanged={({ pageIndex: current, pageCount: count }) => {
          setPageIndex(current);
          setPageCount(count);
        }}
        onError={() => onError?.()}
      />
      {pageCount > 1 ? (
        <View style={{ alignItems: "center", paddingVertical: 4, backgroundColor: "#F1F5F9" }}>
          <Text accessibilityRole="text" style={{ color: "#475569", fontSize: 10, fontWeight: "700" }}>
            {isArabic ? `صفحة ${pageIndex + 1} من ${pageCount}` : `Page ${pageIndex + 1} of ${pageCount}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
