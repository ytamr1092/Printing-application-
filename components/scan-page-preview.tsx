import React from "react";
import { Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useColors } from "@/hooks/use-colors";

type Props = {
  visible: boolean;
  pages: { id: string; uri: string; rotation: number }[];
  isArabic: boolean;
  onClose: () => void;
};

/** Large, scrollable look at the selected scanned pages (rotation applied). */
export function ScanPagePreview({ visible, pages, isArabic, onClose }: Props) {
  const colors = useColors();
  const width = Dimensions.get("window").width - 24;
  const height = Math.round(width * 1.35);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.bar, { borderBottomColor: colors.border, flexDirection: isArabic ? "row-reverse" : "row" }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {isArabic ? `معاينة (${pages.length})` : `Preview (${pages.length})`}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "إغلاق المعاينة" : "Close preview"} onPress={onClose} style={styles.close}>
            <MaterialIcons name="close" color={colors.foreground} size={26} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {pages.map((page, index) => {
            const sideways = page.rotation === 90 || page.rotation === 270;
            return (
              <View key={page.id} style={[styles.page, { width, height, borderColor: colors.border, backgroundColor: "#fff" }]}>
                <Image
                  resizeMethod="resize"
                  accessibilityLabel={isArabic ? `الصفحة ${index + 1}` : `Page ${index + 1}`}
                  source={{ uri: page.uri }}
                  resizeMode="contain"
                  style={{
                    width: sideways ? height : width,
                    height: sideways ? width : height,
                    transform: [{ rotate: `${page.rotation}deg` }],
                  }}
                />
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { height: 56, alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 16, fontWeight: "900" },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  content: { padding: 12, gap: 12, alignItems: "center" },
  page: { borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
