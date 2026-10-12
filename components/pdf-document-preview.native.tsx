import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import type { PdfDocumentPreviewProps } from "./pdf-document-preview";

type NativePdfView = typeof import("@kishannareshpal/expo-pdf").PdfView;

export function PdfDocumentPreview({ uri, style, onError, unavailableLabel }: PdfDocumentPreviewProps) {
  const [PdfView, setPdfView] = useState<NativePdfView | null>(null);
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
    <PdfView
      uri={uri}
      style={style}
      fitMode="width"
      pagingEnabled
      pageGap={8}
      onError={() => onError?.()}
    />
  );
}
