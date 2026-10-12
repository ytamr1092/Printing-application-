import { createElement } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Text, View } from "react-native";
import type { PdfDocumentPreviewProps } from "./pdf-document-preview";

export function PdfDocumentPreview({ uri, name, style, onError }: PdfDocumentPreviewProps) {
  return (
    <View style={[{ flex: 1, overflow: "hidden" }, style]}>
      {createElement("iframe", {
        title: name,
        src: uri,
        onError,
        style: {
          width: "100%",
          height: "100%",
          border: "0",
          backgroundColor: "#fff",
        } as StyleProp<ViewStyle>,
      })}
      <Text accessibilityRole="text" style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}>
        {name}
      </Text>
    </View>
  );
}
