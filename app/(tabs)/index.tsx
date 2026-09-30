import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
// pdf-lib's bundled ESM build avoids Metro's CommonJS/tslib interop issue.
// @ts-expect-error The package does not expose a declaration for this bundled entry.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib/dist/pdf-lib.esm.js";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useThemeContext } from "@/lib/theme-provider";
import { canMergePdfs, findJpegByteRanges, hasAtLeastFiles } from "@/shared/file-operations";
import { paperOptions, paperPresetById } from "@/shared/print-options";

type Language = "ar" | "en";

const copy = {
  ar: {
    greeting: "مرحبًا بك في",
    appName: "PrintPilot",
    subtitle: "مركزك الذكي للطباعة والمستندات",
    offline: "يعمل دون إنترنت",
    language: "EN",
    theme: "الوضع الداكن",
    quick: "إجراءات سريعة",
    merge: "دمج PDF",
    mergeHint: "اجمع ملفاتك في ملف واحد",
    images: "صور إلى PDF",
    imagesHint: "حوّل الصور إلى مستند",
    extract: "استخراج الصور",
    extractHint: "استخرج الصور من PDF",
    scan: "مسح ضوئي",
    scanHint: "Kyocera TASKalfa 306ci",
    print: "طباعة جديدة",
    printHint: "معاينة وإعدادات كاملة",
    recent: "آخر الملفات",
    viewAll: "عرض الكل",
    file1: "شهادات التدريب — دفعة سبتمبر.pdf",
    file2: "مستندات العميل — 12 صفحة.pdf",
    file3: "صور الهوية — ملف موحد.pdf",
    today: "اليوم، 10:24 ص",
    yesterday: "أمس، 04:18 م",
    paper: "إعدادات الورق والطباعة",
    format: "حجم الصفحة",
    weight: "وزن الورق",
    orientation: "الاتجاه",
    portrait: "طولي",
    landscape: "عرضي",
    copies: "عدد النسخ",
    certificatePreset: "قالب الشهادة",
    certificateHint: "هوامش آمنة وورق سميك",
    printer: "الطابعة المتصلة",
    printerName: "Kyocera TASKalfa 306ci",
    network: "متصلة عبر الشبكة المحلية",
    chooseFile: "اختيار ملفات",
    selected: "ملفات محددة",
    openPrint: "فتح واجهة الطباعة",
    smart: "المساعد الذكي",
    smartHint: "اختياري — مغلق افتراضيًا ويحافظ على ملفاتك محليًا",
    smartAction: "استخدم الذكاء الاصطناعي عند الحاجة",
    ready: "جاهز للعمل",
    placeholder: "اكتب أمرًا مثل: ادمج الملفين ورقّم الصفحات...",
    execute: "تنفيذ",
    noInternet: "الذكاء الاصطناعي المحلي متاح دون إنترنت",
    roadmap: "مراحل التطوير القادمة",
    roadmapHint: "نطوّر البرنامج خطوة بخطوة بدون تعقيد",
    stage1: "المرحلة 1 · إدارة الملفات",
    stage1Hint: "دمج PDF، تحويل الصور، ترتيب وحذف الصفحات",
    stage2: "المرحلة 2 · الطباعة والمسح",
    stage2Hint: "ربط Kyocera، المسح الشبكي، المعاينة المتقدمة",
    stage3: "المرحلة 3 · الخصوصية والتنظيم",
    stage3Hint: "كلمات مرور، نسخ احتياطي، سجل العمليات",
    stage4: "المرحلة 4 · الذكاء الاصطناعي المحلي",
    stage4Hint: "OCR عربي/إنجليزي وتحسين المستندات دون إنترنت",
    errorTitle: "تعذر تنفيذ العملية",
    dismiss: "إغلاق",
    retry: "إعادة المحاولة",
    scanUnavailable: "لم يتم العثور على الماسح",
    scanUnavailableHint: "تأكد من تشغيل Kyocera TASKalfa 306ci واتصال الهاتف بنفس الشبكة المحلية.",
    printerUnavailable: "الطابعة غير متصلة",
    printerUnavailableHint: "تحقق من الشبكة أو اختر طابعة من إعدادات Android.",
    pickerCancelled: "لم يتم اختيار أي ملف",
    pickerCancelledHint: "اختر ملفًا واحدًا على الأقل ثم حاول مرة أخرى.",
    mergeNeedTwo: "اختر ملفي PDF أو أكثر للدمج.",
    mergeSuccess: "تم دمج ملفات PDF بنجاح",
    mergeFailed: "تعذر دمج ملفات PDF",
    shareResult: "مشاركة الملف الناتج",
    imagesNeedOne: "اختر صورة واحدة على الأقل.",
    imagesSuccess: "تم تحويل الصور إلى PDF بنجاح",
    imagesFailed: "تعذر تحويل الصور إلى PDF",
    numbering: "ترقيم PDF",
    numberingHint: "أضف رقمًا لكل صفحة",
    numberingNeedOne: "اختر ملف PDF واحدًا على الأقل.",
    numberingSuccess: "تم ترقيم صفحات PDF بنجاح",
    numberingFailed: "تعذر ترقيم صفحات PDF",
    extractSuccess: "تم استخراج الصور من PDF",
    extractNone: "لم يتم العثور على صور JPEG داخل الملف",
    extractFailed: "تعذر استخراج الصور من PDF",
    phase2: "المرحلة الثانية · الطباعة والمسح",
    phase2Hint: "حالة الأجهزة ومدير المهام",
    phase3: "المرحلة الثالثة · الخصوصية والتنظيم",
    phase3Hint: "نسخ احتياطي وحماية وسجل عمليات محلي",
    deviceStatus: "حالة الأجهزة",
    notChecked: "لم يتم التحقق بعد",
    taskManager: "مدير المهام",
    noTasks: "لا توجد مهام معلقة",
    checkDevices: "فحص الأجهزة",
    backup: "النسخ الاحتياطي المحلي",
    backupHint: "احفظ نسخة على مجلد تختاره دون رفع الملفات للإنترنت",
    passwords: "حماية ملفات PDF",
    passwordsHint: "إضافة كلمة مرور قبل الحفظ",
    history: "سجل العمليات",
    historyHint: "آخر العمليات التي نفذها البرنامج",
    picked: "تم اختيار الملفات",
    printReady: "تم تجهيز معاينة الطباعة",
    coming: "سيتم ربط هذه الوظيفة في الإصدار التالي. الواجهة جاهزة لها.",
  },
  en: {
    greeting: "Welcome to",
    appName: "PrintPilot",
    subtitle: "Your smart printing & document desk",
    offline: "Works offline",
    language: "ع",
    theme: "Dark mode",
    quick: "Quick actions",
    merge: "Merge PDF",
    mergeHint: "Combine files into one",
    images: "Images to PDF",
    imagesHint: "Turn photos into a document",
    extract: "Extract images",
    extractHint: "Pull images from a PDF",
    scan: "Scan",
    scanHint: "Kyocera TASKalfa 306ci",
    print: "New print",
    printHint: "Preview & full settings",
    recent: "Recent files",
    viewAll: "View all",
    file1: "Training certificates — September.pdf",
    file2: "Client documents — 12 pages.pdf",
    file3: "ID photos — combined.pdf",
    today: "Today, 10:24 AM",
    yesterday: "Yesterday, 04:18 PM",
    paper: "Paper & print settings",
    format: "Page size",
    weight: "Paper weight",
    orientation: "Orientation",
    portrait: "Portrait",
    landscape: "Landscape",
    copies: "Copies",
    certificatePreset: "Certificate preset",
    certificateHint: "Safe margins & thick stock",
    printer: "Connected printer",
    printerName: "Kyocera TASKalfa 306ci",
    network: "Connected over local network",
    chooseFile: "Choose files",
    selected: "selected files",
    openPrint: "Open print dialog",
    smart: "Smart assistant",
    smartHint: "Optional — off by default, files stay local",
    smartAction: "Use AI when needed",
    ready: "Ready to work",
    placeholder: "Try: merge the files and number the pages...",
    execute: "Run",
    noInternet: "On-device AI is available without internet",
    roadmap: "Next development stages",
    roadmapHint: "We build it step by step, without unnecessary complexity",
    stage1: "Stage 1 · File management",
    stage1Hint: "Merge PDF, images to PDF, reorder and delete pages",
    stage2: "Stage 2 · Print & scan",
    stage2Hint: "Kyocera connection, network scan, advanced preview",
    stage3: "Stage 3 · Privacy & organization",
    stage3Hint: "Passwords, backups, operation history",
    stage4: "Stage 4 · On-device AI",
    stage4Hint: "Arabic/English OCR and offline document enhancement",
    errorTitle: "Operation could not be completed",
    dismiss: "Close",
    retry: "Try again",
    scanUnavailable: "Scanner not found",
    scanUnavailableHint: "Make sure the Kyocera TASKalfa 306ci is on and your phone is on the same local network.",
    printerUnavailable: "Printer is not connected",
    printerUnavailableHint: "Check the network or choose a printer from Android settings.",
    pickerCancelled: "No file selected",
    pickerCancelledHint: "Choose at least one file and try again.",
    mergeNeedTwo: "Choose two or more PDF files to merge.",
    mergeSuccess: "PDF files merged successfully",
    mergeFailed: "PDF merge failed",
    shareResult: "Share the result",
    imagesNeedOne: "Choose at least one image.",
    imagesSuccess: "Images converted to PDF successfully",
    imagesFailed: "Image to PDF conversion failed",
    numbering: "Number PDF",
    numberingHint: "Add a number to every page",
    numberingNeedOne: "Choose at least one PDF file.",
    numberingSuccess: "PDF pages numbered successfully",
    numberingFailed: "PDF numbering failed",
    extractSuccess: "Images extracted from PDF",
    extractNone: "No JPEG images were found inside the file",
    extractFailed: "PDF image extraction failed",
    phase2: "Stage 2 · Print & scan",
    phase2Hint: "Device status and task manager",
    phase3: "Stage 3 · Privacy & organization",
    phase3Hint: "Local backups, protection and activity history",
    deviceStatus: "Device status",
    notChecked: "Not checked yet",
    taskManager: "Task manager",
    noTasks: "No pending tasks",
    checkDevices: "Check devices",
    backup: "Local backup",
    backupHint: "Save a copy to a folder without uploading files",
    passwords: "PDF protection",
    passwordsHint: "Add a password before saving",
    history: "Activity history",
    historyHint: "Recent operations performed by the app",
    picked: "Files selected",
    printReady: "Print preview prepared",
    coming: "This function will be connected in the next release. The UI is ready.",
  },
} as const;

function Icon({ name, color, size = 22 }: { name: React.ComponentProps<typeof MaterialIcons>["name"]; color: string; size?: number }) {
  return <MaterialIcons name={name} color={color} size={size} />;
}

function ActionCard({ icon, title, hint, color, textColor, mutedColor, onPress }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; title: string; hint: string; color: string; textColor: string; mutedColor: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionCard, { backgroundColor: color + "14" }, pressed && styles.pressed]}>
      <View style={[styles.actionIcon, { backgroundColor: color + "22" }]}><Icon name={icon} color={color} size={23} /></View>
      <Text style={[styles.actionTitle, { color: textColor }]}>{title}</Text>
      <Text style={[styles.actionHint, { color: mutedColor }]} numberOfLines={1}>{hint}</Text>
    </Pressable>
  );
}

function FileRow({ name, time, icon, colors, onPress }: { name: string; time: string; icon: React.ComponentProps<typeof MaterialIcons>["name"]; colors: ReturnType<typeof useColors>; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.fileRow, { borderBottomColor: colors.border }, pressed && styles.rowPressed]}>
      <View style={[styles.fileIcon, { backgroundColor: colors.primary + "16" }]}><Icon name={icon} color={colors.primary} size={21} /></View>
      <View style={styles.fileInfo}><Text style={[styles.fileName, { color: colors.foreground }]} numberOfLines={1}>{name}</Text><Text style={[styles.fileTime, { color: colors.muted }]}>{time}</Text></View>
      <Icon name="more-vert" color={colors.muted} size={21} />
    </Pressable>
  );
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob ? globalThis.atob(base64) : Buffer.from(base64, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return globalThis.btoa ? globalThis.btoa(binary) : Buffer.from(binary, "binary").toString("base64");
}

export default function HomeScreen() {
  const [language, setLanguage] = useState<Language>("ar");
  const [selectedPaper, setSelectedPaper] = useState("certificate");
  const [selectedWeight, setSelectedWeight] = useState("200 g/m²");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [copies, setCopies] = useState("1");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [command, setCommand] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<{ title: string; hint: string } | null>(null);
  const [deviceChecked, setDeviceChecked] = useState(false);
  const [deviceMessage, setDeviceMessage] = useState<"unknown" | "not-found">("unknown");
  const [tasks, setTasks] = useState<string[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const { colorScheme, setColorScheme } = useThemeContext();
  const colors = useColors();
  const isArabic = language === "ar";
  const t = copy[language];
  const readableText = colorScheme === "dark" ? "#F3F8FC" : "#071A2B";
  const readableMuted = colorScheme === "dark" ? "#B7C8D8" : "#4B6377";
  const paper = useMemo(() => paperPresetById(selectedPaper), [selectedPaper]);

  useEffect(() => {
    AsyncStorage.getItem("printpilot.activity.v1").then((stored) => {
      if (stored) setTasks(JSON.parse(stored) as string[]);
      setHistoryReady(true);
    }).catch(() => setHistoryReady(true));
  }, []);

  useEffect(() => {
    if (historyReady) AsyncStorage.setItem("printpilot.activity.v1", JSON.stringify(tasks)).catch(() => undefined);
  }, [historyReady, tasks]);

  const showError = (title: string, hint: string) => setErrorMessage({ title, hint });

  const chooseFiles = async (type: string | string[]) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type, multiple: true, copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) {
        showError(t.pickerCancelled, t.pickerCancelledHint);
        return;
      }
      setSelectedFiles(result.assets.map((asset) => asset.name));
      setTasks((current) => [`${t.picked}: ${result.assets.length}`, ...current].slice(0, 4));
      Alert.alert(t.picked, `${result.assets.length} ${t.selected}`);
    } catch {
      showError(t.errorTitle, t.pickerCancelledHint);
    }
  };

  const mergePdfs = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", multiple: true, copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) {
        showError(t.pickerCancelled, t.pickerCancelledHint);
        return;
      }
      if (!canMergePdfs(result.assets.length)) {
        showError(t.mergeNeedTwo, t.mergeNeedTwo);
        return;
      }
      const merged = await PDFDocument.create();
      for (const asset of result.assets) {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
        const source = await PDFDocument.load(base64ToBytes(base64));
        const pages = await merged.copyPages(source, source.getPageIndices());
        pages.forEach((page: any) => merged.addPage(page));
      }
      const mergedBase64 = bytesToBase64(await merged.save());
      const outputUri = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}PrintPilot-Merged-${Date.now()}.pdf`;
      await FileSystem.writeAsStringAsync(outputUri, mergedBase64, { encoding: FileSystem.EncodingType.Base64 });
      setSelectedFiles(result.assets.map((asset) => asset.name));
      setTasks((current) => [`${t.mergeSuccess}: ${result.assets.length}`, ...current].slice(0, 4));
      setErrorMessage(null);
      Alert.alert(t.mergeSuccess, outputUri, [{ text: t.dismiss, style: "cancel" }, { text: t.shareResult, onPress: async () => {
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(outputUri, { mimeType: "application/pdf", dialogTitle: t.shareResult });
        else showError(t.errorTitle, t.printerUnavailableHint);
      } }]);
    } catch {
      showError(t.mergeFailed, t.coming);
    }
  };

  const imagesToPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "image/*", multiple: true, copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length || !hasAtLeastFiles(result.assets.length)) {
        showError(t.imagesNeedOne, t.imagesNeedOne);
        return;
      }
      const imageMarkup = await Promise.all(result.assets.map(async (asset) => {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
        const mime = asset.mimeType || "image/jpeg";
        return `<section><img src="data:${mime};base64,${base64}" /></section>`;
      }));
      const html = `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"/><style>@page{margin:0}body{margin:0;background:#fff}section{page-break-after:always;width:100%;height:100vh;display:flex;align-items:center;justify-content:center}section:last-child{page-break-after:auto}img{max-width:100%;max-height:100%;object-fit:contain}</style></head><body>${imageMarkup.join("")}</body></html>`;
      const generated = await Print.printToFileAsync({ html, width: 794, height: 1123 });
      const outputUri = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}PrintPilot-Images-${Date.now()}.pdf`;
      await FileSystem.copyAsync({ from: generated.uri, to: outputUri });
      setSelectedFiles(result.assets.map((asset) => asset.name));
      setTasks((current) => [`${t.imagesSuccess}: ${result.assets.length}`, ...current].slice(0, 4));
      setErrorMessage(null);
      Alert.alert(t.imagesSuccess, outputUri, [{ text: t.dismiss, style: "cancel" }, { text: t.shareResult, onPress: async () => {
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(outputUri, { mimeType: "application/pdf", dialogTitle: t.shareResult });
        else showError(t.errorTitle, t.printerUnavailableHint);
      } }]);
    } catch {
      showError(t.imagesFailed, t.coming);
    }
  };

  const numberPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", multiple: false, copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) {
        showError(t.numberingNeedOne, t.pickerCancelledHint);
        return;
      }
      const sourceBase64 = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
      const document = await PDFDocument.load(base64ToBytes(sourceBase64));
      const font = await document.embedFont(StandardFonts.Helvetica);
      const pages = document.getPages();
      pages.forEach((page: any, index: number) => {
        const { width } = page.getSize();
        const label = `${index + 1} / ${pages.length}`;
        const labelWidth = font.widthOfTextAtSize(label, 9);
        page.drawText(label, { x: (width - labelWidth) / 2, y: 16, size: 9, font, color: rgb(0.32, 0.39, 0.45) });
      });
      const outputUri = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}PrintPilot-Numbered-${Date.now()}.pdf`;
      await FileSystem.writeAsStringAsync(outputUri, bytesToBase64(await document.save()), { encoding: FileSystem.EncodingType.Base64 });
      setSelectedFiles([result.assets[0].name]);
      setTasks((current) => [`${t.numberingSuccess}: ${pages.length}`, ...current].slice(0, 4));
      setErrorMessage(null);
      Alert.alert(t.numberingSuccess, outputUri, [{ text: t.dismiss, style: "cancel" }, { text: t.shareResult, onPress: async () => {
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(outputUri, { mimeType: "application/pdf", dialogTitle: t.shareResult });
        else showError(t.errorTitle, t.printerUnavailableHint);
      } }]);
    } catch {
      showError(t.numberingFailed, t.coming);
    }
  };

  const extractImages = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", multiple: false, copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) {
        showError(t.pickerCancelled, t.pickerCancelledHint);
        return;
      }
      const sourceBase64 = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
      const sourceBytes = base64ToBytes(sourceBase64);
      const ranges = findJpegByteRanges(sourceBytes);
      if (!ranges.length) {
        showError(t.extractNone, t.extractNone);
        return;
      }
      const outputUris: string[] = [];
      for (const [index, range] of ranges.entries()) {
        const outputUri = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}PrintPilot-Image-${Date.now()}-${String(index + 1).padStart(2, "0")}.jpg`;
        await FileSystem.writeAsStringAsync(outputUri, bytesToBase64(sourceBytes.slice(range.start, range.end)), { encoding: FileSystem.EncodingType.Base64 });
        outputUris.push(outputUri);
      }
      setSelectedFiles([result.assets[0].name]);
      setTasks((current) => [`${t.extractSuccess}: ${outputUris.length}`, ...current].slice(0, 4));
      setErrorMessage(null);
      Alert.alert(t.extractSuccess, `${outputUris.length} JPG`, [{ text: t.dismiss, style: "cancel" }, { text: t.shareResult, onPress: async () => {
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(outputUris[0], { mimeType: "image/jpeg", dialogTitle: t.shareResult });
        else showError(t.errorTitle, t.printerUnavailableHint);
      } }]);
    } catch {
      showError(t.extractFailed, t.coming);
    }
  };

  const openPrintDialog = async () => {
    try {
      const width = orientation === "portrait" ? 794 : 1123;
      const height = orientation === "portrait" ? 1123 : 794;
      await Print.printAsync({
        html: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"/><style>@page{size:${paper.size};margin:18mm}body{font-family:Arial;color:#10233f;text-align:center;padding-top:28%;}h1{font-size:30px}p{font-size:16px;color:#527087}</style></head><body><h1>${isArabic ? "معاينة شهادة PrintPilot" : "PrintPilot Certificate Preview"}</h1><p>${paper.ar} · ${selectedWeight} · ${copies} ${isArabic ? "نسخة" : "copies"}</p></body></html>`,
        width,
        height,
        orientation: orientation === "portrait" ? Print.Orientation.portrait : Print.Orientation.landscape,
        margins: { top: 18, bottom: 18, left: 18, right: 18 },
      });
      setTasks((current) => [`${t.printReady}: ${paper.size} · ${selectedWeight}`, ...current].slice(0, 4));
      Alert.alert(t.printReady, `${paper.size} · ${selectedWeight}`);
    } catch {
      showError(t.printerUnavailable, t.printerUnavailableHint);
    }
  };

  const actionComing = () => showError(t.errorTitle, t.coming);
  const scanForDevices = () => {
    setDeviceChecked(true);
    setDeviceMessage("not-found");
    showError(t.scanUnavailable, t.scanUnavailableHint);
  };

  return (
    <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 14, paddingBottom: 34 }}>
        <View style={[styles.header, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
          <View style={[styles.brandBlock, { alignItems: isArabic ? "flex-end" : "flex-start" }]}>
            <Text style={[styles.eyebrow, { color: colors.muted }]}>{t.greeting}</Text>
            <View style={{ flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 8 }}>
              <View style={[styles.brandMark, { backgroundColor: colors.primary }]}><Icon name="print" color="#fff" size={20} /></View>
              <Text style={[styles.brandName, { color: colors.foreground }]}>{t.appName}</Text>
            </View>
            <Text style={[styles.subtitle, { color: colors.muted }]}>{t.subtitle}</Text>
          </View>
          <View style={[styles.headerTools, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
            <Pressable onPress={() => setLanguage(isArabic ? "en" : "ar")} style={[styles.toolButton, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.langText, { color: colors.primary }]}>{t.language}</Text></Pressable>
            <Pressable onPress={() => setColorScheme(colorScheme === "dark" ? "light" : "dark")} style={[styles.toolButton, { backgroundColor: colors.surface, borderColor: colors.border }]}><Icon name={colorScheme === "dark" ? "light-mode" : "dark-mode"} color={colors.foreground} size={20} /></Pressable>
          </View>
        </View>

        <View style={[styles.offlineBanner, { backgroundColor: colors.success + "14", borderColor: colors.success + "35", flexDirection: isArabic ? "row-reverse" : "row" }]}>
          <Icon name="wifi-off" color={colors.success} size={18} />
          <Text style={[styles.offlineText, { color: colors.success }]}>{t.offline}</Text>
          <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
        </View>

        {errorMessage && <View style={[styles.errorBanner, { backgroundColor: colorScheme === "dark" ? "#3A2026" : "#FFF1F1", borderColor: colorScheme === "dark" ? "#A94B5C" : "#E7A4A9", flexDirection: isArabic ? "row-reverse" : "row" }]}><Icon name="error-outline" color={colorScheme === "dark" ? "#FF9AAA" : "#B42332"} size={21} /><View style={styles.errorCopy}><Text style={[styles.errorTitle, { color: colorScheme === "dark" ? "#FFD9DE" : "#8E1C29", textAlign: isArabic ? "right" : "left" }]}>{errorMessage.title}</Text><Text style={[styles.errorHint, { color: colorScheme === "dark" ? "#F4BFC7" : "#7C3B43", textAlign: isArabic ? "right" : "left" }]}>{errorMessage.hint}</Text></View><Pressable onPress={() => setErrorMessage(null)}><Icon name="close" color={colorScheme === "dark" ? "#FFB2BF" : "#8E1C29"} size={19} /></Pressable></View>}

        <View style={[styles.hero, { backgroundColor: colors.primary, flexDirection: isArabic ? "row-reverse" : "row" }]}>
          <View style={[styles.heroCopy, { alignItems: isArabic ? "flex-end" : "flex-start" }]}>
            <Text style={styles.heroKicker}>{t.ready}</Text>
            <Text style={styles.heroTitle}>{isArabic ? "أنجز مستندك\nبثقة" : "Finish your document\nwith confidence"}</Text>
            <Text style={styles.heroDescription}>{isArabic ? "طباعة، مسح، تنظيم — في مكان واحد." : "Print, scan, organize — all in one place."}</Text>
          </View>
          <View style={styles.heroArt}><Icon name="description" color="#fff" size={66} /><View style={styles.heroArtBadge}><Icon name="check" color={colors.primary} size={17} /></View></View>
        </View>

        <SectionTitle title={t.quick} colors={colors} />
        <View style={styles.actionsGrid}>
          <ActionCard icon="merge-type" title={t.merge} hint={t.mergeHint} color="#0A7EA4" textColor={readableText} mutedColor={readableMuted} onPress={mergePdfs} />
          <ActionCard icon="photo-library" title={t.images} hint={t.imagesHint} color="#8B5CF6" textColor={readableText} mutedColor={readableMuted} onPress={imagesToPdf} />
          <ActionCard icon="photo-filter" title={t.extract} hint={t.extractHint} color="#F59E0B" textColor={readableText} mutedColor={readableMuted} onPress={() => chooseFiles("application/pdf")} />
          <ActionCard icon="document-scanner" title={t.scan} hint={t.scanHint} color="#10B981" textColor={readableText} mutedColor={readableMuted} onPress={scanForDevices} />
          <ActionCard icon="format-list-numbered" title={t.numbering} hint={t.numberingHint} color="#E45757" textColor={readableText} mutedColor={readableMuted} onPress={numberPdf} />
        </View>

        <View style={[styles.sectionHeader, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.recent}</Text><Pressable onPress={actionComing}><Text style={[styles.viewAll, { color: colors.primary }]}>{t.viewAll}</Text></Pressable></View>
        <View style={[styles.filesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <FileRow name={t.file1} time={t.today} icon="picture-as-pdf" colors={colors} onPress={openPrintDialog} />
          <FileRow name={t.file2} time={t.yesterday} icon="picture-as-pdf" colors={colors} onPress={openPrintDialog} />
          <FileRow name={t.file3} time={t.yesterday} icon="picture-as-pdf" colors={colors} onPress={openPrintDialog} />
        </View>

        <View style={[styles.sectionHeader, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.paper}</Text><Icon name="tune" color={colors.primary} size={20} /></View>
        <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingLabel title={t.format} value={`${paper.ar} · ${paper.size}`} colors={colors} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>
            {paperOptions.map((option) => <Pressable key={option.id} onPress={() => setSelectedPaper(option.id)} style={[styles.pill, { backgroundColor: selectedPaper === option.id ? colors.primary : colors.background, borderColor: selectedPaper === option.id ? colors.primary : colors.border }]}><Text style={[styles.pillText, { color: selectedPaper === option.id ? "#fff" : colors.foreground }]}>{isArabic ? option.ar : option.en}</Text></Pressable>)}
          </ScrollView>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingLabel title={t.weight} value={selectedWeight} colors={colors} />
          <View style={[styles.weightRow, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
            {[
              ["70 g/m²", "خفيف"],
              ["80 g/m²", "عادي"],
              ["120 g/m²", "متوسط"],
              ["200 g/m²", "شهادة"],
            ].map(([value, label]) => <Pressable key={value} onPress={() => setSelectedWeight(value)} style={[styles.weightItem, { backgroundColor: selectedWeight === value ? colors.primary + "16" : colors.background, borderColor: selectedWeight === value ? colors.primary : colors.border }]}><Text style={[styles.weightValue, { color: selectedWeight === value ? colors.primary : colors.foreground }]}>{value}</Text><Text style={[styles.weightLabel, { color: colors.muted }]}>{isArabic ? label : value === "70 g/m²" ? "Light" : value === "80 g/m²" ? "Standard" : value === "120 g/m²" ? "Medium" : "Certificate"}</Text></Pressable>)}
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingLabel title={t.orientation} value={orientation === "portrait" ? t.portrait : t.landscape} colors={colors} />
          <View style={[styles.segmented, { backgroundColor: colors.background }]}>
            <Pressable onPress={() => setOrientation("portrait")} style={[styles.segment, orientation === "portrait" && { backgroundColor: colors.primary }]}><Icon name="crop-portrait" color={orientation === "portrait" ? "#fff" : colors.muted} size={18} /><Text style={[styles.segmentText, { color: orientation === "portrait" ? "#fff" : colors.muted }]}>{t.portrait}</Text></Pressable>
            <Pressable onPress={() => setOrientation("landscape")} style={[styles.segment, orientation === "landscape" && { backgroundColor: colors.primary }]}><Icon name="crop-landscape" color={orientation === "landscape" ? "#fff" : colors.muted} size={18} /><Text style={[styles.segmentText, { color: orientation === "landscape" ? "#fff" : colors.muted }]}>{t.landscape}</Text></Pressable>
          </View>
          <View style={[styles.printFooter, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
            <View style={styles.copiesBlock}><Text style={[styles.smallLabel, { color: colors.muted }]}>{t.copies}</Text><TextInput value={copies} onChangeText={setCopies} keyboardType="number-pad" style={[styles.copiesInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /></View>
            <Pressable onPress={openPrintDialog} style={({ pressed }) => [styles.printButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Icon name="print" color="#fff" size={19} /><Text style={styles.printButtonText}>{t.openPrint}</Text></Pressable>
          </View>
        </View>

        <View style={[styles.smartCard, { backgroundColor: colorScheme === "dark" ? "#1D2C3B" : "#EEF6FA", borderColor: colors.primary + "38" }]}>
          <View style={[styles.sectionHeader, { flexDirection: isArabic ? "row-reverse" : "row", marginBottom: 4 }]}><View style={[styles.aiTitle, { flexDirection: isArabic ? "row-reverse" : "row" }]}><View style={[styles.aiIcon, { backgroundColor: colors.primary }]}><Icon name="auto-awesome" color="#fff" size={19} /></View><View><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.smart}</Text><Text style={[styles.aiHint, { color: colors.muted }]}>{t.smartHint}</Text></View></View><Switch value={aiEnabled} onValueChange={setAiEnabled} trackColor={{ false: colors.border, true: colors.primary + "66" }} thumbColor={aiEnabled ? colors.primary : colors.muted} /></View>
          {aiEnabled ? <View style={[styles.aiBody, { flexDirection: isArabic ? "row-reverse" : "row" }]}><TextInput value={command} onChangeText={setCommand} placeholder={t.placeholder} placeholderTextColor={colors.muted} multiline style={[styles.commandInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, textAlign: isArabic ? "right" : "left" }]} /><Pressable onPress={() => Alert.alert(t.smart, command || t.noInternet)} style={({ pressed }) => [styles.executeButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Icon name="play-arrow" color="#fff" size={20} /><Text style={styles.executeText}>{t.execute}</Text></Pressable></View> : <Text style={[styles.aiOffText, { color: colors.muted, textAlign: isArabic ? "right" : "left" }]}>{t.smartAction} · {t.noInternet}</Text>}
        </View>

        <View style={[styles.roadmapCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.roadmapHeader, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
            <View style={[styles.roadmapIcon, { backgroundColor: colors.primary + "18" }]}><Icon name="alt-route" color={colors.primary} size={21} /></View>
            <View style={styles.roadmapTitleBlock}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.roadmap}</Text><Text style={[styles.roadmapHint, { color: colors.muted }]}>{t.roadmapHint}</Text></View>
          </View>
          {[{ title: t.stage1, hint: t.stage1Hint, icon: "folder-special" as const, done: true }, { title: t.stage2, hint: t.stage2Hint, icon: "print" as const, done: false }, { title: t.stage3, hint: t.stage3Hint, icon: "security" as const, done: false }, { title: t.stage4, hint: t.stage4Hint, icon: "auto-awesome" as const, done: false }].map((stage, index) => (
            <View key={stage.title} style={[styles.roadmapRow, { flexDirection: isArabic ? "row-reverse" : "row", borderTopColor: colors.border }]}>
              <View style={[styles.roadmapStep, { backgroundColor: stage.done ? colors.success + "18" : colors.background, borderColor: stage.done ? colors.success : colors.border }]}><Icon name={stage.icon} color={stage.done ? colors.success : colors.muted} size={17} /></View>
              <View style={styles.roadmapCopy}><Text style={[styles.roadmapStage, { color: colors.foreground }]}>{stage.title}</Text><Text style={[styles.roadmapStageHint, { color: colors.muted }]}>{stage.hint}</Text></View>
              <Text style={[styles.roadmapStatus, { color: stage.done ? colors.success : colors.muted }]}>{stage.done ? (isArabic ? "جاهز" : "Ready") : (isArabic ? "قادم" : "Next")}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.phaseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.phaseHeader, { flexDirection: isArabic ? "row-reverse" : "row" }]}><View style={[styles.phaseIcon, { backgroundColor: colors.primary + "18" }]}><Icon name="devices" color={colors.primary} size={21} /></View><View style={styles.phaseTitleBlock}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.phase2}</Text><Text style={[styles.phaseHint, { color: colors.muted }]}>{t.phase2Hint}</Text></View></View>
          <View style={[styles.deviceRow, { flexDirection: isArabic ? "row-reverse" : "row", borderTopColor: colors.border }]}><Icon name="print" color={colors.primary} size={19} /><View style={styles.deviceCopy}><Text style={[styles.deviceName, { color: colors.foreground }]}>{t.printerName}</Text><Text style={[styles.deviceState, { color: deviceMessage === "not-found" ? colors.error : colors.muted }]}>{deviceChecked ? t.scanUnavailable : t.notChecked}</Text></View><View style={[styles.stateDot, { backgroundColor: deviceMessage === "not-found" ? colors.error : colors.warning }]} /></View>
          <View style={[styles.deviceRow, { flexDirection: isArabic ? "row-reverse" : "row", borderTopColor: colors.border }]}><Icon name="document-scanner" color={colors.primary} size={19} /><View style={styles.deviceCopy}><Text style={[styles.deviceName, { color: colors.foreground }]}>{t.scan}</Text><Text style={[styles.deviceState, { color: deviceMessage === "not-found" ? colors.error : colors.muted }]}>{deviceChecked ? t.scanUnavailable : t.notChecked}</Text></View><View style={[styles.stateDot, { backgroundColor: deviceMessage === "not-found" ? colors.error : colors.warning }]} /></View>
          <Pressable onPress={scanForDevices} style={({ pressed }) => [styles.outlineAction, { borderColor: colors.primary }, pressed && styles.pressed]}><Icon name="refresh" color={colors.primary} size={17} /><Text style={[styles.outlineActionText, { color: colors.primary }]}>{t.checkDevices}</Text></Pressable>
          <View style={[styles.taskHeader, { flexDirection: isArabic ? "row-reverse" : "row", borderTopColor: colors.border }]}><Text style={[styles.taskTitle, { color: colors.foreground }]}>{t.taskManager}</Text><Text style={[styles.taskCount, { color: colors.muted }]}>{tasks.length}</Text></View>
          {tasks.length ? tasks.map((task) => <Text key={task} style={[styles.taskItem, { color: colors.muted }]}>{task}</Text>) : <Text style={[styles.taskEmpty, { color: colors.muted }]}>{t.noTasks}</Text>}
        </View>

        <View style={[styles.phaseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.phaseHeader, { flexDirection: isArabic ? "row-reverse" : "row" }]}><View style={[styles.phaseIcon, { backgroundColor: colors.success + "18" }]}><Icon name="shield" color={colors.success} size={21} /></View><View style={styles.phaseTitleBlock}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.phase3}</Text><Text style={[styles.phaseHint, { color: colors.muted }]}>{t.phase3Hint}</Text></View></View>
          <PrivacyRow icon="backup" title={t.backup} hint={t.backupHint} colors={colors} onPress={() => showError(t.errorTitle, t.backupHint)} />
          <PrivacyRow icon="lock-outline" title={t.passwords} hint={t.passwordsHint} colors={colors} onPress={() => showError(t.errorTitle, t.passwordsHint)} />
          <PrivacyRow icon="history" title={t.history} hint={t.historyHint} colors={colors} onPress={() => Alert.alert(t.history, tasks.length ? tasks.join("\n") : t.noTasks)} />
        </View>

        {selectedFiles.length > 0 && <View style={[styles.selectedNotice, { backgroundColor: colors.success + "12", borderColor: colors.success + "35" }]}><Icon name="attach-file" color={colors.success} size={18} /><Text style={[styles.selectedNoticeText, { color: colors.success }]}>{selectedFiles.length} {t.selected}: {selectedFiles.join("، ")}</Text></View>}
      </ScrollView>
    </ScreenContainer>
  );
}

function SectionTitle({ title, colors }: { title: string; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text><View style={[styles.titleRule, { backgroundColor: colors.primary }]} /></View>;
}

function SettingLabel({ title, value, colors }: { title: string; value: string; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.settingLabel}><Text style={[styles.smallLabel, { color: colors.muted }]}>{title}</Text><Text style={[styles.settingValue, { color: colors.foreground }]}>{value}</Text></View>;
}

function PrivacyRow({ icon, title, hint, colors, onPress }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; title: string; hint: string; colors: ReturnType<typeof useColors>; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.privacyRow, { borderTopColor: colors.border }, pressed && styles.rowPressed]}><Icon name={icon} color={colors.success} size={19} /><View style={styles.privacyCopy}><Text style={[styles.deviceName, { color: colors.foreground }]}>{title}</Text><Text style={[styles.deviceState, { color: colors.muted }]}>{hint}</Text></View><Icon name="chevron-right" color={colors.muted} size={18} /></Pressable>;
}

const styles = StyleSheet.create({
  header: { justifyContent: "space-between", alignItems: "flex-start", marginBottom: 15 },
  brandBlock: { gap: 3 },
  eyebrow: { fontSize: 12, fontWeight: "600", letterSpacing: 0.2 },
  brandName: { fontSize: 25, fontWeight: "800", letterSpacing: -0.8 },
  brandMark: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  subtitle: { fontSize: 12, marginTop: 2 },
  headerTools: { gap: 8 },
  toolButton: { width: 39, height: 39, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  langText: { fontWeight: "800", fontSize: 13 },
  offlineBanner: { alignItems: "center", gap: 8, borderRadius: 11, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8, marginBottom: 14 },
  offlineText: { fontSize: 12, fontWeight: "700", flex: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  errorBanner: { alignItems: "center", gap: 9, borderRadius: 13, borderWidth: 1, padding: 11, marginBottom: 14 },
  errorCopy: { flex: 1 },
  errorTitle: { fontSize: 12, fontWeight: "800" },
  errorHint: { fontSize: 10.5, marginTop: 3, lineHeight: 15 },
  hero: { borderRadius: 22, padding: 18, minHeight: 148, overflow: "hidden", marginBottom: 22 },
  heroCopy: { flex: 1, gap: 5 },
  heroKicker: { color: "#BFE8F2", fontWeight: "700", fontSize: 11, letterSpacing: 0.7 },
  heroTitle: { color: "#fff", fontWeight: "800", fontSize: 26, lineHeight: 31, textAlign: "right" },
  heroDescription: { color: "#DDF6FA", fontSize: 12, marginTop: 3 },
  heroArt: { width: 102, height: 112, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF18", borderRadius: 26, transform: [{ rotate: "5deg" }] },
  heroArtBadge: { position: "absolute", bottom: 11, right: 10, backgroundColor: "#fff", width: 27, height: 27, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  sectionHeader: { alignItems: "center", justifyContent: "space-between", marginBottom: 10, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  titleRule: { height: 3, width: 31, borderRadius: 3, marginLeft: 8, flex: 1, maxWidth: 31 },
  viewAll: { fontSize: 12, fontWeight: "700" },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 22 },
  actionCard: { width: "48.5%", borderRadius: 17, padding: 13, minHeight: 113 },
  actionIcon: { width: 39, height: 39, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  actionTitle: { color: "#10233F", fontSize: 14, fontWeight: "800" },
  actionHint: { color: "#6A7E91", fontSize: 10.5, marginTop: 4 },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.88 },
  rowPressed: { opacity: 0.65 },
  filesCard: { borderRadius: 17, borderWidth: 1, paddingHorizontal: 13, marginBottom: 22 },
  fileRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 10, borderBottomWidth: 1 },
  fileIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 12.5, fontWeight: "700" },
  fileTime: { fontSize: 10.5, marginTop: 3 },
  settingsCard: { borderRadius: 17, borderWidth: 1, padding: 14, marginBottom: 16 },
  settingLabel: { gap: 3 },
  smallLabel: { fontSize: 11, fontWeight: "600" },
  settingValue: { fontSize: 13, fontWeight: "800" },
  pill: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  pillText: { fontSize: 11, fontWeight: "700" },
  divider: { height: 1, marginVertical: 12 },
  weightRow: { gap: 8, marginTop: 10 },
  weightItem: { flex: 1, borderRadius: 12, borderWidth: 1, alignItems: "center", paddingVertical: 10 },
  weightValue: { fontSize: 11, fontWeight: "800" },
  weightLabel: { fontSize: 9.5, marginTop: 3 },
  segmented: { flexDirection: "row", padding: 3, borderRadius: 12, gap: 3, marginTop: 10 },
  segment: { flex: 1, borderRadius: 9, paddingVertical: 9, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5 },
  segmentText: { fontSize: 11, fontWeight: "700" },
  printFooter: { alignItems: "flex-end", gap: 10, marginTop: 14 },
  copiesBlock: { width: 72, gap: 4 },
  copiesInput: { borderWidth: 1, borderRadius: 10, height: 39, paddingHorizontal: 11, textAlign: "center", fontWeight: "800" },
  printButton: { flex: 1, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  printButtonText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  smartCard: { borderRadius: 17, borderWidth: 1, padding: 14, marginBottom: 16 },
  aiTitle: { alignItems: "center", gap: 9 },
  aiIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  aiHint: { fontSize: 10, marginTop: 3 },
  aiBody: { gap: 9, alignItems: "stretch", marginTop: 12 },
  commandInput: { flex: 1, minHeight: 55, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, paddingTop: 10, fontSize: 11 },
  executeButton: { height: 40, borderRadius: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  executeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  aiOffText: { fontSize: 11, marginTop: 6, lineHeight: 18 },
  selectedNotice: { borderWidth: 1, borderRadius: 12, padding: 11, flexDirection: "row", alignItems: "center", gap: 7 },
  selectedNoticeText: { flex: 1, fontSize: 10.5, fontWeight: "700" },
  roadmapCard: { borderRadius: 17, borderWidth: 1, padding: 14, marginBottom: 16 },
  roadmapHeader: { alignItems: "center", gap: 10, marginBottom: 4 },
  roadmapIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  roadmapTitleBlock: { flex: 1 },
  roadmapHint: { fontSize: 10, marginTop: 3 },
  roadmapRow: { alignItems: "center", gap: 9, borderTopWidth: 1, paddingVertical: 11 },
  roadmapStep: { width: 33, height: 33, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  roadmapCopy: { flex: 1 },
  roadmapStage: { fontSize: 12, fontWeight: "800" },
  roadmapStageHint: { fontSize: 10, marginTop: 3, lineHeight: 15 },
  roadmapStatus: { fontSize: 10, fontWeight: "800" },
  phaseCard: { borderRadius: 17, borderWidth: 1, padding: 14, marginBottom: 16 },
  phaseHeader: { alignItems: "center", gap: 10, marginBottom: 4 },
  phaseIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  phaseTitleBlock: { flex: 1 },
  phaseHint: { fontSize: 10, marginTop: 3 },
  deviceRow: { alignItems: "center", gap: 9, borderTopWidth: 1, paddingVertical: 11 },
  deviceCopy: { flex: 1 },
  deviceName: { fontSize: 12, fontWeight: "800" },
  deviceState: { fontSize: 10, marginTop: 3, lineHeight: 15 },
  stateDot: { width: 9, height: 9, borderRadius: 5 },
  outlineAction: { height: 38, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, marginTop: 4 },
  outlineActionText: { fontSize: 11, fontWeight: "800" },
  taskHeader: { alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, paddingTop: 11, marginTop: 12 },
  taskTitle: { fontSize: 12, fontWeight: "800" },
  taskCount: { fontSize: 11, fontWeight: "700" },
  taskEmpty: { fontSize: 10.5, paddingTop: 8 },
  taskItem: { fontSize: 10.5, paddingTop: 8 },
  privacyRow: { alignItems: "center", gap: 9, borderTopWidth: 1, paddingVertical: 11, flexDirection: "row" },
  privacyCopy: { flex: 1 },
});
