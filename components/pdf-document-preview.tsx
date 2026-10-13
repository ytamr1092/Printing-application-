import { MaterialIcons } from "@expo/vector-icons";
import type { StyleProp, ViewStyle } from "react-native";
import { Text, View } from "react-native";

export type PdfDocumentPreviewProps = {
  uri: string;
  name: string;
  style?: StyleProp<ViewStyle>;
  isArabic?: boolean;
  onError?: () => void;
  unavailableLabel?: string;
};

export function PdfDocumentPreview({ style, unavailableLabel }: PdfDocumentPreviewProps) {
  return (
    <View style={[{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }, style]}>
      <MaterialIcons name="picture-as-pdf" color="#64748B" size={34} />
      <Text style={{ color: "#475569", textAlign: "center", fontSize: 12 }}>
        {unavailableLabel || "عارض PDF المضمّن غير متاح على هذا النظام."}
      </Text>
    </View>
  );
}
