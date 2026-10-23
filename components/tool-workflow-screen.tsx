import React, { useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { PdfDocumentPreview } from "@/components/pdf-document-preview";
import { useColors } from "@/hooks/use-colors";
import { dragDirection } from "@/shared/pdf-pages";
import { paperOptions } from "@/shared/print-options";
import type { PreviewKind } from "@/shared/preview";
import { normalizeRotation } from "@/shared/workflow-files";
import type { PdfPageEdit } from "@/shared/pdf-pages";

type WorkflowFile = {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
  rotation?: number;
};

export type WorkflowResult = {
  title: string;
  detail?: string;
  uri?: string;
  mimeType?: string;
};

type Props = {
  kind: PreviewKind;
  title: string;
  isArabic: boolean;
  files: WorkflowFile[];
  previewFile: WorkflowFile | null;
  frontUri: string | null;
  backUri: string | null;
  frontRotation?: number;
  backRotation?: number;
  pageCount?: number;
  pageEdits?: PdfPageEdit[];
  selectedPageIndex?: number | null;
  settings: Record<string, string | boolean>;
  result: WorkflowResult | null;
  error: { title: string; hint: string } | null;
  processing: boolean;
  idBusy: boolean;
  canRun: boolean;
  onBack: () => void;
  onPickFiles: (source?: "gallery" | "files") => void;
  onPickIdFace: (side: "front" | "back", source?: "library" | "camera" | "files") => void;
  onRotateIdFace: (side: "front" | "back") => void;
  onScanIdFace: (side: "front" | "back") => void;
  onSelectPreviewFile: (file: WorkflowFile) => void;
  onMoveFile: (from: number, to: number) => void;
  onSelectPage?: (index: number) => void;
  onMovePage?: (sourcePage: number, direction: -1 | 1) => void;
  onRotatePage?: (sourcePage: number) => void;
  onTogglePageOrientation?: (sourcePage: number) => void;
  onDeletePage?: (sourcePage: number) => void;
  onRotateFile: (index: number) => void;
  onRotateAllFiles?: () => void;
  onRemoveFile: (index: number) => void;
  onSettingChange: (key: string, value: string | boolean) => void;
  onRun: () => void;
  onShareResult: () => void;
  onDismissError: () => void;
};

const tr = (isArabic: boolean, ar: string, en: string) =>
  isArabic ? ar : en;

type WorkflowFileRowProps = {
  file: WorkflowFile;
  index: number;
  total: number;
  isArabic: boolean;
  selected: boolean;
  canReorder: boolean;
  canRotate: boolean;
  colors: ReturnType<typeof useColors>;
  direction: "row" | "row-reverse";
  onSelect: () => void;
  onMove: (from: number, to: number) => void;
  onRotate: () => void;
  onRemove: () => void;
};

function WorkflowFileRow({
  file,
  index,
  total,
  isArabic,
  selected,
  canReorder,
  canRotate,
  colors,
  direction,
  onSelect,
  onMove,
  onRotate,
  onRemove,
}: WorkflowFileRowProps) {
  const lastDragY = useRef(0);
  const latest = useRef({ index, total, onMove });
  latest.current = { index, total, onMove };
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 7,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          lastDragY.current = 0;
        },
        onPanResponderMove: (_, gesture) => {
          const direction = dragDirection(gesture.dy - lastDragY.current, 42);
          if (!direction) return;
          const { index: currentIndex, total: currentTotal, onMove: move } = latest.current;
          const target = currentIndex + direction;
          if (target < 0 || target >= currentTotal) return;
          move(currentIndex, target);
          lastDragY.current += direction * 42;
        },
        onPanResponderRelease: () => {
          lastDragY.current = 0;
        },
        onPanResponderTerminate: () => {
          lastDragY.current = 0;
        },
      }),
    [],
  );

  return (
    <View testID={`workflow-file-row-${index}`} style={[styles.fileRow, { borderBottomColor: colors.border, flexDirection: direction }]}>
      <Pressable onPress={onSelect} style={[styles.fileMain, { flexDirection: direction }]}>
        <View style={[styles.fileIcon, { backgroundColor: `${colors.primary}12` }]}>
          <MaterialIcons
            name={file.mimeType?.startsWith("image/") ? "image" : "picture-as-pdf"}
            color={colors.primary}
            size={19}
          />
        </View>
        <View style={styles.fileCopy}>
          <Text numberOfLines={1} style={[styles.fileName, { color: selected ? colors.primary : colors.foreground, textAlign: isArabic ? "right" : "left" }]}>
            {file.name}
          </Text>
          <Text style={[styles.fileMeta, { color: colors.muted, textAlign: isArabic ? "right" : "left" }]}>
            {file.size
              ? file.size < 1024 * 1024
                ? `${Math.max(1, Math.round(file.size / 1024))} KB`
                : `${(file.size / (1024 * 1024)).toFixed(1)} MB`
              : file.mimeType || tr(isArabic, "اضغط لمعاينة الملف", "Tap to preview")}
          </Text>
        </View>
      </Pressable>
      <View style={styles.fileActions}>
        {canRotate ? (
          <Pressable accessibilityRole="button" accessibilityLabel={tr(isArabic, "تدوير الصورة", "Rotate image")} onPress={onRotate} style={styles.iconButton}>
            <MaterialIcons name="rotate-90-degrees-ccw" color={colors.primary} size={18} />
          </Pressable>
        ) : null}
        {canReorder ? (
          <>
            <View
              {...panResponder.panHandlers}
              accessibilityRole="button"
              accessibilityLabel={tr(isArabic, "اسحب لتحريك الملف", "Drag to reorder file")}
              style={[styles.iconButton, styles.dragHandle, { backgroundColor: `${colors.primary}12` }]}
            >
              <MaterialIcons name="drag-indicator" color={colors.primary} size={20} />
              <Text style={[styles.fileDragLabel, { color: colors.primary }]}>{tr(isArabic, "اسحب", "Drag")}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={tr(isArabic, "تحريك لأعلى", "Move up")} disabled={index === 0} onPress={() => onMove(index, index - 1)} style={styles.iconButton}>
              <MaterialIcons name="keyboard-arrow-up" color={index === 0 ? colors.border : colors.muted} size={21} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={tr(isArabic, "تحريك لأسفل", "Move down")} disabled={index === total - 1} onPress={() => onMove(index, index + 1)} style={styles.iconButton}>
              <MaterialIcons name="keyboard-arrow-down" color={index === total - 1 ? colors.border : colors.muted} size={21} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={tr(isArabic, "إزالة الملف", "Remove file")} onPress={onRemove} style={styles.iconButton}>
              <MaterialIcons name="close" color={colors.error} size={18} />
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

type WorkflowPageRowProps = {
  edit: PdfPageEdit;
  index: number;
  total: number;
  active: boolean;
  isArabic: boolean;
  direction: "row" | "row-reverse";
  colors: ReturnType<typeof useColors>;
  onSelect: () => void;
  onMove: (sourcePage: number, direction: -1 | 1) => void;
  onRotate: (sourcePage: number) => void;
  onToggleOrientation: (sourcePage: number) => void;
  onDelete: (sourcePage: number) => void;
};

function WorkflowPageRow({
  edit,
  index,
  total,
  active,
  isArabic,
  direction,
  colors,
  onSelect,
  onMove,
  onRotate,
  onToggleOrientation,
  onDelete,
}: WorkflowPageRowProps) {
  const lastDragY = useRef(0);
  const latest = useRef({ sourcePage: edit.sourcePage, onMove, onSelect });
  latest.current = { sourcePage: edit.sourcePage, onMove, onSelect };
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          lastDragY.current = 0;
          latest.current.onSelect();
        },
        onPanResponderMove: (_, gesture) => {
          const move = dragDirection(gesture.dy - lastDragY.current, 30);
          if (!move) return;
          latest.current.onMove(latest.current.sourcePage, move);
          lastDragY.current += move * 30;
        },
        onPanResponderRelease: () => {
          lastDragY.current = 0;
        },
        onPanResponderTerminate: () => {
          lastDragY.current = 0;
        },
      }),
    [],
  );

  return (
    <View
      style={[
        styles.pageEditRow,
        {
          flexDirection: direction,
          backgroundColor: active ? `${colors.primary}10` : colors.background,
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
    >
      <View style={styles.pageEditCopy}>
        <Text style={[styles.pageEditTitle, { color: colors.foreground, textAlign: isArabic ? "right" : "left" }]}>
          {isArabic ? `الصفحة ${edit.sourcePage} · الترتيب ${index + 1}` : `Page ${edit.sourcePage} · Order ${index + 1}`}
        </Text>
        <Text style={[styles.pageEditMeta, { color: colors.muted, textAlign: isArabic ? "right" : "left" }]}>
          {edit.rotation}°
        </Text>
      </View>
      <View style={styles.pageEditActions}>
        <View
          {...panResponder.panHandlers}
          accessibilityRole="button"
          accessibilityLabel={tr(isArabic, "اسحب المقبض لتحريك الصفحة", "Drag this handle to move the page")}
          style={[styles.pageDragHandle, { backgroundColor: `${colors.primary}14` }]}
        >
          <MaterialIcons name="drag-indicator" color={colors.primary} size={20} />
          <Text style={[styles.pageDragLabel, { color: colors.primary }]}>{tr(isArabic, "اسحب", "Drag")}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={tr(isArabic, "تحريك الصفحة لأعلى", "Move page up")} disabled={index === 0} onPress={() => onMove(edit.sourcePage, -1)} style={styles.pageActionButton}>
          <MaterialIcons name="keyboard-arrow-up" color={index === 0 ? colors.border : colors.primary} size={20} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={tr(isArabic, "تحريك الصفحة لأسفل", "Move page down")} disabled={index === total - 1} onPress={() => onMove(edit.sourcePage, 1)} style={styles.pageActionButton}>
          <MaterialIcons name="keyboard-arrow-down" color={index === total - 1 ? colors.border : colors.primary} size={20} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={tr(isArabic, "تدوير الصفحة", "Rotate page")} onPress={() => onRotate(edit.sourcePage)} style={styles.pageActionButton}>
          <MaterialIcons name="rotate-90-degrees-ccw" color={colors.primary} size={17} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={tr(isArabic, "تغيير اتجاه الصفحة", "Toggle page orientation")} onPress={() => onToggleOrientation(edit.sourcePage)} style={styles.pageActionButton}>
          <MaterialIcons name="screen-rotation" color={colors.primary} size={17} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={tr(isArabic, "حذف الصفحة", "Delete page")} onPress={() => onDelete(edit.sourcePage)} style={styles.pageActionButton}>
          <MaterialIcons name="delete-outline" color={colors.error} size={18} />
        </Pressable>
      </View>
    </View>
  );
}

export function ToolWorkflowScreen({
  kind,
  title,
  isArabic,
  files,
  previewFile,
  frontUri,
  backUri,
  frontRotation = 0,
  backRotation = 0,
  pageCount,
  pageEdits = [],
  selectedPageIndex = null,
  settings,
  result,
  error,
  processing,
  idBusy,
  canRun,
  onBack,
  onPickFiles,
  onPickIdFace,
  onRotateIdFace,
  onScanIdFace,
  onSelectPreviewFile,
  onMoveFile,
  onSelectPage,
  onMovePage,
  onRotatePage,
  onTogglePageOrientation,
  onDeletePage,
  onRotateFile,
  onRotateAllFiles,
  onRemoveFile,
  onSettingChange,
  onRun,
  onShareResult,
  onDismissError,
}: Props) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 900;
  const direction = isArabic ? "row-reverse" : "row";
  const runLabel = useMemo(() => {
    const labels: Record<PreviewKind, [string, string]> = {
      merge: ["دمج الملفات", "Merge files"],
      images: ["تحويل الصور إلى PDF", "Convert images to PDF"],
      extract: ["استخراج الصور", "Extract images"],
      numbering: ["ترقيم الملف", "Number PDF"],
      pages: ["إنشاء الملف المعدّل", "Create edited PDF"],
      id: ["إنشاء ملف بطاقة الهوية", "Create ID card PDF"],
      print: ["متابعة الطباعة", "Continue to print"],
    };
    return tr(isArabic, ...labels[kind]);
  }, [isArabic, kind]);

  const set = (key: string, value: string | boolean) =>
    onSettingChange(key, value);
  const value = (key: string, fallback = "") =>
    String(settings[key] ?? fallback);

  const pills = (
    key: string,
    options: { value: string; label: string }[],
  ) => (
    <View style={[styles.pillRow, { flexDirection: direction }]}>
      {options.map((option) => {
        const selected = value(key) === option.value;
        return (
          <Pressable
            key={`${key}-${option.value}`}
            onPress={() => set(key, option.value)}
            style={[
              styles.pill,
              {
                backgroundColor: selected ? colors.primary : colors.background,
                borderColor: selected ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={[styles.pillText, { color: selected ? "#fff" : colors.foreground }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const field = (
    key: string,
    label: string,
    placeholder = label,
    keyboardType: "default" | "number-pad" | "decimal-pad" = "default",
  ) => (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.muted, textAlign: isArabic ? "right" : "left" }]}>
        {label}
      </Text>
      <TextInput
        value={value(key)}
        onChangeText={(text) => set(key, text)}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        style={[
          styles.input,
          {
            color: colors.foreground,
            backgroundColor: colors.background,
            borderColor: colors.border,
            textAlign: isArabic ? "right" : "left",
          },
        ]}
      />
    </View>
  );

  const toggle = (key: string, label: string) => {
    const active = Boolean(settings[key]);
    return (
      <Pressable
        onPress={() => set(key, !active)}
        style={[
          styles.toggle,
          {
            flexDirection: direction,
            borderColor: active ? colors.primary : colors.border,
            backgroundColor: active ? `${colors.primary}12` : colors.background,
          },
        ]}
      >
        <MaterialIcons name={active ? "check-circle" : "radio-button-unchecked"} color={active ? colors.primary : colors.muted} size={19} />
        <Text style={[styles.toggleText, { color: active ? colors.primary : colors.foreground }]}>{label}</Text>
      </Pressable>
    );
  };

  const sectionTitle = (label: string, icon: React.ComponentProps<typeof MaterialIcons>["name"]) => (
    <View style={[styles.sectionTitleRow, { flexDirection: direction }]}>
      <MaterialIcons name={icon} color={colors.primary} size={19} />
      <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isArabic ? "right" : "left" }]}>{label}</Text>
    </View>
  );

  const renderOptions = () => {
    if (kind === "images") {
      return (
        <>
          {sectionTitle(tr(isArabic, "طريقة احتواء الصورة", "Image fit"), "photo-size-select-actual")}
          {pills("imageFit", [
            { value: "contain", label: tr(isArabic, "إظهار الصورة كاملة", "Fit whole image") },
            { value: "fill", label: tr(isArabic, "ملء الصفحة", "Fill page") },
          ])}
        </>
      );
    }
    if (kind === "extract") {
      return (
        <>
          {sectionTitle(tr(isArabic, "صيغة الصور الناتجة", "Output image format"), "photo-filter")}
          {pills("extractFormat", [
            { value: "jpg", label: "JPG" },
            { value: "png", label: "PNG" },
          ])}
        </>
      );
    }
    if (kind === "numbering") {
      return (
        <>
          {sectionTitle(tr(isArabic, "إعدادات الترقيم", "Numbering options"), "format-list-numbered")}
          {field("numberFormat", tr(isArabic, "صيغة الرقم ({n} الرقم، {t} الإجمالي)", "Number format ({n} number, {t} total)"))}
          <View style={[styles.fieldsRow, { flexDirection: direction }]}>
            {field("numberFrom", tr(isArabic, "من صفحة", "From page"), "1", "number-pad")}
            {field("numberTo", tr(isArabic, "إلى صفحة", "To page"), String(pageCount ?? ""), "number-pad")}
          </View>
          <View style={[styles.fieldsRow, { flexDirection: direction }]}>
            {field("numberStart", tr(isArabic, "بداية الرقم", "Starting number"), "1", "number-pad")}
            {field("numberSize", tr(isArabic, "الحجم (نقطة)", "Size (pt)"), "9", "decimal-pad")}
            {field("numberMargin", tr(isArabic, "الهامش (مم)", "Margin (mm)"), "10", "decimal-pad")}
          </View>
          <Text style={[styles.fieldLabel, { color: colors.muted, textAlign: isArabic ? "right" : "left" }]}>{tr(isArabic, "الموضع الأفقي", "Horizontal position")}</Text>
          {pills("numberPosition", [
            { value: "left", label: tr(isArabic, "يسار", "Left") },
            { value: "center", label: tr(isArabic, "وسط", "Center") },
            { value: "right", label: tr(isArabic, "يمين", "Right") },
          ])}
          <Text style={[styles.fieldLabel, { color: colors.muted, textAlign: isArabic ? "right" : "left" }]}>{tr(isArabic, "الموضع الرأسي", "Vertical position")}</Text>
          {pills("numberVertical", [
            { value: "top", label: tr(isArabic, "أعلى", "Top") },
            { value: "middle", label: tr(isArabic, "المنتصف", "Middle") },
            { value: "bottom", label: tr(isArabic, "أسفل", "Bottom") },
          ])}
          {pills("numberWhich", [
            { value: "all", label: tr(isArabic, "كل الصفحات", "All pages") },
            { value: "odd", label: tr(isArabic, "الفردية", "Odd") },
            { value: "even", label: tr(isArabic, "الزوجية", "Even") },
          ])}
          {pills("numberNumerals", [
            { value: "latin", label: "123" },
            { value: "indic", label: "١٢٣" },
            { value: "roman-u", label: "I II" },
            { value: "roman-l", label: "i ii" },
          ])}
          {pills("numberFont", [
            { value: "helvetica", label: "Helvetica" },
            { value: "times", label: "Times" },
            { value: "courier", label: "Courier" },
          ])}
          {toggle("numberBold", tr(isArabic, "خط غامق", "Bold"))}
          {toggle("numberMirror", tr(isArabic, "عكس الموضع في الصفحات الزوجية", "Mirror on even pages"))}
        </>
      );
    }
    if (kind === "pages") {
      return (
        <>
          {sectionTitle(tr(isArabic, "ترتيب الصفحات", "Page order"), "view-list")}
          <Text style={[styles.helper, { color: colors.muted, textAlign: isArabic ? "right" : "left" }]}>
            {tr(isArabic, `اكتب أرقام الصفحات بالترتيب المطلوب. الصفحات المحذوفة لن تظهر في الناتج. مثال: 3, 1, 2${pageCount ? ` (عدد الصفحات: ${pageCount})` : ""}`, `Enter page numbers in the desired order. Omitted pages will be removed. Example: 3, 1, 2${pageCount ? ` (${pageCount} pages)` : ""}`)}
          </Text>
          {field("pageOrder", tr(isArabic, "الأرقام بالترتيب", "Pages in order"), "1, 2, 3")}
        </>
      );
    }
    if (kind === "print") {
      return (
        <>
          {sectionTitle(tr(isArabic, "الورق والطباعة", "Paper & print"), "tune")}
          {pills("selectedPaper", paperOptions.map((option) => ({ value: option.id, label: isArabic ? option.ar : option.en })))}
          {pills("selectedWeight", ["70 g/m²", "80 g/m²", "120 g/m²", "200 g/m²"].map((label) => ({ value: label, label })))}
          {pills("orientation", [
            { value: "portrait", label: tr(isArabic, "طولي", "Portrait") },
            { value: "landscape", label: tr(isArabic, "عرضي", "Landscape") },
          ])}
          {pills("colorMode", [
            { value: "color", label: tr(isArabic, "ملون", "Color") },
            { value: "bw", label: tr(isArabic, "أبيض وأسود", "Black & white") },
          ])}
          {pills("printScale", [
            { value: "fit", label: tr(isArabic, "ملاءمة", "Fit") },
            { value: "actual", label: tr(isArabic, "حجم فعلي", "Actual size") },
            { value: "fill", label: tr(isArabic, "ملء الصفحة", "Fill") },
          ])}
          <View style={[styles.fieldsRow, { flexDirection: direction }]}>
            {field("copies", tr(isArabic, "عدد النسخ", "Copies"), "1", "number-pad")}
            {field("printPages", tr(isArabic, "نطاق الصفحات", "Page range"), "1-3,5")}
            {field("printMargins", tr(isArabic, "الهوامش (مم)", "Margins (mm)"), "5", "decimal-pad")}
          </View>
          {toggle("duplex", tr(isArabic, "طباعة على الوجهين", "Print both sides"))}
          {toggle("printCollate", tr(isArabic, "تجميع النسخ", "Collate copies"))}
          {settings.duplex ? pills("duplexEdge", [
            { value: "long", label: tr(isArabic, "الحافة الطويلة", "Long edge") },
            { value: "short", label: tr(isArabic, "الحافة القصيرة", "Short edge") },
          ]) : null}
        </>
      );
    }
    if (kind === "id") {
      return (
        <>
          {sectionTitle(tr(isArabic, "إعدادات بطاقة الهوية", "ID card options"), "badge")}
          {pills("idSize", [
            { value: "fit", label: tr(isArabic, "ملاءمة داخل الصفحة", "Fit to page") },
            { value: "actual", label: tr(isArabic, "الحجم الفعلي", "Actual size") },
          ])}
          <View style={[styles.fieldsRow, { flexDirection: direction }]}>
            {field("idCopies", tr(isArabic, "عدد النسخ", "Copies"), "1", "number-pad")}
            {field("idMargin", tr(isArabic, "الهامش (مم)", "Margin (mm)"), "12", "decimal-pad")}
          </View>
          {pills("idQuality", [
            { value: "standard", label: tr(isArabic, "قياسية", "Standard") },
            { value: "high", label: tr(isArabic, "عالية", "High") },
          ])}
        </>
      );
    }
    return null;
  };

  const face = (side: "front" | "back", uri: string | null) => {
    const label = side === "front" ? tr(isArabic, "الوجه الأمامي", "Front side") : tr(isArabic, "الوجه الخلفي", "Back side");
    return (
      <View key={side} style={[styles.faceCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={[styles.faceTitle, { color: colors.foreground }]}>{label}</Text>
        <Pressable onPress={() => onPickIdFace(side, "library")} style={[styles.secondaryButton, { borderColor: colors.primary, flexDirection: direction }]}>
          <MaterialIcons name="photo-library" color={colors.primary} size={17} />
          <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>{tr(isArabic, uri ? "تغيير الصورة" : "اختيار صورة", uri ? "Change image" : "Choose image")}</Text>
        </Pressable>
        <Pressable onPress={() => onPickIdFace(side, "files")} style={[styles.secondaryButton, { borderColor: colors.border, flexDirection: direction }]}>
          <MaterialIcons name="folder-open" color={colors.muted} size={17} />
          <Text style={[styles.secondaryButtonText, { color: colors.muted }]}>{tr(isArabic, "تصفح الملفات", "Browse files")}</Text>
        </Pressable>
        {uri ? (
          <Pressable accessibilityRole="button" accessibilityLabel={tr(isArabic, `تدوير ${label}`, `Rotate ${label}`)} onPress={() => onRotateIdFace(side)} style={[styles.secondaryButton, { borderColor: colors.border, flexDirection: direction }]}>
            <MaterialIcons name="rotate-90-degrees-ccw" color={colors.primary} size={17} />
            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>{tr(isArabic, "تدوير الصورة 90°", "Rotate image 90°")}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => onPickIdFace(side, "camera")} style={[styles.secondaryButton, { borderColor: colors.border, flexDirection: direction }]}>
          <MaterialIcons name="photo-camera" color={colors.muted} size={17} />
          <Text style={[styles.secondaryButtonText, { color: colors.muted }]}>{tr(isArabic, "التقاط بالكاميرا", "Take photo")}</Text>
        </Pressable>
        <Pressable onPress={() => onScanIdFace(side)} style={[styles.secondaryButton, { borderColor: colors.border, flexDirection: direction }]}>
          <MaterialIcons name="document-scanner" color={colors.muted} size={17} />
          <Text style={[styles.secondaryButtonText, { color: colors.muted }]}>{tr(isArabic, "مسح عبر Kyocera", "Scan with Kyocera")}</Text>
        </Pressable>
      </View>
    );
  };

  const activeResult = result;
  const completedSteps = activeResult ? 3 : files.length || frontUri || backUri ? 2 : 0;
  const idPreviewFace = (side: "front" | "back", uri: string | null, rotation: number) => (
    <View key={side} style={[styles.idPreviewSide, { borderColor: colors.border, backgroundColor: colors.background }]}>
      <Text style={[styles.faceTitle, { color: colors.foreground }]}>
        {side === "front" ? tr(isArabic, "الوجه الأمامي", "Front side") : tr(isArabic, "الوجه الخلفي", "Back side")}
      </Text>
      {uri ? (
        <Image
          accessibilityLabel={side === "front" ? tr(isArabic, "معاينة الوجه الأمامي", "Front side preview") : tr(isArabic, "معاينة الوجه الخلفي", "Back side preview")}
          source={{ uri }}
          resizeMode="contain"
          style={[styles.idPreviewImage, normalizeRotation(rotation) ? { transform: [{ rotate: `${normalizeRotation(rotation)}deg` }] } : null]}
        />
      ) : (
        <MaterialIcons name="add-photo-alternate" color={colors.muted} size={30} />
      )}
    </View>
  );

  const editorPane = (
    <View testID="workflow-editor-pane" style={styles.editorPane}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {sectionTitle(kind === "id" ? tr(isArabic, "اختر وجهي البطاقة", "Choose both card sides") : tr(isArabic, "اختيار الملفات", "Choose files"), "folder-open")}
        {kind === "id" ? (
          <View style={[styles.facesRow, { flexDirection: direction }]}>{face("front", frontUri)}{face("back", backUri)}</View>
        ) : (
          <>
            <Text style={[styles.helper, { color: colors.muted, textAlign: isArabic ? "right" : "left" }]}>{tr(isArabic, "ابدأ باختيار الملف أو الملفات. يمكنك الرجوع لهذه الشاشة لاحقًا دون فقدان اختيارك.", "Choose one or more files to get started. You can return here later without losing your selection.")}</Text>
            {kind === "images" ? (
              <View style={[styles.pickerOptionsRow, { flexDirection: direction }]}>
                <Pressable accessibilityRole="button" onPress={() => onPickFiles("gallery")} style={[styles.pickButton, styles.pickerOption, { backgroundColor: colors.primary, flexDirection: direction }]}>
                  <MaterialIcons name="photo-library" color="#fff" size={18} />
                  <Text style={styles.pickButtonText}>{tr(isArabic, "اختيار من المعرض", "Choose from photos")}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => onPickFiles("files")} style={[styles.pickButton, styles.pickerOption, { backgroundColor: colors.primary, flexDirection: direction }]}>
                  <MaterialIcons name="folder-open" color="#fff" size={18} />
                  <Text style={styles.pickButtonText}>{tr(isArabic, "تصفح الملفات", "Browse files")}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => onPickFiles("files")} style={[styles.pickButton, { backgroundColor: colors.primary, flexDirection: direction }]}>
                <MaterialIcons name="add" color="#fff" size={20} />
                <Text style={styles.pickButtonText}>{files.length ? tr(isArabic, "تغيير الملفات", "Change files") : tr(isArabic, "اختيار الملفات", "Choose files")}</Text>
              </Pressable>
            )}
            {files.length > 0 ? (
              <View style={[styles.fileList, { borderColor: colors.border, backgroundColor: colors.background }]}>
                {kind === "images" && onRotateAllFiles ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={tr(isArabic, "تدوير كل الصور", "Rotate all images")}
                    onPress={onRotateAllFiles}
                    style={[styles.bulkAction, { borderBottomColor: colors.border, flexDirection: direction }]}
                  >
                    <MaterialIcons name="rotate-right" color={colors.primary} size={18} />
                    <Text style={[styles.bulkActionText, { color: colors.primary }]}>{tr(isArabic, "تدوير كل الصور 90°", "Rotate all images 90°")}</Text>
                  </Pressable>
                ) : null}
                {files.map((file, index) => (
                  <WorkflowFileRow
                    key={file.uri}
                    file={file}
                    index={index}
                    total={files.length}
                    isArabic={isArabic}
                    selected={previewFile?.uri === file.uri}
                    canReorder={kind === "merge" || kind === "images"}
                    canRotate={kind === "images" && Boolean(file.mimeType?.startsWith("image/"))}
                    colors={colors}
                    direction={direction}
                    onSelect={() => onSelectPreviewFile(file)}
                    onMove={onMoveFile}
                    onRotate={() => onRotateFile(index)}
                    onRemove={() => onRemoveFile(index)}
                  />
                ))}
              </View>
            ) : (
              <View style={[styles.emptyFiles, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <MaterialIcons name="description" color={colors.muted} size={27} />
                <Text style={[styles.emptyText, { color: colors.muted }]}>{tr(isArabic, "لم يتم اختيار ملف بعد", "No file selected yet")}</Text>
              </View>
            )}
          </>
        )}
      </View>

      {(kind === "merge" || kind === "images") && files.length > 1 ? (
        <View style={[styles.notice, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}30`, flexDirection: direction }]}>
          <MaterialIcons name="drag-indicator" color={colors.primary} size={18} />
          <Text style={[styles.noticeText, { color: colors.primary, textAlign: isArabic ? "right" : "left" }]}>{tr(isArabic, "اسحب مقبض (اسحب) أو استخدم الأسهم. يمكنك تدوير كل الصور أو تدوير صورة واحدة؛ سيُستخدم هذا الترتيب في الملف الناتج.", "Drag the labeled handle or use the arrows. You can rotate all images or one image; the same order is used in the output.")}</Text>
        </View>
      ) : null}

      {kind !== "id" && files.length > 0 ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {sectionTitle(tr(isArabic, "خيارات الأداة", "Tool options"), "tune")}
          {renderOptions()}
        </View>
      ) : null}
      {kind === "id" ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>{renderOptions()}</View>
      ) : null}

      {kind === "pages" && pageEdits.length > 0 ? (
        <View testID="workflow-page-editor" style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {sectionTitle(tr(isArabic, "ترتيب صفحات الملف", "Reorder document pages"), "view-list")}
          <Text style={[styles.helper, { color: colors.muted, textAlign: isArabic ? "right" : "left" }]}>{tr(isArabic, "اسحب المقبض أو استخدم الأسهم. هذا الترتيب والتدوير والحذف يطبّق على الملف الناتج.", "Drag the handle or use the arrows. This order, rotation, and deletion are applied to the output file.")}</Text>
          <ScrollView style={styles.pageEditList} contentContainerStyle={styles.pageEditRows} nestedScrollEnabled showsVerticalScrollIndicator>
            {pageEdits.map((edit, index) => (
              <WorkflowPageRow
                key={edit.sourcePage}
                edit={edit}
                index={index}
                total={pageEdits.length}
                active={selectedPageIndex === index}
                isArabic={isArabic}
                direction={direction}
                colors={colors}
                onSelect={() => onSelectPage?.(index)}
                onMove={(sourcePage, move) => onMovePage?.(sourcePage, move)}
                onRotate={(sourcePage) => onRotatePage?.(sourcePage)}
                onToggleOrientation={(sourcePage) => onTogglePageOrientation?.(sourcePage)}
                onDelete={(sourcePage) => onDeletePage?.(sourcePage)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );

  const previewPane = (
    <View testID="workflow-preview-pane" style={styles.previewPane}>
      <View style={[styles.card, styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {sectionTitle(tr(isArabic, "المعاينة الكاملة", "Full preview"), "visibility")}
        {kind === "merge" && files.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.previewFilePicker, { flexDirection: direction }]}>
            {files.map((file) => (
              <Pressable
                key={file.uri}
                accessibilityRole="button"
                accessibilityLabel={tr(isArabic, `معاينة ${file.name}`, `Preview ${file.name}`)}
                accessibilityState={{ selected: previewFile?.uri === file.uri }}
                onPress={() => onSelectPreviewFile(file)}
                style={[styles.previewFileChip, { backgroundColor: previewFile?.uri === file.uri ? colors.primary : colors.background, borderColor: previewFile?.uri === file.uri ? colors.primary : colors.border }]}
              >
                <Text numberOfLines={1} style={[styles.previewFileChipText, { color: previewFile?.uri === file.uri ? "#fff" : colors.foreground }]}>{file.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        {previewFile && kind !== "id" ? (
          <Text numberOfLines={1} style={[styles.fileMeta, { color: colors.muted, textAlign: isArabic ? "right" : "left" }]}>{previewFile.name}</Text>
        ) : null}
        <View style={[styles.previewFrame, { height: isWideLayout ? 620 : 490, backgroundColor: colors.background, borderColor: colors.border }]}>
          {kind === "id" ? (
            <View style={[styles.idPreviewContent, { flexDirection: direction }]}>
              {idPreviewFace("front", frontUri, frontRotation)}
              {idPreviewFace("back", backUri, backRotation)}
            </View>
          ) : kind === "images" && files.length > 0 ? (
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator contentContainerStyle={styles.allImagesContent}>
              {files.map((file, index) => (
                <View key={file.uri} style={[styles.imagePreviewPage, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <Text numberOfLines={1} style={[styles.fileMeta, { color: colors.muted, textAlign: isArabic ? "right" : "left" }]}>{index + 1}. {file.name}</Text>
                  <Image
                    accessibilityLabel={tr(isArabic, `معاينة الصورة ${index + 1}: ${file.name}`, `Preview image ${index + 1}: ${file.name}`)}
                    source={{ uri: file.uri }}
                    resizeMode="contain"
                    style={[styles.previewImagePageImage, { height: isWideLayout ? 470 : 340 }, normalizeRotation(file.rotation) ? { transform: [{ rotate: `${normalizeRotation(file.rotation)}deg` }] } : null]}
                  />
                </View>
              ))}
            </ScrollView>
          ) : previewFile ? (
            previewFile.mimeType?.startsWith("image/") ? (
              <Image
                accessibilityLabel={tr(isArabic, `معاينة ${previewFile.name}`, `Preview ${previewFile.name}`)}
                source={{ uri: previewFile.uri }}
                resizeMode="contain"
                style={[styles.previewImage, normalizeRotation(previewFile.rotation) ? { transform: [{ rotate: `${normalizeRotation(previewFile.rotation)}deg` }] } : null]}
              />
            ) : (
              <PdfDocumentPreview uri={previewFile.uri} name={previewFile.name} isArabic={isArabic} style={styles.pdfPreview} unavailableLabel={tr(isArabic, "تعذرت المعاينة المضمنة لهذا الملف على هذا الجهاز.", "This file could not be previewed in the app on this device.")} />
            )
          ) : (
            <View style={styles.emptyFiles}>
              <MaterialIcons name="visibility" color={colors.muted} size={28} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>{tr(isArabic, "اختر ملفًا لعرض المعاينة الكاملة هنا", "Choose a file to see its full preview here")}</Text>
            </View>
          )}
        </View>
        {kind === "images" && files.length > 1 ? (
          <Text style={[styles.fileMeta, { color: colors.muted, textAlign: isArabic ? "right" : "left" }]}>{files.length} {tr(isArabic, "صور بالترتيب نفسه الذي سيظهر في PDF", "images in the same order used in the PDF")}</Text>
        ) : kind === "merge" && files.length > 1 ? (
          <Text style={[styles.fileMeta, { color: colors.muted, textAlign: isArabic ? "right" : "left" }]}>{tr(isArabic, "اختر ملفًا لمعاينة جميع صفحاته؛ ترتيب الدمج ظاهر في لوحة التعديل.", "Select a file to view all its pages; merge order is shown in the editing panel.")}</Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView testID="tool-workflow-screen" style={[styles.screen, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View testID="tool-workflow-header" style={[styles.header, { borderBottomColor: colors.border, flexDirection: direction }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={tr(isArabic, "رجوع مع الاحتفاظ بالملفات", "Back and keep files")} onPress={onBack} style={[styles.backButton, { borderColor: colors.border, flexDirection: direction }]}>
          <MaterialIcons name={isArabic ? "arrow-forward" : "arrow-back"} color={colors.foreground} size={20} />
          <Text style={[styles.backText, { color: colors.foreground }]}>{tr(isArabic, "رجوع", "Back")}</Text>
        </Pressable>
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.foreground, textAlign: isArabic ? "right" : "left" }]}>{title}</Text>
          <Text style={[styles.headerHint, { color: colors.muted, textAlign: isArabic ? "right" : "left" }]}>{tr(isArabic, "مساحة العمل · ملفاتك تبقى على جهازك", "Workspace · your files stay on this device")}</Text>
        </View>
        <View style={[styles.headerIcon, { backgroundColor: `${colors.primary}14` }]}>
          <MaterialIcons name={kind === "print" ? "print" : kind === "id" ? "badge" : kind === "pages" ? "view-list" : kind === "numbering" ? "format-list-numbered" : kind === "extract" ? "photo-filter" : kind === "images" ? "photo-library" : "merge-type"} color={colors.primary} size={20} />
        </View>
      </View>

      <View style={[styles.steps, { borderBottomColor: colors.border }]}>
        {[tr(isArabic, "الملفات", "Files"), tr(isArabic, "المعاينة", "Preview"), tr(isArabic, "الخيارات", "Options"), tr(isArabic, "النتيجة", "Result")].map((label, index) => (
          <View key={label} style={[styles.step, { flexDirection: direction }]}>
            <View style={[styles.stepNumber, { backgroundColor: index < completedSteps ? colors.primary : colors.border }]}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <Text numberOfLines={1} style={[styles.stepLabel, { color: colors.muted }]}>{label}</Text>
          </View>
        ))}
      </View>

      {error ? (
        <View style={[styles.errorCard, { flexDirection: direction }]}>
          <MaterialIcons name="error-outline" color="#B42332" size={21} />
          <View style={styles.errorCopy}>
            <Text style={[styles.errorTitle, { textAlign: isArabic ? "right" : "left" }]}>{error.title}</Text>
            <Text style={[styles.errorHint, { textAlign: isArabic ? "right" : "left" }]}>{error.hint}</Text>
          </View>
          <Pressable accessibilityLabel={tr(isArabic, "إغلاق التنبيه", "Dismiss error")} onPress={onDismissError}>
            <MaterialIcons name="close" color="#B42332" size={18} />
          </Pressable>
        </View>
      ) : null}

      <ScrollView style={styles.workflowScroll} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, isWideLayout ? styles.contentWide : null]} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} automaticallyAdjustKeyboardInsets>
        <View
          testID="workflow-columns"
          style={[styles.workspaceColumns, { flexDirection: isWideLayout ? (isArabic ? "row-reverse" : "row") : "column" }]}
        >
          {editorPane}
          {previewPane}
        </View>
        {activeResult ? (
          <View style={[styles.resultCard, { backgroundColor: `${colors.success}12`, borderColor: `${colors.success}55` }]}>
            <View style={[styles.resultHeader, { flexDirection: direction }]}>
              <MaterialIcons name="check-circle" color={colors.success} size={23} />
              <Text style={[styles.resultTitle, { color: colors.success, textAlign: isArabic ? "right" : "left" }]}>{activeResult.title}</Text>
            </View>
            {activeResult.detail ? <Text style={[styles.helper, { color: colors.foreground, textAlign: isArabic ? "right" : "left" }]}>{activeResult.detail}</Text> : null}
            {activeResult.uri ? <Text numberOfLines={2} style={[styles.fileMeta, { color: colors.muted, textAlign: isArabic ? "right" : "left" }]}>{activeResult.uri.split("/").pop()}</Text> : null}
            {activeResult.uri ? <Pressable onPress={onShareResult} style={[styles.secondaryButton, { borderColor: colors.primary, flexDirection: direction }]}><MaterialIcons name="share" color={colors.primary} size={17} /><Text style={[styles.secondaryButtonText, { color: colors.primary }]}>{tr(isArabic, "مشاركة / حفظ النتيجة", "Share / save result")}</Text></Pressable> : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Pressable disabled={!canRun || processing || idBusy} onPress={onRun} style={[styles.runButton, { backgroundColor: canRun && !processing && !idBusy ? colors.primary : colors.border, flexDirection: direction }]}>
          {processing || idBusy ? <ActivityIndicator color="#fff" size="small" /> : <MaterialIcons name={kind === "print" ? "print" : kind === "id" ? "picture-as-pdf" : "play-arrow"} color="#fff" size={20} />}
          <Text style={styles.pickButtonText}>{processing || idBusy ? tr(isArabic, "جارٍ التنفيذ…", "Working…") : runLabel}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0 },
  workflowScroll: { flex: 1, minHeight: 0 },
  header: { alignItems: "center", gap: 10, borderBottomWidth: 1, paddingHorizontal: 14, paddingVertical: 11 },
  backButton: { minHeight: 40, borderWidth: 1, borderRadius: 11, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 9 },
  backText: { fontSize: 12, fontWeight: "800" },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 16, fontWeight: "900" },
  headerHint: { fontSize: 9.5, marginTop: 2 },
  headerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  steps: { flexDirection: "row", gap: 4, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1 },
  errorCard: { marginHorizontal: 14, marginTop: 10, padding: 10, borderWidth: 1, borderColor: "#E7A4A9", borderRadius: 11, backgroundColor: "#FFF1F1", alignItems: "center", gap: 8 },
  errorCopy: { flex: 1, gap: 2 },
  errorTitle: { color: "#8E1C29", fontSize: 11, fontWeight: "900" },
  errorHint: { color: "#7C3B43", fontSize: 10, lineHeight: 15 },
  step: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  stepNumber: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  stepNumberText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  stepLabel: { fontSize: 8.5, fontWeight: "700" },
  content: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 11 },
  contentWide: { flexGrow: 1 },
  workspaceColumns: { gap: 12, alignItems: "stretch" },
  editorPane: { flex: 1, minWidth: 0, gap: 11 },
  previewPane: { flex: 1, minWidth: 0 },
  card: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 10 },
  previewCard: { flex: 1, minWidth: 0 },
  sectionTitleRow: { alignItems: "center", gap: 7 },
  sectionTitle: { flex: 1, fontSize: 13, fontWeight: "900" },
  helper: { fontSize: 10.5, lineHeight: 17 },
  pickButton: { minHeight: 43, alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 13, borderRadius: 12 },
  pickerOptionsRow: { gap: 7 },
  pickerOption: { flex: 1, minWidth: 0, paddingHorizontal: 6 },
  pickButtonText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  fileList: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 8 },
  bulkAction: { minHeight: 40, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center", gap: 7 },
  bulkActionText: { fontSize: 10.5, fontWeight: "900" },
  fileRow: { minHeight: 60, alignItems: "center", gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 6 },
  fileMain: { flex: 1, minWidth: 0, alignItems: "center", gap: 8 },
  fileIcon: { width: 36, height: 42, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  fileCopy: { flex: 1, minWidth: 0, gap: 3 },
  fileName: { fontSize: 10.5, fontWeight: "800" },
  fileMeta: { fontSize: 9, lineHeight: 14 },
  fileActions: { flexDirection: "row", alignItems: "center", gap: 0 },
  iconButton: { width: 26, height: 30, alignItems: "center", justifyContent: "center" },
  dragHandle: { width: 46, flexDirection: "row", gap: 1, borderRadius: 7 },
  fileDragLabel: { fontSize: 8, fontWeight: "900" },
  emptyFiles: { minHeight: 86, borderWidth: 1, borderStyle: "dashed", borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 6 },
  emptyText: { fontSize: 10.5, fontWeight: "700" },
  previewFrame: { minHeight: 320, borderWidth: 1, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  previewImage: { width: "100%", height: "100%" },
  pdfPreview: { width: "100%", height: "100%" },
  previewFilePicker: { alignItems: "center", gap: 6, paddingVertical: 2 },
  previewFileChip: { minHeight: 32, maxWidth: 200, borderWidth: 1, borderRadius: 9, paddingHorizontal: 9, alignItems: "center", justifyContent: "center" },
  previewFileChipText: { fontSize: 9.5, fontWeight: "800" },
  allImagesContent: { gap: 8, padding: 7 },
  imagePreviewPage: { borderWidth: 1, borderRadius: 10, padding: 7, gap: 5 },
  previewImagePageImage: { width: "100%" },
  idPreviewContent: { flex: 1, width: "100%", minHeight: 0, alignItems: "stretch", gap: 8, padding: 8 },
  idPreviewSide: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 10, padding: 7, alignItems: "center", justifyContent: "center", gap: 7 },
  idPreviewImage: { width: "100%", height: "86%" },
  pageEditList: { maxHeight: 380 },
  pageEditRows: { gap: 6 },
  pageEditRow: { minHeight: 52, borderWidth: 1, borderRadius: 10, paddingHorizontal: 5, paddingVertical: 4, alignItems: "center", gap: 4 },
  pageEditCopy: { flex: 1, minWidth: 0, gap: 2 },
  pageEditTitle: { fontSize: 9.5, fontWeight: "800" },
  pageEditMeta: { fontSize: 8.5 },
  pageEditActions: { flexDirection: "row", alignItems: "center", gap: 1 },
  pageDragHandle: { height: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 1, borderRadius: 7, paddingHorizontal: 4 },
  pageDragLabel: { fontSize: 8, fontWeight: "900" },
  pageActionButton: { width: 25, height: 32, alignItems: "center", justifyContent: "center" },
  notice: { alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 11, padding: 9 },
  noticeText: { flex: 1, fontSize: 10, lineHeight: 15, fontWeight: "700" },
  pillRow: { flexWrap: "wrap", gap: 7 },
  pill: { minHeight: 34, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, borderRadius: 10, borderWidth: 1 },
  pillText: { fontSize: 10, fontWeight: "800" },
  field: { flex: 1, minWidth: 72, gap: 5 },
  fieldLabel: { fontSize: 9.5, fontWeight: "700" },
  fieldsRow: { gap: 8 },
  input: { minHeight: 39, borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, fontSize: 11, fontWeight: "700" },
  toggle: { minHeight: 38, borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, alignItems: "center", gap: 7 },
  toggleText: { flex: 1, fontSize: 10.5, fontWeight: "800" },
  facesRow: { gap: 9 },
  faceCard: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 8, alignItems: "stretch", gap: 6 },
  faceTitle: { fontSize: 10, fontWeight: "800", textAlign: "center" },
  secondaryButton: { minHeight: 36, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 8 },
  secondaryButtonText: { fontSize: 10, fontWeight: "800" },
  resultCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  resultHeader: { alignItems: "center", gap: 7 },
  resultTitle: { flex: 1, fontSize: 12, fontWeight: "900" },
  footer: { borderTopWidth: 1, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 10 },
  runButton: { minHeight: 46, borderRadius: 13, alignItems: "center", justifyContent: "center", gap: 7 },
});
