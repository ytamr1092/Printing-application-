import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { PdfDocumentPreview } from "@/components/pdf-document-preview";
import { useColors } from "@/hooks/use-colors";
import { paperOptions } from "@/shared/print-options";
import type { PreviewKind } from "@/shared/preview";

type WorkflowFile = {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
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
  pageCount?: number;
  settings: Record<string, string | boolean>;
  result: WorkflowResult | null;
  error: { title: string; hint: string } | null;
  processing: boolean;
  idBusy: boolean;
  canRun: boolean;
  onBack: () => void;
  onPickFiles: () => void;
  onPickIdFace: (side: "front" | "back", source?: "library" | "camera") => void;
  onScanIdFace: (side: "front" | "back") => void;
  onSelectPreviewFile: (file: WorkflowFile) => void;
  onMoveFile: (from: number, to: number) => void;
  onRemoveFile: (index: number) => void;
  onSettingChange: (key: string, value: string | boolean) => void;
  onRun: () => void;
  onShareResult: () => void;
  onDismissError: () => void;
};

const tr = (isArabic: boolean, ar: string, en: string) =>
  isArabic ? ar : en;

export function ToolWorkflowScreen({
  kind,
  title,
  isArabic,
  files,
  previewFile,
  frontUri,
  backUri,
  pageCount,
  settings,
  result,
  error,
  processing,
  idBusy,
  canRun,
  onBack,
  onPickFiles,
  onPickIdFace,
  onScanIdFace,
  onSelectPreviewFile,
  onMoveFile,
  onRemoveFile,
  onSettingChange,
  onRun,
  onShareResult,
  onDismissError,
}: Props) {
  const colors = useColors();
  const direction = isArabic ? "row-reverse" : "row";
  const formatBytes = (size?: number) => {
    if (!size || size <= 0) return "";
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };
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
        <View style={[styles.facePreview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {uri ? <Image source={{ uri }} resizeMode="contain" style={styles.faceImage} /> : <MaterialIcons name="add-photo-alternate" color={colors.muted} size={28} />}
        </View>
        <Text style={[styles.faceTitle, { color: colors.foreground }]}>{label}</Text>
        <Pressable onPress={() => onPickIdFace(side, "library")} style={[styles.secondaryButton, { borderColor: colors.primary, flexDirection: direction }]}>
          <MaterialIcons name="photo-library" color={colors.primary} size={17} />
          <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>{tr(isArabic, uri ? "تغيير الصورة" : "اختيار صورة", uri ? "Change image" : "Choose image")}</Text>
        </Pressable>
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

  return (
    <View testID="tool-workflow-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {sectionTitle(kind === "id" ? tr(isArabic, "اختر وجهي البطاقة", "Choose both card sides") : tr(isArabic, "اختيار الملفات", "Choose files"), "folder-open")}
          {kind === "id" ? (
            <View style={[styles.facesRow, { flexDirection: direction }]}>{face("front", frontUri)}{face("back", backUri)}</View>
          ) : (
            <>
              <Text style={[styles.helper, { color: colors.muted, textAlign: isArabic ? "right" : "left" }]}>{tr(isArabic, "ابدأ باختيار الملف أو الملفات. يمكنك الرجوع لهذه الشاشة لاحقًا دون فقدان اختيارك.", "Choose one or more files to get started. You can return here later without losing your selection.")}</Text>
              <Pressable onPress={onPickFiles} style={[styles.pickButton, { backgroundColor: colors.primary, flexDirection: direction }]}>
                <MaterialIcons name="add" color="#fff" size={20} />
                <Text style={styles.pickButtonText}>{files.length ? tr(isArabic, "تغيير الملفات", "Change files") : tr(isArabic, "اختيار الملفات", "Choose files")}</Text>
              </Pressable>
              {files.length > 0 ? (
                <View style={[styles.fileList, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  {files.map((file, index) => {
                    const selected = previewFile?.uri === file.uri;
                    return (
                      <View key={`${file.uri}-${index}`} style={[styles.fileRow, { borderBottomColor: colors.border, flexDirection: direction }]}>
                        <Pressable onPress={() => onSelectPreviewFile(file)} style={[styles.fileMain, { flexDirection: direction }]}>
                          {file.mimeType?.startsWith("image/") ? <Image source={{ uri: file.uri }} style={styles.fileThumb} /> : <View style={[styles.fileIcon, { backgroundColor: `${colors.primary}12` }]}><MaterialIcons name="picture-as-pdf" color={colors.primary} size={19} /></View>}
                          <View style={styles.fileCopy}>
                            <Text numberOfLines={1} style={[styles.fileName, { color: selected ? colors.primary : colors.foreground, textAlign: isArabic ? "right" : "left" }]}>{file.name}</Text>
                            <Text style={[styles.fileMeta, { color: colors.muted, textAlign: isArabic ? "right" : "left" }]}>{formatBytes(file.size) || file.mimeType || tr(isArabic, "اضغط لمعاينة الملف", "Tap to preview")}</Text>
                          </View>
                        </Pressable>
                        {(kind === "merge" || kind === "images") && (
                          <View style={styles.fileActions}>
                            <Pressable accessibilityLabel={tr(isArabic, "تحريك لأعلى", "Move up")} disabled={index === 0} onPress={() => onMoveFile(index, index - 1)} style={styles.iconButton}><MaterialIcons name="keyboard-arrow-up" color={index === 0 ? colors.border : colors.muted} size={21} /></Pressable>
                            <Pressable accessibilityLabel={tr(isArabic, "تحريك لأسفل", "Move down")} disabled={index === files.length - 1} onPress={() => onMoveFile(index, index + 1)} style={styles.iconButton}><MaterialIcons name="keyboard-arrow-down" color={index === files.length - 1 ? colors.border : colors.muted} size={21} /></Pressable>
                            <Pressable accessibilityLabel={tr(isArabic, "إزالة الملف", "Remove file")} onPress={() => onRemoveFile(index)} style={styles.iconButton}><MaterialIcons name="close" color={colors.error} size={18} /></Pressable>
                          </View>
                        )}
                      </View>
                    );
                  })}
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

        {kind !== "id" && previewFile ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {sectionTitle(tr(isArabic, "معاينة الملف المختار", "Selected file preview"), "visibility")}
            <View style={[styles.previewFrame, { backgroundColor: colors.background, borderColor: colors.border }]}>
              {previewFile.mimeType?.startsWith("image/") ? <Image source={{ uri: previewFile.uri }} resizeMode="contain" style={styles.previewImage} /> : <PdfDocumentPreview uri={previewFile.uri} name={previewFile.name} style={styles.pdfPreview} unavailableLabel={tr(isArabic, "تعذرت المعاينة المضمنة لهذا الملف على هذا الجهاز.", "This file could not be previewed in the app on this device.")} />}
            </View>
          </View>
        ) : null}

        {(kind === "merge" || kind === "images") && files.length > 1 ? (
          <View style={[styles.notice, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}30`, flexDirection: direction }]}>
            <MaterialIcons name="drag-indicator" color={colors.primary} size={18} />
            <Text style={[styles.noticeText, { color: colors.primary, textAlign: isArabic ? "right" : "left" }]}>{tr(isArabic, "رتّب الملفات بالأسهم؛ هذا هو ترتيبها في الناتج.", "Use the arrows to set the order used in the output.")}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0 },
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
  card: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 10 },
  sectionTitleRow: { alignItems: "center", gap: 7 },
  sectionTitle: { flex: 1, fontSize: 13, fontWeight: "900" },
  helper: { fontSize: 10.5, lineHeight: 17 },
  pickButton: { minHeight: 43, alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 13, borderRadius: 12 },
  pickButtonText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  fileList: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 8 },
  fileRow: { minHeight: 56, alignItems: "center", gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 6 },
  fileMain: { flex: 1, minWidth: 0, alignItems: "center", gap: 8 },
  fileThumb: { width: 36, height: 42, borderRadius: 7, backgroundColor: "#fff" },
  fileIcon: { width: 36, height: 42, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  fileCopy: { flex: 1, minWidth: 0, gap: 3 },
  fileName: { fontSize: 10.5, fontWeight: "800" },
  fileMeta: { fontSize: 9, lineHeight: 14 },
  fileActions: { flexDirection: "row", alignItems: "center", gap: 0 },
  iconButton: { width: 26, height: 30, alignItems: "center", justifyContent: "center" },
  emptyFiles: { minHeight: 86, borderWidth: 1, borderStyle: "dashed", borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 6 },
  emptyText: { fontSize: 10.5, fontWeight: "700" },
  previewFrame: { height: 300, borderWidth: 1, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  previewImage: { width: "100%", height: "100%" },
  pdfPreview: { width: "100%", height: "100%" },
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
  facePreview: { height: 112, borderWidth: 1, borderRadius: 9, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  faceImage: { width: "100%", height: "100%" },
  faceTitle: { fontSize: 10, fontWeight: "800", textAlign: "center" },
  secondaryButton: { minHeight: 36, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 8 },
  secondaryButtonText: { fontSize: 10, fontWeight: "800" },
  resultCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  resultHeader: { alignItems: "center", gap: 7 },
  resultTitle: { flex: 1, fontSize: 12, fontWeight: "900" },
  footer: { borderTopWidth: 1, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 10 },
  runButton: { minHeight: 46, borderRadius: 13, alignItems: "center", justifyContent: "center", gap: 7 },
});
