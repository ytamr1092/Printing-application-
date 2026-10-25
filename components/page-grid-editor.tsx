import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useGridDragReorder } from "@/components/use-grid-drag-reorder";
import { useColors } from "@/hooks/use-colors";
import { autoScrollSpeed, normalizeRotation } from "@/shared/workflow-files";

export type GridItem = {
  key: string;
  /** Order number shown under the page. */
  label: string;
  thumbUri: string | null;
  rotation: number;
};

type Props = {
  title: string;
  items: GridItem[];
  selected: string[];
  isArabic: boolean;
  onToggle: (key: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onMove: (from: number, to: number) => void;
  onRotateSelected: () => void;
  onDeleteSelected: () => void;
  /** Present only where "keep just these pages" makes sense. */
  onExtractSelected?: () => void;
  onClose: () => void;
};

const tr = (isArabic: boolean, ar: string, en: string) => (isArabic ? ar : en);
const PAGE_ASPECT = 0.7071;
const LABEL_HEIGHT = 30;
const CELL_PADDING = 8;

type CellProps = {
  item: GridItem;
  index: number;
  total: number;
  cols: number;
  cellWidth: number;
  cellHeight: number;
  checked: boolean;
  isArabic: boolean;
  colors: ReturnType<typeof useColors>;
  onToggle: () => void;
  onMove: (from: number, to: number) => void;
  scrollY: number;
  getScrollY: () => number;
  onDragStart: () => void;
  onDragPoint: (fingerY: number) => void;
  onDragEnd: () => void;
};

function GridCell({
  item,
  index,
  total,
  cols,
  cellWidth,
  cellHeight,
  checked,
  isArabic,
  colors,
  onToggle,
  onMove,
  scrollY,
  getScrollY,
  onDragStart,
  onDragPoint,
  onDragEnd,
}: CellProps) {
  const { handlers, dragging, offsetX, offsetY } = useGridDragReorder({
    index,
    total,
    cols,
    cellWidth,
    cellHeight,
    mirror: isArabic,
    onMove,
    scrollY,
    getScrollY,
    onDragStart,
    onDragPoint,
    onDragEnd,
  });
  const rotation = normalizeRotation(item.rotation);
  const sideways = rotation === 90 || rotation === 270;
  const boxWidth = cellWidth - CELL_PADDING * 2;
  const boxHeight = cellHeight - CELL_PADDING * 2 - LABEL_HEIGHT;
  // A sideways page must shrink to stay inside the same box once rotated.
  const fit = sideways ? Math.min(boxWidth / boxHeight, boxHeight / boxWidth) : 1;

  return (
    <View
      testID={`grid-cell-${index}`}
      {...handlers}
      style={[
        styles.cell,
        { width: cellWidth, height: cellHeight },
        dragging
          ? {
              zIndex: 30,
              elevation: 8,
              transform: [{ translateX: offsetX }, { translateY: offsetY }, { scale: 1.04 }],
            }
          : null,
      ]}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={tr(isArabic, `الصفحة ${item.label}`, `Page ${item.label}`)}
        onPress={onToggle}
        style={styles.cellPressable}
      >
        <View
          style={[
            styles.sheet,
            {
              width: boxWidth,
              height: boxHeight,
              borderColor: checked ? colors.primary : colors.border,
              borderWidth: checked ? 2.5 : 1,
              backgroundColor: "#FFFFFF",
            },
          ]}
        >
          {item.thumbUri ? (
            <Image
              source={{ uri: item.thumbUri }}
              resizeMode="contain"
              style={[
                { width: boxWidth, height: boxHeight },
                rotation ? { transform: [{ rotate: `${rotation}deg` }, { scale: fit }] } : null,
              ]}
            />
          ) : (
            <Text style={[styles.placeholderNumber, { color: colors.muted }]}>{item.label}</Text>
          )}
          <View style={[styles.check, { left: 8, backgroundColor: checked ? colors.primary : "rgba(255,255,255,0.9)", borderColor: checked ? colors.primary : colors.muted }]}>
            {checked ? <MaterialIcons name="check" color="#fff" size={16} /> : null}
          </View>
        </View>
        <Text style={[styles.pageLabel, { color: colors.muted }]}>{item.label}</Text>
      </Pressable>
    </View>
  );
}

/**
 * Full-window page manager (like a document app's "all pages" view): a grid of
 * thumbnails. Tap selects, press-and-hold then drag reorders, and the bottom
 * bar rotates, deletes or extracts the selected pages.
 */
export function PageGridEditor({
  title,
  items,
  selected,
  isArabic,
  onToggle,
  onSelectAll,
  onClear,
  onMove,
  onRotateSelected,
  onDeleteSelected,
  onExtractSelected,
  onClose,
}: Props) {
  const colors = useColors();
  const { width: windowWidth } = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const viewportRef = useRef<View | null>(null);
  const scrollYRef = useRef(0);
  const draggingRef = useRef(false);
  const fingerY = useRef<number | null>(null);
  const viewport = useRef({ top: 0, height: 0 });
  const contentHeight = useRef(0);
  const scrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAutoScroll = () => {
    draggingRef.current = false;
    fingerY.current = null;
    if (scrollTimer.current) clearInterval(scrollTimer.current);
    scrollTimer.current = null;
  };
  // While a page is being dragged, scroll the grid when the finger nears an edge.
  const startAutoScroll = () => {
    stopAutoScroll();
    draggingRef.current = true;
    viewportRef.current?.measureInWindow?.((_x: number, y: number, _w: number, height: number) => {
      viewport.current = { top: y, height };
    });
    scrollTimer.current = setInterval(() => {
      const y = fingerY.current;
      if (y === null || viewport.current.height <= 0) return;
      const speed = autoScrollSpeed(y, viewport.current.top, viewport.current.height);
      if (!speed) return;
      const max = Math.max(0, contentHeight.current - viewport.current.height);
      const next = Math.min(Math.max(scrollYRef.current + speed, 0), max);
      if (next !== scrollYRef.current) scrollRef.current?.scrollTo?.({ y: next, animated: false });
    }, 16);
  };
  useEffect(() => stopAutoScroll, []);
  const available = measured || windowWidth;
  const cols = available >= 900 ? 4 : available >= 600 ? 3 : 2;
  const cellWidth = Math.floor(available / cols);
  const cellHeight = Math.round((cellWidth - CELL_PADDING * 2) / PAGE_ASPECT) + CELL_PADDING * 2 + LABEL_HEIGHT;
  const direction = isArabic ? "row-reverse" : "row";
  const allSelected = items.length > 0 && selected.length === items.length;
  const none = selected.length === 0;

  const action = (
    label: string,
    icon: React.ComponentProps<typeof MaterialIcons>["name"],
    onPress: () => void,
    tint: string,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: none }}
      disabled={none}
      onPress={onPress}
      style={[styles.action, { opacity: none ? 0.4 : 1 }]}
    >
      <MaterialIcons name={icon} color={tint} size={26} />
      <Text style={[styles.actionLabel, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View testID="page-grid-editor" style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { borderBottomColor: colors.border, flexDirection: direction }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={allSelected ? tr(isArabic, "إلغاء تحديد الكل", "Clear selection") : tr(isArabic, "تحديد الكل", "Select all")}
          onPress={allSelected ? onClear : onSelectAll}
          style={styles.topButton}
        >
          <Text style={[styles.topButtonText, { color: colors.primary }]}>{allSelected ? tr(isArabic, "إلغاء التحديد", "Clear") : tr(isArabic, "تحديد الكل", "Select all")}</Text>
        </Pressable>
        <View style={styles.topTitle}>
          <Text numberOfLines={1} style={[styles.titleText, { color: colors.foreground }]}>
            {tr(isArabic, `تم تحديد ${selected.length} من ${items.length} من الصفحات`, `${selected.length} of ${items.length} selected`)}
          </Text>
          <Text numberOfLines={1} style={[styles.hintText, { color: colors.muted }]}>{title}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={tr(isArabic, "إغلاق نافذة الصفحات", "Close pages window")} onPress={onClose} style={styles.topButton}>
          <MaterialIcons name={isArabic ? "chevron-left" : "chevron-right"} color={colors.foreground} size={30} />
        </Pressable>
      </View>
      <Text style={[styles.hint, { color: colors.muted }]}>
        {tr(isArabic, "اضغط للتحديد، واضغط مطولًا ثم اسحب لإعادة الترتيب", "Tap to select, press and hold then drag to reorder")}
      </Text>
      <View ref={viewportRef} collapsable={false} style={styles.scroll}>
      <ScrollView
        testID="page-grid-scroll"
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.gridContent}
        scrollEventThrottle={16}
        onContentSizeChange={(_w: number, h: number) => {
          contentHeight.current = h;
        }}
        onScroll={(event: { nativeEvent: { contentOffset: { y: number } } }) => {
          scrollYRef.current = event.nativeEvent.contentOffset.y;
          if (draggingRef.current) setScrollY(scrollYRef.current);
        }}
        onLayout={(event: { nativeEvent: { layout: { width: number } } }) => setMeasured(event.nativeEvent.layout.width)}
      >
        <View testID="page-grid" style={[styles.grid, { flexDirection: direction }]}>
          {items.map((item, index) => (
            <GridCell
              key={item.key}
              item={item}
              index={index}
              total={items.length}
              cols={cols}
              cellWidth={cellWidth}
              cellHeight={cellHeight}
              checked={selected.includes(item.key)}
              isArabic={isArabic}
              colors={colors}
              onToggle={() => onToggle(item.key)}
              onMove={onMove}
              scrollY={scrollY}
              getScrollY={() => scrollYRef.current}
              onDragStart={startAutoScroll}
              onDragPoint={(y) => {
                fingerY.current = y;
              }}
              onDragEnd={stopAutoScroll}
            />
          ))}
        </View>
      </ScrollView>
      </View>
      <View style={[styles.bottomBar, { borderTopColor: colors.border, backgroundColor: colors.surface, flexDirection: direction }]}>
        {action(tr(isArabic, "حذف", "Delete"), "delete-outline", onDeleteSelected, colors.error)}
        {action(tr(isArabic, "تدوير", "Rotate"), "rotate-right", onRotateSelected, colors.primary)}
        {onExtractSelected ? action(tr(isArabic, "استخراج", "Extract"), "file-upload", onExtractSelected, colors.primary) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { minHeight: 58, alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 6 },
  topButton: { minWidth: 64, height: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  topButtonText: { fontSize: 13, fontWeight: "900" },
  topTitle: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  titleText: { fontSize: 14, fontWeight: "900" },
  hintText: { fontSize: 10, marginTop: 1 },
  hint: { fontSize: 11, textAlign: "center", paddingVertical: 8, fontWeight: "700" },
  scroll: { flex: 1, minHeight: 0 },
  gridContent: { paddingBottom: 24 },
  grid: { flexWrap: "wrap" },
  cell: { padding: 0 },
  cellPressable: { flex: 1, alignItems: "center", paddingTop: CELL_PADDING },
  sheet: { borderRadius: 6, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  placeholderNumber: { fontSize: 38, fontWeight: "900" },
  check: { position: "absolute", top: 8, width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  pageLabel: { height: LABEL_HEIGHT, fontSize: 15, fontWeight: "700", textAlignVertical: "center", paddingTop: 4 },
  bottomBar: { minHeight: 66, borderTopWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "space-around", paddingHorizontal: 10 },
  action: { minWidth: 70, alignItems: "center", gap: 2, paddingVertical: 6 },
  actionLabel: { fontSize: 11, fontWeight: "800" },
});
