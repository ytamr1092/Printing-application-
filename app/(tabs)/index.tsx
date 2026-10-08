import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  PanResponder,
  Platform,
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

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useThemeContext } from "@/lib/theme-provider";
import {
  canMergePdfs,
  findJpegByteRanges,
  findPngByteRanges,
  hasAtLeastFiles,
} from "@/shared/file-operations";
import { paperOptions, paperPresetById } from "@/shared/print-options";
import { printProfiles, printProfileById } from "@/shared/print-profiles";
import { hasBothIdFaces, isValidIpv4 } from "@/shared/device-operations";
import { formatNumberValue, getNumberingPages } from "@/shared/numbering";
import { duplexEdgeLabel } from "@/shared/duplex-settings";
import {
  canApplyPageOrder,
  createPageEdits,
  movePage,
  pageOrientation,
  rotatePage,
  togglePageOrientation,
  type PdfPageEdit,
} from "@/shared/pdf-pages";
import { previewKinds, type PreviewKind } from "@/shared/preview";
import { type WorkspaceKind } from "@/shared/workspaces";
import {
  advancedSettingsStorageKey,
  normalizeAdvancedSettings,
  type AdvancedSettings,
} from "@/shared/advanced-settings";

type Language = "ar" | "en";
type NumberPosition = "left" | "center" | "right";
type NumberVertical = "top" | "middle" | "bottom";
type NumberWhich = "all" | "odd" | "even";
type NumberNumerals = "latin" | "indic" | "roman-l" | "roman-u";
type NumberFont = "helvetica" | "times" | "courier";
type Workspace = WorkspaceKind;
const copy = {
  ar: {
    greeting: "مرحبًا بك في",
    appName: "طباعة",
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
    idWizard: "بطاقة هوية بالوجهين",
    idWizardHint: "صوّر أو اختر الوجه الأمامي والخلفي ثم أنشئ PDF",
    idFront: "الوجه الأمامي",
    idBack: "الوجه الخلفي",
    scanIdFace: "مسح من Kyocera",
    scanIdFaceHint: "ضع البطاقة على زجاج السكانر ثم ابدأ المسح",
    scanNeedsConnection: "أدخل IP الطابعة واختبر الاتصال أولًا",
    scanProtocolMissing:
      "تم تجهيز الخانة للمسح من Kyocera، لكن استقبال الملف يحتاج إعداد Scan-to-FTP/SMB أو TWAIN للطابعة.",
    takePhoto: "تصوير",
    choosePhoto: "اختيار صورة",
    makeIdPdf: "إنشاء PDF للبطاقة",
    idNeedBoth: "اختر صورة للوجهين أولًا.",
    idSuccess: "تم إنشاء ملف بطاقة الهوية",
    idFailed: "تعذر إنشاء ملف بطاقة الهوية",
    cameraDenied: "لم يتم السماح باستخدام الكاميرا",
    scannerSettings: "إعدادات السكانر",
    scannerIp: "عنوان IP للطابعة",
    scannerIpHint: "مثال: 192.168.1.50",
    networkAddress: "عنوان الهاتف على الشبكة",
    dpi: "الدقة",
    scanColor: "ملون",
    scanBw: "أبيض وأسود",
    adf: "المغذي التلقائي ADF",
    connected: "متصل بالطابعة",
    connectionFailed: "لم يتم العثور على الطابعة",
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
    scanUnavailableHint:
      "تأكد من تشغيل Kyocera TASKalfa 306ci واتصال الهاتف بنفس الشبكة المحلية.",
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
    numberingFile: "ملف الترقيم",
    chooseNumberingFile: "اختيار ملف PDF للترقيم",
    numberingSettings: "إعدادات الترقيم",
    numberLeft: "يسار",
    numberCenter: "وسط",
    numberRight: "يمين",
    numberTop: "أعلى",
    numberMiddle: "النص",
    numberBottom: "أسفل",
    numberMargin: "البعد عن الحافة (مم)",
    numberFrom: "من صفحة",
    numberTo: "إلى صفحة",
    numberStart: "بداية الرقم",
    numberWhich: "الصفحات المرقمة",
    numberAll: "كل الصفحات",
    numberOdd: "الفردية",
    numberEven: "الزوجية",
    numberFormat: "صيغة الرقم",
    numberNumerals: "نوع الأرقام",
    numberSize: "الحجم (نقطة)",
    numberFont: "الخط",
    numberBold: "خط غامق",
    numberMirror: "عكس الموضع في الصفحات الزوجية",
    runNumbering: "رقّم الملف",
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
    profiles: "ملفات تعريف الطباعة",
    profilesHint: "إعدادات جاهزة بضغطة واحدة",
    colorMode: "الألوان",
    color: "ملون",
    bw: "أبيض وأسود",
    duplex: "وجهين",
    oneSided: "وجه واحد",
    duplexEdge: "حافة قلب الورقة",
    longEdge: "الحافة الطويلة",
    shortEdge: "الحافة القصيرة",
    profileApplied: "تم تطبيق ملف التعريف",
    cancelAll: "إلغاء كل المهام",
    tasksCancelled: "تم إلغاء كل المهام المعلقة",
    backupSuccess: "تم إنشاء النسخة الاحتياطية المحلية",
    backupFailed: "تعذر إنشاء النسخة الاحتياطية",
    backupConfirm:
      "سيتم حفظ إعداداتك وسجل العمليات في ملف محلي قابل للمشاركة. هل تريد المتابعة؟",
    restoreBackup: "استعادة نسخة احتياطية",
    restoreHint: "استعد الإعدادات من ملف محلي",
    restoreSuccess: "تمت استعادة النسخة الاحتياطية",
    restoreFailed: "تعذر استعادة النسخة الاحتياطية",
    invalidBackup: "ملف النسخة الاحتياطية غير صالح",
    confirmPrint: "تأكيد الطباعة",
    confirmPrintHint: "راجع الإعدادات قبل فتح واجهة الطباعة.",
    continueAction: "متابعة",
    picked: "تم اختيار الملفات",
    printReady: "تم تجهيز معاينة الطباعة",
    previewTitle: "المعاينات المنفصلة",
    previewMerge: "معاينة دمج PDF",
    previewImages: "معاينة الصور إلى PDF",
    previewExtract: "معاينة استخراج الصور",
    previewNumbering: "معاينة الترقيم",
    previewId: "معاينة بطاقة الهوية",
    previewPrint: "معاينة الطباعة",
    previewEmpty: "لم تختر ملفًا لهذه الخانة بعد",
    previewContinue: "متابعة التنفيذ",
    previewPages: "معاينة ترتيب صفحات PDF",
    pageEditor: "ترتيب وحذف صفحات PDF",
    pageEditorHint: "اختر الصفحات بالترتيب المطلوب، واحذف أي رقم لا تريده",
    choosePageFile: "اختيار ملف PDF",
    pageOrder: "ترتيب الصفحات",
    pageOrderHint: "مثال: 3، 1، 2 — الأرقام المحذوفة لن تظهر في الناتج",
    applyPageEdit: "إنشاء الملف المعدل",
    pageEditNeedFile: "اختر ملف PDF أولًا",
    pageEditNeedOrder: "اكتب أرقام صفحات صحيحة",
    pageEditSuccess: "تم إنشاء PDF بالترتيب الجديد",
    pageEditFailed: "تعذر تعديل ترتيب صفحات PDF",
    results: "الملفات والنتائج",
    resultsHint: "آخر الملفات التي أنشأها التطبيق",
    noResults: "لا توجد نتائج بعد",
    coming: "سيتم ربط هذه الوظيفة في الإصدار التالي. الواجهة جاهزة لها.",
    workspacePdf: "مساحة PDF",
    workspacePdfHint: "الدمج، التحويل، الاستخراج، الترقيم وترتيب الصفحات",
    workspacePrint: "مساحة الطباعة",
    workspacePrintHint: "اختر الملف ثم اضبط الورق والألوان والوجهين",
    workspaceScan: "مساحة السكانر",
    workspaceScanHint: "إعداد Kyocera وفحص الاتصال والمعاينة",
    workspaceId: "مساحة بطاقة الهوية",
    workspaceIdHint: "الوجه الأمامي والخلفي في صفحتين منفصلتين",
    workspaceResults: "مساحة النتائج",
    workspaceResultsHint: "الملفات الناتجة وسجل العمليات",
    workspaceAi: "المساعد الذكي",
    workspaceAiHint: "اختياري ويظل مغلقًا افتراضيًا",
    openWorkspace: "فتح المساحة",
    backHome: "العودة للرئيسية",
    workspaceActions: "أدوات هذه المساحة",
    advanced: "إعدادات متقدمة",
    pageRange: "نطاق الصفحات",
    scale: "التحجيم",
    fitPage: "ملاءمة الصفحة",
    actualSize: "الحجم الفعلي",
    fillPage: "ملء الصفحة",
    margins: "الهوامش (مم)",
    collate: "تجميع النسخ",
    scanSource: "مصدر المسح",
    glass: "الزجاج",
    scanDuplex: "مسح الوجهين",
    outputFormat: "صيغة الناتج",
    deskew: "تصحيح الميل",
    removeBlanks: "تجاهل الصفحات الفارغة",
    idSize: "حجم البطاقة",
    idFit: "ملاءمة داخل الصفحة",
    idActual: "الحجم الفعلي",
    idMargin: "هامش البطاقة (مم)",
    quality: "الجودة",
    standard: "قياسية",
    high: "عالية",
    imageFit: "ملاءمة الصور",
    contain: "إظهار الصورة كاملة",
    fill: "ملء المساحة",
    extractFormat: "صيغة الصور المستخرجة",
    longPressDrag: "اضغط مطولًا واسحب الصفحة لتغيير مكانها",
  },
  en: {
    greeting: "Welcome to",
    appName: "طباعة",
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
    idWizard: "Two-sided ID card",
    idWizardHint: "Capture or choose both sides, then create a print-ready PDF",
    idFront: "Front side",
    idBack: "Back side",
    scanIdFace: "Scan from Kyocera",
    scanIdFaceHint: "Place the card on the scanner glass, then start scanning",
    scanNeedsConnection: "Enter the printer IP and test the connection first",
    scanProtocolMissing:
      "The Kyocera scan slot is ready, but receiving the file requires Scan-to-FTP/SMB or the printer TWAIN setup.",
    takePhoto: "Camera",
    choosePhoto: "Choose image",
    makeIdPdf: "Create ID card PDF",
    idNeedBoth: "Choose an image for both sides first.",
    idSuccess: "ID card PDF created",
    idFailed: "Could not create the ID card PDF",
    cameraDenied: "Camera permission was not granted",
    scannerSettings: "Scanner settings",
    scannerIp: "Printer IP address",
    scannerIpHint: "Example: 192.168.1.50",
    networkAddress: "Phone network address",
    dpi: "Resolution",
    scanColor: "Color",
    scanBw: "Black & white",
    adf: "Automatic document feeder (ADF)",
    connected: "Printer connected",
    connectionFailed: "Printer was not found",
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
    scanUnavailableHint:
      "Make sure the Kyocera TASKalfa 306ci is on and your phone is on the same local network.",
    printerUnavailable: "Printer is not connected",
    printerUnavailableHint:
      "Check the network or choose a printer from Android settings.",
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
    numberingFile: "Numbering file",
    chooseNumberingFile: "Choose PDF to number",
    numberingSettings: "Numbering settings",
    numberLeft: "Left",
    numberCenter: "Center",
    numberRight: "Right",
    numberTop: "Top",
    numberMiddle: "Middle",
    numberBottom: "Bottom",
    numberMargin: "Distance from edge (mm)",
    numberFrom: "From page",
    numberTo: "To page",
    numberStart: "Starting number",
    numberWhich: "Numbered pages",
    numberAll: "All pages",
    numberOdd: "Odd",
    numberEven: "Even",
    numberFormat: "Number format",
    numberNumerals: "Numerals",
    numberSize: "Size (pt)",
    numberFont: "Font",
    numberBold: "Bold text",
    numberMirror: "Mirror position on even pages",
    runNumbering: "Number file",
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
    profiles: "Print profiles",
    profilesHint: "Ready-to-use settings in one tap",
    colorMode: "Color mode",
    color: "Color",
    bw: "Black & white",
    duplex: "Duplex",
    oneSided: "One-sided",
    duplexEdge: "Duplex flip edge",
    longEdge: "Long edge",
    shortEdge: "Short edge",
    profileApplied: "Print profile applied",
    cancelAll: "Cancel all tasks",
    tasksCancelled: "All pending tasks were cancelled",
    backupSuccess: "Local backup created",
    backupFailed: "Backup could not be created",
    backupConfirm:
      "Your settings and activity history will be saved to a local shareable file. Continue?",
    restoreBackup: "Restore backup",
    restoreHint: "Restore settings from a local file",
    restoreSuccess: "Backup restored",
    restoreFailed: "Backup could not be restored",
    invalidBackup: "This backup file is not valid",
    confirmPrint: "Confirm printing",
    confirmPrintHint: "Review the settings before opening the print dialog.",
    continueAction: "Continue",
    picked: "Files selected",
    printReady: "Print preview prepared",
    previewTitle: "Separate previews",
    previewMerge: "Merge PDF preview",
    previewImages: "Images to PDF preview",
    previewExtract: "Extract images preview",
    previewNumbering: "Numbering preview",
    previewId: "ID card preview",
    previewPrint: "Print preview",
    previewEmpty: "No file has been selected for this section yet",
    previewContinue: "Continue",
    previewPages: "PDF page order preview",
    pageEditor: "Reorder & delete PDF pages",
    pageEditorHint:
      "Enter pages in the order you want; omitted numbers are removed",
    choosePageFile: "Choose PDF file",
    pageOrder: "Page order",
    pageOrderHint: "Example: 3, 1, 2 — omitted pages will not be included",
    applyPageEdit: "Create edited PDF",
    pageEditNeedFile: "Choose a PDF file first",
    pageEditNeedOrder: "Enter valid page numbers",
    pageEditSuccess: "PDF created with the new order",
    pageEditFailed: "Could not edit PDF page order",
    results: "Files & results",
    resultsHint: "Latest files created by the app",
    noResults: "No results yet",
    coming:
      "This function will be connected in the next release. The UI is ready.",
    workspacePdf: "PDF workspace",
    workspacePdfHint: "Merge, convert, extract, number and reorder pages",
    workspacePrint: "Print workspace",
    workspacePrintHint: "Choose a file, then set paper, color and duplex",
    workspaceScan: "Scanner workspace",
    workspaceScanHint: "Kyocera settings, connection test and preview",
    workspaceId: "ID card workspace",
    workspaceIdHint: "Front and back on two separate pages",
    workspaceResults: "Results workspace",
    workspaceResultsHint: "Generated files and activity history",
    workspaceAi: "Smart assistant",
    workspaceAiHint: "Optional and off by default",
    openWorkspace: "Open workspace",
    backHome: "Back to home",
    workspaceActions: "Workspace tools",
    advanced: "Advanced settings",
    pageRange: "Page range",
    scale: "Scaling",
    fitPage: "Fit page",
    actualSize: "Actual size",
    fillPage: "Fill page",
    margins: "Margins (mm)",
    collate: "Collate copies",
    scanSource: "Scan source",
    glass: "Glass",
    scanDuplex: "Scan both sides",
    outputFormat: "Output format",
    deskew: "Deskew pages",
    removeBlanks: "Skip blank pages",
    idSize: "Card size",
    idFit: "Fit inside page",
    idActual: "Actual size",
    idMargin: "Card margin (mm)",
    quality: "Quality",
    standard: "Standard",
    high: "High",
    imageFit: "Image fit",
    contain: "Show full image",
    fill: "Fill area",
    extractFormat: "Extracted image format",
    longPressDrag: "Long-press and drag a page to move it",
  },
} as const;

function Icon({
  name,
  color,
  size = 22,
}: {
  name: React.ComponentProps<typeof MaterialIcons>["name"];
  color: string;
  size?: number;
}) {
  return <MaterialIcons name={name} color={color} size={size} />;
}

function ActionCard({
  icon,
  title,
  hint,
  color,
  textColor,
  mutedColor,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  title: string;
  hint: string;
  color: string;
  textColor: string;
  mutedColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionCard,
        { backgroundColor: color + "14" },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: color + "22" }]}>
        <Icon name={icon} color={color} size={23} />
      </View>
      <Text style={[styles.actionTitle, { color: textColor }]}>{title}</Text>
      <Text
        style={[styles.actionHint, { color: mutedColor }]}
        numberOfLines={1}
      >
        {hint}
      </Text>
    </Pressable>
  );
}

function FileRow({
  name,
  time,
  icon,
  colors,
  onPress,
}: {
  name: string;
  time: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  colors: ReturnType<typeof useColors>;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.fileRow,
        { borderBottomColor: colors.border },
        pressed && styles.rowPressed,
      ]}
    >
      <View
        style={[styles.fileIcon, { backgroundColor: colors.primary + "16" }]}
      >
        <Icon name={icon} color={colors.primary} size={21} />
      </View>
      <View style={styles.fileInfo}>
        <Text
          style={[styles.fileName, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text style={[styles.fileTime, { color: colors.muted }]}>{time}</Text>
      </View>
      <Icon name="more-vert" color={colors.muted} size={21} />
    </Pressable>
  );
}

function PdfPageTile({
  edit,
  index,
  active,
  colors,
  isArabic,
  onLongPress,
  onDrag,
  onRotate,
  onToggleOrientation,
  onDelete,
}: {
  edit: PdfPageEdit;
  index: number;
  active: boolean;
  colors: ReturnType<typeof useColors>;
  isArabic: boolean;
  onLongPress: () => void;
  onDrag: (deltaY: number) => void;
  onRotate: () => void;
  onToggleOrientation: () => void;
  onDelete: () => void;
}) {
  const startY = useRef(0);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          startY.current = event.nativeEvent.pageY;
        },
        onPanResponderMove: (event) =>
          onDrag(event.nativeEvent.pageY - startY.current),
        onPanResponderRelease: () => undefined,
        onPanResponderTerminate: () => undefined,
      }),
    [onDrag],
  );
  const orientation = pageOrientation(edit.rotation);
  return (
    <View
      {...panResponder.panHandlers}
      style={[
        styles.pdfPageTile,
        {
          backgroundColor: colors.surface,
          borderColor: active ? colors.primary : colors.border,
          borderWidth: active ? 2 : 1,
        },
      ]}
    >
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={320}
        style={styles.pdfPagePreview}
      >
        <Icon name="description" color={colors.primary} size={25} />
        <Text style={[styles.pdfPageNumber, { color: colors.foreground }]}>
          #{edit.sourcePage}
        </Text>
        <Text style={[styles.pdfPageMeta, { color: colors.muted }]}>
          #{index + 1} · {edit.rotation}°
        </Text>
      </Pressable>
      <View style={styles.pdfPageControls}>
        <Text style={[styles.pdfPageOrientation, { color: colors.muted }]}>
          {isArabic
            ? orientation === "portrait"
              ? "رأسي"
              : "أفقي"
            : orientation}
        </Text>
        <Pressable onPress={onRotate} style={styles.pdfPageButton}>
          <Icon name="rotate-90-degrees-ccw" color={colors.primary} size={18} />
        </Pressable>
        <Pressable onPress={onToggleOrientation} style={styles.pdfPageButton}>
          <Icon name="screen-rotation" color={colors.primary} size={18} />
        </Pressable>
        <Pressable onPress={onDelete} style={styles.pdfPageButton}>
          <Icon name="delete-outline" color={colors.error} size={18} />
        </Pressable>
      </View>
    </View>
  );
}

function SettingPills({
  values,
  selected,
  colors,
  onSelect,
}: {
  values: { value: string; label: string }[];
  selected: string;
  colors: ReturnType<typeof useColors>;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.settingPills}>
      {values.map((item) => (
        <Pressable
          key={item.value}
          onPress={() => onSelect(item.value)}
          style={[
            styles.settingPill,
            {
              backgroundColor:
                selected === item.value ? colors.primary : colors.background,
              borderColor:
                selected === item.value ? colors.primary : colors.border,
            },
          ]}
        >
          <Text
            style={{
              color: selected === item.value ? "#fff" : colors.foreground,
              fontSize: 10,
              fontWeight: "800",
            }}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob
    ? globalThis.atob(base64)
    : Buffer.from(base64, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1)
    binary += String.fromCharCode(bytes[index]);
  return globalThis.btoa
    ? globalThis.btoa(binary)
    : Buffer.from(binary, "binary").toString("base64");
}

function formatFileSize(bytes?: number): string {
  if (!Number.isFinite(bytes) || !bytes || bytes < 1) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getNumberFont(
  StandardFonts: Record<string, string>,
  font: NumberFont,
  bold: boolean,
): string {
  if (font === "times")
    return StandardFonts[bold ? "TimesRomanBold" : "TimesRoman"];
  if (font === "courier")
    return StandardFonts[bold ? "CourierBold" : "Courier"];
  return StandardFonts[bold ? "HelveticaBold" : "Helvetica"];
}

// Load the PDF engine only when a PDF action is requested.
// @ts-ignore pdf-lib does not publish declarations for this bundled entry.
const loadPdfLib = () => import("pdf-lib/dist/pdf-lib.esm.js") as Promise<any>;
const loadImagePicker = () => import("expo-image-picker");
const loadNetwork = () => import("expo-network");

export default function HomeScreen() {
  const [language, setLanguage] = useState<Language>("ar");
  const [selectedPaper, setSelectedPaper] = useState("certificate");
  const [selectedWeight, setSelectedWeight] = useState("200 g/m²");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    "portrait",
  );
  const [copies, setCopies] = useState("1");
  const [printPages, setPrintPages] = useState("");
  const [printScale, setPrintScale] = useState<"fit" | "actual" | "fill">(
    "fit",
  );
  const [printMargins, setPrintMargins] = useState("5");
  const [printCollate, setPrintCollate] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState("certificate");
  const [colorMode, setColorMode] = useState<"color" | "bw">("color");
  const [duplex, setDuplex] = useState(false);
  const [duplexEdge, setDuplexEdge] = useState<"long" | "short">("long");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [command, setCommand] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<{
    title: string;
    hint: string;
  } | null>(null);
  const [deviceChecked, setDeviceChecked] = useState(false);
  const [deviceMessage, setDeviceMessage] = useState<
    "unknown" | "not-found" | "connected"
  >("unknown");
  const [printerIp, setPrinterIp] = useState("");
  const [phoneIp, setPhoneIp] = useState("");
  const [scannerDpi, setScannerDpi] = useState("300");
  const [scannerColor, setScannerColor] = useState<"color" | "bw">("color");
  const [scannerAdf, setScannerAdf] = useState(true);
  const [scannerSource, setScannerSource] = useState<"glass" | "adf">("adf");
  const [scannerDuplex, setScannerDuplex] = useState(false);
  const [scannerFormat, setScannerFormat] = useState<"pdf" | "jpg" | "png">(
    "pdf",
  );
  const [scannerDeskew, setScannerDeskew] = useState(true);
  const [scannerBlankPages, setScannerBlankPages] = useState(true);
  const [idFrontUri, setIdFrontUri] = useState<string | null>(null);
  const [idBackUri, setIdBackUri] = useState<string | null>(null);
  const [idBusy, setIdBusy] = useState(false);
  const [idSize, setIdSize] = useState<"fit" | "actual">("fit");
  const [idMargin, setIdMargin] = useState("12");
  const [idQuality, setIdQuality] = useState<"standard" | "high">("high");
  const [numberingFile, setNumberingFile] = useState<{
    uri: string;
    name: string;
    pages: number;
  } | null>(null);
  const [numberPosition, setNumberPosition] =
    useState<NumberPosition>("center");
  const [numberVertical, setNumberVertical] =
    useState<NumberVertical>("bottom");
  const [numberMargin, setNumberMargin] = useState("10");
  const [numberFrom, setNumberFrom] = useState("1");
  const [numberTo, setNumberTo] = useState("");
  const [numberStart, setNumberStart] = useState("1");
  const [numberWhich, setNumberWhich] = useState<NumberWhich>("all");
  const [numberFormat, setNumberFormat] = useState("{n} / {t}");
  const [numberNumerals, setNumberNumerals] = useState<NumberNumerals>("latin");
  const [numberSize, setNumberSize] = useState("9");
  const [numberColor, setNumberColor] = useState("#526270");
  const [numberFont, setNumberFont] = useState<NumberFont>("helvetica");
  const [numberBold, setNumberBold] = useState(false);
  const [previewKind, setPreviewKind] = useState<PreviewKind | null>(null);
  const [printUri, setPrintUri] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<{
    uri: string;
    name: string;
    size?: number;
    mimeType?: string;
  } | null>(null);
  const [pageEditorFile, setPageEditorFile] = useState<{
    uri: string;
    name: string;
    pages: number;
  } | null>(null);
  const [pageOrder, setPageOrder] = useState("");
  const [pageEdits, setPageEdits] = useState<PdfPageEdit[]>([]);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number | null>(
    null,
  );
  const [pageEditBusy, setPageEditBusy] = useState(false);
  const [numberMirror, setNumberMirror] = useState(false);
  const [imageFit, setImageFit] = useState<"contain" | "fill">("contain");
  const [extractFormat, setExtractFormat] = useState<"jpg" | "png">("jpg");
  const [tasks, setTasks] = useState<string[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace>("home");
  const { colorScheme, setColorScheme } = useThemeContext();
  const colors = useColors();
  const isArabic = language === "ar";
  const t = copy[language];
  const readableText = colorScheme === "dark" ? "#F3F8FC" : "#071A2B";
  const readableMuted = colorScheme === "dark" ? "#B7C8D8" : "#4B6377";
  const paper = useMemo(() => paperPresetById(selectedPaper), [selectedPaper]);
  const advancedSettings = useMemo<AdvancedSettings>(
    () => ({
      printPages,
      printScale,
      printMargins,
      printCollate,
      scannerSource,
      scannerDuplex,
      scannerFormat,
      scannerDeskew,
      scannerBlankPages,
      idSize,
      idMargin,
      idQuality,
      numberPosition,
      numberVertical,
      numberMargin,
      numberFrom,
      numberTo,
      numberStart,
      numberWhich,
      numberFormat,
      numberNumerals,
      numberSize,
      numberColor,
      numberFont,
      numberBold,
      numberMirror,
      imageFit,
      extractFormat,
    }),
    [
      printPages,
      printScale,
      printMargins,
      printCollate,
      scannerSource,
      scannerDuplex,
      scannerFormat,
      scannerDeskew,
      scannerBlankPages,
      idSize,
      idMargin,
      idQuality,
      numberPosition,
      numberVertical,
      numberMargin,
      numberFrom,
      numberTo,
      numberStart,
      numberWhich,
      numberFormat,
      numberNumerals,
      numberSize,
      numberColor,
      numberFont,
      numberBold,
      numberMirror,
      imageFit,
      extractFormat,
    ],
  );

  useEffect(() => {
    AsyncStorage.getItem("printpilot.activity.v1")
      .then((stored) => {
        if (stored) setTasks(JSON.parse(stored) as string[]);
        setHistoryReady(true);
      })
      .catch(() => setHistoryReady(true));
  }, []);

  useEffect(() => {
    if (historyReady)
      AsyncStorage.setItem(
        "printpilot.activity.v1",
        JSON.stringify(tasks),
      ).catch(() => undefined);
  }, [historyReady, tasks]);

  useEffect(() => {
    AsyncStorage.getItem("printpilot.settings.v1")
      .then((stored) => {
        if (!stored) return;
        const settings = JSON.parse(stored) as Partial<{
          selectedPaper: string;
          selectedWeight: string;
          orientation: "portrait" | "landscape";
          copies: string;
          selectedProfile: string;
          colorMode: "color" | "bw";
          duplex: boolean;
          duplexEdge: "long" | "short";
        }>;
        if (settings.selectedPaper) setSelectedPaper(settings.selectedPaper);
        if (settings.selectedWeight) setSelectedWeight(settings.selectedWeight);
        if (settings.orientation) setOrientation(settings.orientation);
        if (settings.copies) setCopies(settings.copies);
        if (settings.selectedProfile)
          setSelectedProfile(settings.selectedProfile);
        if (settings.colorMode) setColorMode(settings.colorMode);
        if (typeof settings.duplex === "boolean") setDuplex(settings.duplex);
        if (settings.duplexEdge) setDuplexEdge(settings.duplexEdge);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(advancedSettingsStorageKey)
      .then((stored) => {
        if (!stored) return;
        const settings = normalizeAdvancedSettings(JSON.parse(stored));
        setPrintPages(settings.printPages);
        setPrintScale(settings.printScale);
        setPrintMargins(settings.printMargins);
        setPrintCollate(settings.printCollate);
        setScannerSource(settings.scannerSource);
        setScannerAdf(settings.scannerSource === "adf");
        setScannerDuplex(settings.scannerDuplex);
        setScannerFormat(settings.scannerFormat);
        setScannerDeskew(settings.scannerDeskew);
        setScannerBlankPages(settings.scannerBlankPages);
        setIdSize(settings.idSize);
        setIdMargin(settings.idMargin);
        setIdQuality(settings.idQuality);
        setNumberPosition(settings.numberPosition);
        setNumberVertical(settings.numberVertical);
        setNumberMargin(settings.numberMargin);
        setNumberFrom(settings.numberFrom);
        setNumberTo(settings.numberTo);
        setNumberStart(settings.numberStart);
        setNumberWhich(settings.numberWhich);
        setNumberFormat(settings.numberFormat);
        setNumberNumerals(settings.numberNumerals);
        setNumberSize(settings.numberSize);
        setNumberColor(settings.numberColor);
        setNumberFont(settings.numberFont);
        setNumberBold(settings.numberBold);
        setNumberMirror(settings.numberMirror);
        setImageFit(settings.imageFit);
        setExtractFormat(settings.extractFormat);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(
      "printpilot.settings.v1",
      JSON.stringify({
        selectedPaper,
        selectedWeight,
        orientation,
        copies,
        selectedProfile,
        colorMode,
        duplex,
        duplexEdge,
      }),
    ).catch(() => undefined);
  }, [
    selectedPaper,
    selectedWeight,
    orientation,
    copies,
    selectedProfile,
    colorMode,
    duplex,
    duplexEdge,
  ]);

  useEffect(() => {
    AsyncStorage.setItem(
      advancedSettingsStorageKey,
      JSON.stringify(advancedSettings),
    ).catch(() => undefined);
  }, [advancedSettings]);

  useEffect(() => {
    if (pageEdits.length) {
      setPageOrder(pageEdits.map((page) => String(page.sourcePage)).join(", "));
    }
  }, [pageEdits]);

  const showError = (title: string, hint: string) =>
    setErrorMessage({ title, hint });

  const applyProfile = (profileId: string) => {
    const profile = printProfileById(profileId);
    setSelectedProfile(profileId);
    setSelectedPaper(profile.paperId);
    setSelectedWeight(profile.weight);
    setOrientation(profile.orientation);
    setCopies(profile.copies);
    setColorMode(profile.colorMode);
    setDuplex(profile.duplex);
    setDuplexEdge("long");
    setTasks((current) =>
      [
        `${t.profileApplied}: ${isArabic ? profile.ar : profile.en}`,
        ...current,
      ].slice(0, 4),
    );
    setErrorMessage(null);
  };

  const cancelAllTasks = () => {
    setTasks([]);
    setErrorMessage({ title: t.tasksCancelled, hint: t.noTasks });
  };

  const createLocalBackup = () => {
    Alert.alert(t.backup, t.backupConfirm, [
      { text: t.dismiss, style: "cancel" },
      {
        text: t.continueAction,
        onPress: async () => {
          try {
            const backup = {
              version: 2,
              createdAt: new Date().toISOString(),
              settings: {
                selectedPaper,
                selectedWeight,
                orientation,
                copies,
                selectedProfile,
                colorMode,
                duplex,
                duplexEdge,
                advanced: advancedSettings,
              },
              activity: tasks,
            };
            const uri = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}PrintPilot-Backup-${Date.now()}.json`;
            await FileSystem.writeAsStringAsync(
              uri,
              JSON.stringify(backup, null, 2),
              { encoding: FileSystem.EncodingType.UTF8 },
            );
            setTasks((current) =>
              [`${t.backupSuccess}: ${uri.split("/").pop()}`, ...current].slice(
                0,
                4,
              ),
            );
            Alert.alert(t.backupSuccess, uri, [
              { text: t.dismiss, style: "cancel" },
              {
                text: t.shareResult,
                onPress: async () => {
                  if (await Sharing.isAvailableAsync())
                    await Sharing.shareAsync(uri, {
                      mimeType: "application/json",
                      dialogTitle: t.shareResult,
                    });
                },
              },
            ]);
          } catch {
            showError(t.backupFailed, t.backupHint);
          }
        },
      },
    ]);
  };

  const restoreLocalBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const raw = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const backup = JSON.parse(raw) as {
        version?: number;
        settings?: Partial<{
          selectedPaper: string;
          selectedWeight: string;
          orientation: "portrait" | "landscape";
          copies: string;
          selectedProfile: string;
          colorMode: "color" | "bw";
          duplex: boolean;
          duplexEdge: "long" | "short";
          advanced: Partial<AdvancedSettings>;
        }>;
        activity?: string[];
      };
      if (![1, 2].includes(backup.version ?? 0) || !backup.settings) {
        showError(t.invalidBackup, t.restoreHint);
        return;
      }
      const settings = backup.settings;
      if (settings.selectedPaper) setSelectedPaper(settings.selectedPaper);
      if (settings.selectedWeight) setSelectedWeight(settings.selectedWeight);
      if (settings.orientation) setOrientation(settings.orientation);
      if (settings.copies) setCopies(settings.copies);
      if (settings.selectedProfile)
        setSelectedProfile(settings.selectedProfile);
      if (settings.colorMode) setColorMode(settings.colorMode);
      if (typeof settings.duplex === "boolean") setDuplex(settings.duplex);
      if (settings.duplexEdge) setDuplexEdge(settings.duplexEdge);
      if (settings.advanced) {
        const advanced = normalizeAdvancedSettings(settings.advanced);
        setPrintPages(advanced.printPages);
        setPrintScale(advanced.printScale);
        setPrintMargins(advanced.printMargins);
        setPrintCollate(advanced.printCollate);
        setScannerSource(advanced.scannerSource);
        setScannerAdf(advanced.scannerSource === "adf");
        setScannerDuplex(advanced.scannerDuplex);
        setScannerFormat(advanced.scannerFormat);
        setScannerDeskew(advanced.scannerDeskew);
        setScannerBlankPages(advanced.scannerBlankPages);
        setIdSize(advanced.idSize);
        setIdMargin(advanced.idMargin);
        setIdQuality(advanced.idQuality);
        setNumberPosition(advanced.numberPosition);
        setNumberVertical(advanced.numberVertical);
        setNumberMargin(advanced.numberMargin);
        setNumberFrom(advanced.numberFrom);
        setNumberTo(advanced.numberTo);
        setNumberStart(advanced.numberStart);
        setNumberWhich(advanced.numberWhich);
        setNumberFormat(advanced.numberFormat);
        setNumberNumerals(advanced.numberNumerals);
        setNumberSize(advanced.numberSize);
        setNumberColor(advanced.numberColor);
        setNumberFont(advanced.numberFont);
        setNumberBold(advanced.numberBold);
        setNumberMirror(advanced.numberMirror);
        setImageFit(advanced.imageFit);
        setExtractFormat(advanced.extractFormat);
      }
      if (Array.isArray(backup.activity)) setTasks(backup.activity.slice(0, 4));
      setErrorMessage(null);
      Alert.alert(t.restoreSuccess, result.assets[0].name);
    } catch {
      showError(t.restoreFailed, t.restoreHint);
    }
  };

  const chooseIdFace = async (
    side: "front" | "back",
    source: "camera" | "library",
  ) => {
    try {
      if (Platform.OS === "web") {
        showError(t.errorTitle, t.coming);
        return;
      }
      const ImagePicker = await loadImagePicker();
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          showError(t.cameraDenied, t.idWizardHint);
          return;
        }
      }
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [16, 10],
              quality: 0.9,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [16, 10],
              quality: 0.9,
            });
      if (result.canceled || !result.assets?.length) return;
      if (side === "front") setIdFrontUri(result.assets[0].uri);
      else setIdBackUri(result.assets[0].uri);
      setErrorMessage(null);
    } catch {
      showError(t.errorTitle, t.idWizardHint);
    }
  };

  const scanIdFaceFromKyocera = async (side: "front" | "back") => {
    if (!isValidIpv4(printerIp.trim())) {
      showError(t.scanNeedsConnection, t.scannerIpHint);
      return;
    }
    if (deviceMessage !== "connected") {
      await checkPrinterConnection();
      return;
    }
    setTasks((current) =>
      [
        `${t.scanIdFace}: ${side === "front" ? t.idFront : t.idBack}`,
        ...current,
      ].slice(0, 4),
    );
    Alert.alert(t.scanIdFace, t.scanProtocolMissing);
  };

  const createIdCardPdf = async () => {
    if (!hasBothIdFaces(idFrontUri, idBackUri)) {
      showError(t.idNeedBoth, t.idWizardHint);
      return;
    }
    setIdBusy(true);
    try {
      const faceUris = [idFrontUri, idBackUri] as [string, string];
      const [front, back] = await Promise.all(
        faceUris.map(async (uri) => {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return `data:image/jpeg;base64,${base64}`;
        }),
      );
      const cardWidth = idSize === "actual" ? "85.6mm" : "76mm";
      const cardHeight = idSize === "actual" ? "54mm" : "48mm";
      const html = `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"/><style>@page{size:A4;margin:0}body{margin:0;background:#fff}.page{box-sizing:border-box;width:210mm;height:297mm;padding:${Math.max(0, Number(idMargin) || 12)}mm;display:flex;flex-direction:column;align-items:center;justify-content:center;page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}.card{width:${cardWidth};height:${cardHeight};border:0.4mm solid #555;border-radius:2mm;object-fit:cover}.label{font:12px Arial;color:#334155;margin-top:5mm}</style></head><body><main class="page"><img class="card" src="${front}"/><div class="label">${isArabic ? "الوجه الأمامي — الصفحة الأولى" : "Front — page 1"}</div></main><main class="page"><img class="card" src="${back}"/><div class="label">${isArabic ? "الوجه الخلفي — الصفحة الثانية" : "Back — page 2"}</div></main></body></html>`;
      const generated = await Print.printToFileAsync({
        html,
        width: idQuality === "high" ? 1588 : 794,
        height: idQuality === "high" ? 2246 : 1123,
      });
      const outputUri = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}PrintPilot-ID-Card-${Date.now()}.pdf`;
      await FileSystem.copyAsync({ from: generated.uri, to: outputUri });
      setTasks((current) =>
        [`${t.idSuccess}: ${outputUri.split("/").pop()}`, ...current].slice(
          0,
          4,
        ),
      );
      setSelectedFiles([t.idWizard]);
      setErrorMessage(null);
      Alert.alert(t.idSuccess, outputUri, [
        { text: t.dismiss, style: "cancel" },
        {
          text: t.shareResult,
          onPress: async () => {
            if (await Sharing.isAvailableAsync())
              await Sharing.shareAsync(outputUri, {
                mimeType: "application/pdf",
                dialogTitle: t.shareResult,
              });
          },
        },
      ]);
    } catch {
      showError(t.idFailed, t.idWizardHint);
    } finally {
      setIdBusy(false);
    }
  };

  const checkPrinterConnection = async () => {
    const ip = printerIp.trim();
    if (!isValidIpv4(ip)) {
      showError(t.connectionFailed, t.scannerIpHint);
      return;
    }
    try {
      if (Platform.OS === "web") {
        showError(t.connectionFailed, t.scanUnavailableHint);
        return;
      }
      const Network = await loadNetwork();
      const [networkState, localIp] = await Promise.all([
        Network.getNetworkStateAsync(),
        Network.getIpAddressAsync(),
      ]);
      setPhoneIp(localIp);
      if (!networkState.isConnected) {
        setDeviceChecked(true);
        setDeviceMessage("not-found");
        showError(t.connectionFailed, t.scanUnavailableHint);
        return;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      try {
        const response = await fetch(`http://${ip}`, {
          method: "GET",
          signal: controller.signal,
        });
        setDeviceChecked(true);
        setDeviceMessage(response.ok ? "connected" : "not-found");
        if (response.ok)
          setTasks((current) =>
            [`${t.connected}: ${ip}`, ...current].slice(0, 4),
          );
        else showError(t.connectionFailed, t.scanUnavailableHint);
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      setDeviceChecked(true);
      setDeviceMessage("not-found");
      showError(t.connectionFailed, t.scanUnavailableHint);
    }
  };

  const previewTitleFor = (kind: PreviewKind) =>
    ({
      merge: t.previewMerge,
      images: t.previewImages,
      extract: t.previewExtract,
      numbering: t.previewNumbering,
      pages: t.previewPages,
      id: t.previewId,
      print: t.previewPrint,
    })[kind];
  const previewIcons: Record<
    PreviewKind,
    React.ComponentProps<typeof MaterialIcons>["name"]
  > = {
    merge: "merge-type",
    images: "photo-library",
    extract: "photo-filter",
    numbering: "format-list-numbered",
    pages: "view-list",
    id: "badge",
    print: "print",
  };
  const previewLabels: Record<PreviewKind, string> = {
    merge: t.previewMerge,
    images: t.previewImages,
    extract: t.previewExtract,
    numbering: t.previewNumbering,
    pages: t.previewPages,
    id: t.previewId,
    print: t.previewPrint,
  };

  const previewFileNames = selectedFiles.length
    ? selectedFiles
    : [t.previewEmpty];

  const continuePrint = async () => {
    if (!printUri) return;
    setPreviewKind(null);
    try {
      await Print.printAsync({ uri: printUri });
      setTasks((current) =>
        [`${t.printReady}: ${selectedFiles[0] ?? ""}`, ...current].slice(0, 4),
      );
      setErrorMessage(null);
    } catch {
      showError(t.printerUnavailable, t.printerUnavailableHint);
    }
  };

  const choosePageEditorPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const sourceBase64 = await FileSystem.readAsStringAsync(
        result.assets[0].uri,
        { encoding: FileSystem.EncodingType.Base64 },
      );
      const { PDFDocument } = await loadPdfLib();
      const document = await PDFDocument.load(base64ToBytes(sourceBase64));
      const pages = document.getPageCount();
      setPageEditorFile({
        uri: result.assets[0].uri,
        name: result.assets[0].name,
        pages,
      });
      setPageOrder(
        Array.from({ length: pages }, (_, index) => String(index + 1)).join(
          ", ",
        ),
      );
      setPageEdits(createPageEdits(pages));
      setSelectedPageIndex(null);
      setSelectedFiles([result.assets[0].name]);
      setPreviewKind("pages");
      setErrorMessage(null);
    } catch {
      showError(t.pageEditFailed, t.pickerCancelledHint);
    }
  };

  const applyPageEditor = async () => {
    if (!pageEditorFile) {
      showError(t.pageEditNeedFile, t.choosePageFile);
      return;
    }
    const order = pageEdits.map((page) => page.sourcePage);
    if (!canApplyPageOrder(order, pageEditorFile.pages)) {
      showError(t.pageEditNeedOrder, t.pageOrderHint);
      return;
    }
    setPageEditBusy(true);
    try {
      const sourceBase64 = await FileSystem.readAsStringAsync(
        pageEditorFile.uri,
        { encoding: FileSystem.EncodingType.Base64 },
      );
      const { PDFDocument } = await loadPdfLib();
      const source = await PDFDocument.load(base64ToBytes(sourceBase64));
      const output = await PDFDocument.create();
      const copied = await output.copyPages(
        source,
        order.map((page) => page - 1),
      );
      copied.forEach((page: any, index: number) => {
        const edit = pageEdits[index];
        if (edit?.rotation) page.setRotation({ angle: edit.rotation });
        output.addPage(page);
      });
      const outputUri = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}PrintPilot-Pages-${Date.now()}.pdf`;
      await FileSystem.writeAsStringAsync(
        outputUri,
        bytesToBase64(await output.save()),
        { encoding: FileSystem.EncodingType.Base64 },
      );
      const outputName = outputUri.split("/").pop() ?? pageEditorFile.name;
      setTasks((current) =>
        [`${t.pageEditSuccess}: ${outputName}`, ...current].slice(0, 4),
      );
      setSelectedFiles([outputName]);
      setPreviewKind(null);
      setErrorMessage(null);
      Alert.alert(t.pageEditSuccess, outputUri, [
        { text: t.dismiss, style: "cancel" },
        {
          text: t.shareResult,
          onPress: async () => {
            if (await Sharing.isAvailableAsync())
              await Sharing.shareAsync(outputUri, {
                mimeType: "application/pdf",
                dialogTitle: t.shareResult,
              });
          },
        },
      ]);
    } catch {
      showError(t.pageEditFailed, t.pageEditorHint);
    } finally {
      setPageEditBusy(false);
    }
  };

  const mergePdfs = async () => {
    try {
      const { PDFDocument } = await loadPdfLib();
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        multiple: true,
        copyToCacheDirectory: true,
      });
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
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const source = await PDFDocument.load(base64ToBytes(base64));
        const pages = await merged.copyPages(source, source.getPageIndices());
        pages.forEach((page: any) => merged.addPage(page));
      }
      const mergedBase64 = bytesToBase64(await merged.save());
      const outputUri = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}PrintPilot-Merged-${Date.now()}.pdf`;
      await FileSystem.writeAsStringAsync(outputUri, mergedBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setSelectedFiles(result.assets.map((asset) => asset.name));
      setTasks((current) =>
        [`${t.mergeSuccess}: ${result.assets.length}`, ...current].slice(0, 4),
      );
      setErrorMessage(null);
      Alert.alert(t.mergeSuccess, outputUri, [
        { text: t.dismiss, style: "cancel" },
        {
          text: t.shareResult,
          onPress: async () => {
            if (await Sharing.isAvailableAsync())
              await Sharing.shareAsync(outputUri, {
                mimeType: "application/pdf",
                dialogTitle: t.shareResult,
              });
            else showError(t.errorTitle, t.printerUnavailableHint);
          },
        },
      ]);
    } catch {
      showError(t.mergeFailed, t.coming);
    }
  };

  const imagesToPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (
        result.canceled ||
        !result.assets?.length ||
        !hasAtLeastFiles(result.assets.length)
      ) {
        showError(t.imagesNeedOne, t.imagesNeedOne);
        return;
      }
      const imageMarkup = await Promise.all(
        result.assets.map(async (asset) => {
          const base64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const mime = asset.mimeType || "image/jpeg";
          return `<section><img src="data:${mime};base64,${base64}" /></section>`;
        }),
      );
      const objectFit = imageFit === "fill" ? "cover" : "contain";
      const html = `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"/><style>@page{margin:0}body{margin:0;background:#fff}section{page-break-after:always;width:100%;height:100vh;display:flex;align-items:center;justify-content:center}section:last-child{page-break-after:auto}img{width:100%;height:100%;object-fit:${objectFit}}</style></head><body>${imageMarkup.join("")}</body></html>`;
      const generated = await Print.printToFileAsync({
        html,
        width: 794,
        height: 1123,
      });
      const outputUri = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}PrintPilot-Images-${Date.now()}.pdf`;
      await FileSystem.copyAsync({ from: generated.uri, to: outputUri });
      setSelectedFiles(result.assets.map((asset) => asset.name));
      const firstImage = result.assets[0];
      setPreviewAsset({
        uri: firstImage.uri,
        name: firstImage.name,
        size: firstImage.size,
        mimeType: firstImage.mimeType,
      });
      setTasks((current) =>
        [`${t.imagesSuccess}: ${result.assets.length}`, ...current].slice(0, 4),
      );
      setErrorMessage(null);
      Alert.alert(t.imagesSuccess, outputUri, [
        { text: t.dismiss, style: "cancel" },
        {
          text: t.shareResult,
          onPress: async () => {
            if (await Sharing.isAvailableAsync())
              await Sharing.shareAsync(outputUri, {
                mimeType: "application/pdf",
                dialogTitle: t.shareResult,
              });
            else showError(t.errorTitle, t.printerUnavailableHint);
          },
        },
      ]);
    } catch {
      showError(t.imagesFailed, t.coming);
    }
  };

  const chooseNumberingFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const sourceBase64 = await FileSystem.readAsStringAsync(
        result.assets[0].uri,
        { encoding: FileSystem.EncodingType.Base64 },
      );
      const { PDFDocument } = await loadPdfLib();
      const document = await PDFDocument.load(base64ToBytes(sourceBase64));
      setNumberingFile({
        uri: result.assets[0].uri,
        name: result.assets[0].name,
        pages: document.getPageCount(),
      });
      setPreviewAsset({
        uri: result.assets[0].uri,
        name: result.assets[0].name,
        size: result.assets[0].size,
        mimeType: result.assets[0].mimeType,
      });
      setErrorMessage(null);
    } catch {
      showError(t.numberingFailed, t.pickerCancelledHint);
    }
  };

  const numberPdf = async () => {
    if (!numberingFile) {
      showError(t.numberingNeedOne, t.chooseNumberingFile);
      return;
    }
    try {
      const { PDFDocument, StandardFonts, rgb } = await loadPdfLib();
      const sourceBase64 = await FileSystem.readAsStringAsync(
        numberingFile.uri,
        { encoding: FileSystem.EncodingType.Base64 },
      );
      const document = await PDFDocument.load(base64ToBytes(sourceBase64));
      const font = await document.embedFont(
        getNumberFont(StandardFonts, numberFont, numberBold),
      );
      const pages = document.getPages();
      const from = Math.max(1, Number(numberFrom) || 1);
      const to = Math.min(pages.length, Number(numberTo) || pages.length);
      const firstNumber = Math.max(0, Number(numberStart) || 0);
      const margin = Math.max(0, Number(numberMargin) || 0) * 2.83465;
      const size = Math.max(4, Math.min(72, Number(numberSize) || 9));
      const selected = getNumberingPages(pages.length, from, to, numberWhich);
      const total = selected.length;
      let sequence = 0;
      const hex = numberColor.replace("#", "");
      const red = parseInt(hex.slice(0, 2) || "52", 16) / 255;
      const green = parseInt(hex.slice(2, 4) || "98", 16) / 255;
      const blue = parseInt(hex.slice(4, 6) || "112", 16) / 255;
      pages.forEach((page: any, index: number) => {
        const pageNo = index + 1;
        if (!selected.includes(pageNo)) return;
        const shown = firstNumber + sequence;
        sequence += 1;
        let label = numberFormat
          .replace("{n}", formatNumberValue(shown, numberNumerals))
          .replace(
            "{t}",
            formatNumberValue(firstNumber + total - 1, numberNumerals),
          );
        const labelWidth = font.widthOfTextAtSize(label, size);
        const { width, height } = page.getSize();
        const mirroredPosition =
          numberMirror && pageNo % 2 === 0
            ? numberPosition === "left"
              ? "right"
              : numberPosition === "right"
                ? "left"
                : "center"
            : numberPosition;
        const x =
          mirroredPosition === "left"
            ? margin
            : mirroredPosition === "right"
              ? width - margin - labelWidth
              : (width - labelWidth) / 2;
        const y =
          numberVertical === "top"
            ? height - margin - size
            : numberVertical === "middle"
              ? (height - size) / 2
              : margin;
        page.drawText(label, {
          x,
          y,
          size,
          font,
          color: rgb(red, green, blue),
        });
      });
      const outputUri = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}PrintPilot-Numbered-${Date.now()}.pdf`;
      await FileSystem.writeAsStringAsync(
        outputUri,
        bytesToBase64(await document.save()),
        { encoding: FileSystem.EncodingType.Base64 },
      );
      setSelectedFiles([numberingFile.name]);
      setTasks((current) =>
        [`${t.numberingSuccess}: ${selected.length}`, ...current].slice(0, 4),
      );
      setErrorMessage(null);
      Alert.alert(t.numberingSuccess, outputUri, [
        { text: t.dismiss, style: "cancel" },
        {
          text: t.shareResult,
          onPress: async () => {
            if (await Sharing.isAvailableAsync())
              await Sharing.shareAsync(outputUri, {
                mimeType: "application/pdf",
                dialogTitle: t.shareResult,
              });
          },
        },
      ]);
    } catch {
      showError(t.numberingFailed, t.coming);
    }
  };

  const extractImages = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) {
        showError(t.pickerCancelled, t.pickerCancelledHint);
        return;
      }
      const sourceBase64 = await FileSystem.readAsStringAsync(
        result.assets[0].uri,
        { encoding: FileSystem.EncodingType.Base64 },
      );
      const sourceBytes = base64ToBytes(sourceBase64);
      setPreviewAsset({
        uri: result.assets[0].uri,
        name: result.assets[0].name,
        size: result.assets[0].size,
        mimeType: result.assets[0].mimeType,
      });
      const isPng = extractFormat === "png";
      const ranges = isPng
        ? findPngByteRanges(sourceBytes)
        : findJpegByteRanges(sourceBytes);
      if (!ranges.length) {
        showError(t.extractNone, t.extractNone);
        return;
      }
      const outputUris: string[] = [];
      for (const [index, range] of ranges.entries()) {
        const extension = isPng ? "png" : "jpg";
        const outputUri = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}PrintPilot-Image-${Date.now()}-${String(index + 1).padStart(2, "0")}.${extension}`;
        await FileSystem.writeAsStringAsync(
          outputUri,
          bytesToBase64(sourceBytes.slice(range.start, range.end)),
          { encoding: FileSystem.EncodingType.Base64 },
        );
        outputUris.push(outputUri);
      }
      setSelectedFiles([result.assets[0].name]);
      setTasks((current) =>
        [`${t.extractSuccess}: ${outputUris.length}`, ...current].slice(0, 4),
      );
      setErrorMessage(null);
      const outputType = extractFormat.toUpperCase();
      Alert.alert(t.extractSuccess, `${outputUris.length} ${outputType}`, [
        { text: t.dismiss, style: "cancel" },
        {
          text: t.shareResult,
          onPress: async () => {
            if (await Sharing.isAvailableAsync())
              await Sharing.shareAsync(outputUris[0], {
                mimeType: isPng ? "image/png" : "image/jpeg",
                dialogTitle: t.shareResult,
              });
            else showError(t.errorTitle, t.printerUnavailableHint);
          },
        },
      ]);
    } catch {
      showError(t.extractFailed, t.coming);
    }
  };

  const openPrintDialog = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) {
        showError(t.pickerCancelled, t.pickerCancelledHint);
        return;
      }
      const asset = result.assets[0];
      setSelectedFiles([asset.name]);
      setPrintUri(asset.uri);
      setPreviewAsset({
        uri: asset.uri,
        name: asset.name,
        size: asset.size,
        mimeType: asset.mimeType,
      });
      setPreviewKind("print");
    } catch {
      showError(t.printerUnavailable, t.printerUnavailableHint);
    }
  };

  const actionComing = () => showError(t.errorTitle, t.coming);
  const scanForDevices = () => {
    if (printerIp.trim()) {
      void checkPrinterConnection();
      return;
    }
    setDeviceChecked(true);
    setDeviceMessage("not-found");
    showError(t.connectionFailed, t.scannerIpHint);
  };

  return (
    <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 14, paddingBottom: 34 }}
      >
        <View
          style={[
            styles.header,
            { flexDirection: isArabic ? "row-reverse" : "row" },
          ]}
        >
          <View
            style={[
              styles.brandBlock,
              { alignItems: isArabic ? "flex-end" : "flex-start" },
            ]}
          >
            <Text style={[styles.eyebrow, { color: colors.muted }]}>
              {t.greeting}
            </Text>
            <View
              style={{
                flexDirection: isArabic ? "row-reverse" : "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <View
                style={[styles.brandMark, { backgroundColor: colors.primary }]}
              >
                <Icon name="print" color="#fff" size={20} />
              </View>
              <Text style={[styles.brandName, { color: colors.foreground }]}>
                {t.appName}
              </Text>
            </View>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {t.subtitle}
            </Text>
          </View>
          <View
            style={[
              styles.headerTools,
              { flexDirection: isArabic ? "row-reverse" : "row" },
            ]}
          >
            <Pressable
              onPress={() => setLanguage(isArabic ? "en" : "ar")}
              style={[
                styles.toolButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.langText, { color: colors.primary }]}>
                {t.language}
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                setColorScheme(colorScheme === "dark" ? "light" : "dark")
              }
              style={[
                styles.toolButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Icon
                name={colorScheme === "dark" ? "light-mode" : "dark-mode"}
                color={colors.foreground}
                size={20}
              />
            </Pressable>
          </View>
        </View>

        <View
          style={[
            styles.offlineBanner,
            {
              backgroundColor: colors.success + "14",
              borderColor: colors.success + "35",
              flexDirection: isArabic ? "row-reverse" : "row",
            },
          ]}
        >
          <Icon name="wifi-off" color={colors.success} size={18} />
          <Text style={[styles.offlineText, { color: colors.success }]}>
            {t.offline}
          </Text>
          <View
            style={[styles.statusDot, { backgroundColor: colors.success }]}
          />
        </View>

        {errorMessage && (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: colorScheme === "dark" ? "#3A2026" : "#FFF1F1",
                borderColor: colorScheme === "dark" ? "#A94B5C" : "#E7A4A9",
                flexDirection: isArabic ? "row-reverse" : "row",
              },
            ]}
          >
            <Icon
              name="error-outline"
              color={colorScheme === "dark" ? "#FF9AAA" : "#B42332"}
              size={21}
            />
            <View style={styles.errorCopy}>
              <Text
                style={[
                  styles.errorTitle,
                  {
                    color: colorScheme === "dark" ? "#FFD9DE" : "#8E1C29",
                    textAlign: isArabic ? "right" : "left",
                  },
                ]}
              >
                {errorMessage.title}
              </Text>
              <Text
                style={[
                  styles.errorHint,
                  {
                    color: colorScheme === "dark" ? "#F4BFC7" : "#7C3B43",
                    textAlign: isArabic ? "right" : "left",
                  },
                ]}
              >
                {errorMessage.hint}
              </Text>
            </View>
            <Pressable onPress={() => setErrorMessage(null)}>
              <Icon
                name="close"
                color={colorScheme === "dark" ? "#FFB2BF" : "#8E1C29"}
                size={19}
              />
            </Pressable>
          </View>
        )}

        <View style={workspace === "home" ? undefined : { display: "none" }}>
          <View
            style={[
              styles.hero,
              {
                backgroundColor: colors.primary,
                flexDirection: isArabic ? "row-reverse" : "row",
              },
            ]}
          >
            <View
              style={[
                styles.heroCopy,
                { alignItems: isArabic ? "flex-end" : "flex-start" },
              ]}
            >
              <Text style={styles.heroKicker}>{t.ready}</Text>
              <Text style={styles.heroTitle}>
                {isArabic
                  ? "أنجز مستندك\nبثقة"
                  : "Finish your document\nwith confidence"}
              </Text>
              <Text style={styles.heroDescription}>
                {isArabic
                  ? "طباعة، مسح، تنظيم — في مكان واحد."
                  : "Print, scan, organize — all in one place."}
              </Text>
            </View>
            <View style={styles.heroArt}>
              <Icon name="description" color="#fff" size={66} />
              <View style={styles.heroArtBadge}>
                <Icon name="check" color={colors.primary} size={17} />
              </View>
            </View>
          </View>

          <SectionTitle title={t.quick} colors={colors} />
          <View style={styles.actionsGrid}>
            <ActionCard
              icon="picture-as-pdf"
              title={t.workspacePdf}
              hint={t.workspacePdfHint}
              color="#0A7EA4"
              textColor={readableText}
              mutedColor={readableMuted}
              onPress={() => setWorkspace("pdf")}
            />
            <ActionCard
              icon="print"
              title={t.workspacePrint}
              hint={t.workspacePrintHint}
              color="#8B5CF6"
              textColor={readableText}
              mutedColor={readableMuted}
              onPress={() => setWorkspace("print")}
            />
            <ActionCard
              icon="document-scanner"
              title={t.workspaceScan}
              hint={t.workspaceScanHint}
              color="#F59E0B"
              textColor={readableText}
              mutedColor={readableMuted}
              onPress={() => setWorkspace("scan")}
            />
            <ActionCard
              icon="badge"
              title={t.workspaceId}
              hint={t.workspaceIdHint}
              color="#10B981"
              textColor={readableText}
              mutedColor={readableMuted}
              onPress={() => setWorkspace("id")}
            />
            <ActionCard
              icon="folder-special"
              title={t.workspaceResults}
              hint={t.workspaceResultsHint}
              color="#E45757"
              textColor={readableText}
              mutedColor={readableMuted}
              onPress={() => setWorkspace("results")}
            />
            <ActionCard
              icon="auto-awesome"
              title={t.workspaceAi}
              hint={t.workspaceAiHint}
              color="#7C3AED"
              textColor={readableText}
              mutedColor={readableMuted}
              onPress={() => setWorkspace("ai")}
            />
          </View>
        </View>
        <View style={{ display: "none" }}>
          <View
            style={[
              styles.previewHub,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.profileHeader,
                { flexDirection: isArabic ? "row-reverse" : "row" },
              ]}
            >
              <View
                style={[
                  styles.phaseIcon,
                  { backgroundColor: colors.primary + "18" },
                ]}
              >
                <Icon name="visibility" color={colors.primary} size={20} />
              </View>
              <View style={styles.phaseTitleBlock}>
                <Text
                  style={[styles.sectionTitle, { color: colors.foreground }]}
                >
                  {t.previewTitle}
                </Text>
                <Text style={[styles.phaseHint, { color: colors.muted }]}>
                  {isArabic
                    ? "كل وظيفة لها معاينتها الخاصة قبل المتابعة"
                    : "Each function has its own preview before continuing"}
                </Text>
              </View>
            </View>
            {previewKinds.map((kind) => (
              <Pressable
                key={kind}
                onPress={() => setPreviewKind(kind)}
                style={({ pressed }) => [
                  styles.previewRow,
                  {
                    borderTopColor: colors.border,
                    flexDirection: isArabic ? "row-reverse" : "row",
                  },
                  pressed && styles.rowPressed,
                ]}
              >
                <View
                  style={[
                    styles.previewIcon,
                    { backgroundColor: colors.primary + "14" },
                  ]}
                >
                  <Icon
                    name={previewIcons[kind]}
                    color={colors.primary}
                    size={18}
                  />
                </View>
                <Text
                  style={[styles.previewRowText, { color: colors.foreground }]}
                >
                  {previewLabels[kind]}
                </Text>
                <Icon name="chevron-right" color={colors.muted} size={18} />
              </Pressable>
            ))}
          </View>

          <View
            style={[
              styles.numberingCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.profileHeader,
                { flexDirection: isArabic ? "row-reverse" : "row" },
              ]}
            >
              <View
                style={[
                  styles.phaseIcon,
                  { backgroundColor: colors.error + "18" },
                ]}
              >
                <Icon
                  name="format-list-numbered"
                  color={colors.error}
                  size={20}
                />
              </View>
              <View style={styles.phaseTitleBlock}>
                <Text
                  style={[styles.sectionTitle, { color: colors.foreground }]}
                >
                  {t.numberingSettings}
                </Text>
                <Text style={[styles.phaseHint, { color: colors.muted }]}>
                  {numberingFile
                    ? `${numberingFile.name} · ${numberingFile.pages} ${isArabic ? "صفحة" : "pages"}`
                    : t.chooseNumberingFile}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={chooseNumberingFile}
              style={[styles.outlineAction, { borderColor: colors.primary }]}
            >
              <Icon name="folder-open" color={colors.primary} size={17} />
              <Text
                style={[styles.outlineActionText, { color: colors.primary }]}
              >
                {t.chooseNumberingFile}
              </Text>
            </Pressable>
            <Text
              style={[
                styles.smallLabel,
                { color: colors.muted, marginTop: 10 },
              ]}
            >
              {t.numberLeft} / {t.numberCenter} / {t.numberRight}
            </Text>
            <View
              style={[styles.segmented, { backgroundColor: colors.background }]}
            >
              {(
                [
                  ["left", t.numberLeft],
                  ["center", t.numberCenter],
                  ["right", t.numberRight],
                ] as [NumberPosition, string][]
              ).map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => setNumberPosition(value)}
                  style={[
                    styles.segment,
                    numberPosition === value && {
                      backgroundColor: colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color: numberPosition === value ? "#fff" : colors.muted,
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text
              style={[
                styles.smallLabel,
                { color: colors.muted, marginTop: 10 },
              ]}
            >
              {t.numberTop} / {t.numberMiddle} / {t.numberBottom}
            </Text>
            <View
              style={[styles.segmented, { backgroundColor: colors.background }]}
            >
              {(
                [
                  ["top", t.numberTop],
                  ["middle", t.numberMiddle],
                  ["bottom", t.numberBottom],
                ] as [NumberVertical, string][]
              ).map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => setNumberVertical(value)}
                  style={[
                    styles.segment,
                    numberVertical === value && {
                      backgroundColor: colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color: numberVertical === value ? "#fff" : colors.muted,
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View
              style={[
                styles.numberFieldsRow,
                { flexDirection: isArabic ? "row-reverse" : "row" },
              ]}
            >
              <View style={styles.numberField}>
                <Text style={[styles.smallLabel, { color: colors.muted }]}>
                  {t.numberMargin}
                </Text>
                <TextInput
                  value={numberMargin}
                  onChangeText={setNumberMargin}
                  keyboardType="numeric"
                  style={[
                    styles.copiesInput,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                />
              </View>
              <View style={styles.numberField}>
                <Text style={[styles.smallLabel, { color: colors.muted }]}>
                  {t.numberFrom}
                </Text>
                <TextInput
                  value={numberFrom}
                  onChangeText={setNumberFrom}
                  keyboardType="numeric"
                  style={[
                    styles.copiesInput,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                />
              </View>
              <View style={styles.numberField}>
                <Text style={[styles.smallLabel, { color: colors.muted }]}>
                  {t.numberTo}
                </Text>
                <TextInput
                  value={numberTo}
                  onChangeText={setNumberTo}
                  placeholder={
                    numberingFile ? String(numberingFile.pages) : "—"
                  }
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                  style={[
                    styles.copiesInput,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                />
              </View>
            </View>
            <View
              style={[
                styles.numberFieldsRow,
                { flexDirection: isArabic ? "row-reverse" : "row" },
              ]}
            >
              <View style={styles.numberField}>
                <Text style={[styles.smallLabel, { color: colors.muted }]}>
                  {t.numberStart}
                </Text>
                <TextInput
                  value={numberStart}
                  onChangeText={setNumberStart}
                  keyboardType="numeric"
                  style={[
                    styles.copiesInput,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                />
              </View>
              <View style={[styles.numberField, { flex: 2 }]}>
                <Text style={[styles.smallLabel, { color: colors.muted }]}>
                  {t.numberFormat}
                </Text>
                <TextInput
                  value={numberFormat}
                  onChangeText={setNumberFormat}
                  style={[
                    styles.copiesInput,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      textAlign: isArabic ? "right" : "left",
                    },
                  ]}
                />
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 7, paddingVertical: 8 }}
            >
              <Text
                style={[
                  styles.smallLabel,
                  { color: colors.muted, alignSelf: "center" },
                ]}
              >
                {t.numberWhich}
              </Text>
              {(
                [
                  ["all", t.numberAll],
                  ["odd", t.numberOdd],
                  ["even", t.numberEven],
                ] as [NumberWhich, string][]
              ).map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => setNumberWhich(value)}
                  style={[
                    styles.pill,
                    {
                      backgroundColor:
                        numberWhich === value
                          ? colors.primary
                          : colors.background,
                      borderColor:
                        numberWhich === value ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      {
                        color:
                          numberWhich === value ? "#fff" : colors.foreground,
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 7, paddingVertical: 2 }}
            >
              <Text
                style={[
                  styles.smallLabel,
                  { color: colors.muted, alignSelf: "center" },
                ]}
              >
                {t.numberNumerals}
              </Text>
              {(
                [
                  ["latin", "1 2 3"],
                  ["indic", "١ ٢ ٣"],
                  ["roman-l", "i ii iii"],
                  ["roman-u", "I II III"],
                ] as [NumberNumerals, string][]
              ).map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => setNumberNumerals(value)}
                  style={[
                    styles.pill,
                    {
                      backgroundColor:
                        numberNumerals === value
                          ? colors.primary
                          : colors.background,
                      borderColor:
                        numberNumerals === value
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      {
                        color:
                          numberNumerals === value ? "#fff" : colors.foreground,
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View
              style={[
                styles.numberFieldsRow,
                { flexDirection: isArabic ? "row-reverse" : "row" },
              ]}
            >
              <View style={styles.numberField}>
                <Text style={[styles.smallLabel, { color: colors.muted }]}>
                  {t.numberSize}
                </Text>
                <TextInput
                  value={numberSize}
                  onChangeText={setNumberSize}
                  keyboardType="numeric"
                  style={[
                    styles.copiesInput,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                />
              </View>
              <View style={[styles.numberField, { flex: 2 }]}>
                <Text style={[styles.smallLabel, { color: colors.muted }]}>
                  {t.numberFont}
                </Text>
                <View
                  style={[
                    styles.segmented,
                    { backgroundColor: colors.background, marginTop: 0 },
                  ]}
                >
                  {(
                    [
                      ["helvetica", "Helvetica"],
                      ["times", "Times"],
                      ["courier", "Courier"],
                    ] as [NumberFont, string][]
                  ).map(([value, label]) => (
                    <Pressable
                      key={value}
                      onPress={() => setNumberFont(value)}
                      style={[
                        styles.segment,
                        numberFont === value && {
                          backgroundColor: colors.primary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          {
                            color: numberFont === value ? "#fff" : colors.muted,
                          },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
            <View
              style={[
                styles.numberToggleRow,
                {
                  flexDirection: isArabic ? "row-reverse" : "row",
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.segmentText, { color: colors.foreground }]}>
                {t.numberBold}
              </Text>
              <Switch
                value={numberBold}
                onValueChange={setNumberBold}
                trackColor={{
                  false: colors.border,
                  true: colors.primary + "66",
                }}
                thumbColor={numberBold ? colors.primary : colors.muted}
              />
            </View>
            <View
              style={[
                styles.numberToggleRow,
                {
                  flexDirection: isArabic ? "row-reverse" : "row",
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.segmentText, { color: colors.foreground }]}>
                {t.numberMirror}
              </Text>
              <Switch
                value={numberMirror}
                onValueChange={setNumberMirror}
                trackColor={{
                  false: colors.border,
                  true: colors.primary + "66",
                }}
                thumbColor={numberMirror ? colors.primary : colors.muted}
              />
            </View>
            <TextInput
              value={numberColor}
              onChangeText={setNumberColor}
              autoCapitalize="none"
              placeholder="#526270"
              placeholderTextColor={colors.muted}
              style={[
                styles.colorInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            />
            <Pressable
              disabled={!numberingFile}
              onPress={numberPdf}
              style={({ pressed }) => [
                styles.printButton,
                {
                  backgroundColor: numberingFile
                    ? colors.primary
                    : colors.border,
                  marginTop: 10,
                },
                pressed && styles.pressed,
              ]}
            >
              <Icon name="format-list-numbered" color="#fff" size={18} />
              <Text style={styles.printButtonText}>{t.runNumbering}</Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.pageEditorCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.profileHeader,
                { flexDirection: isArabic ? "row-reverse" : "row" },
              ]}
            >
              <View
                style={[
                  styles.phaseIcon,
                  { backgroundColor: colors.primary + "18" },
                ]}
              >
                <Icon name="view-list" color={colors.primary} size={20} />
              </View>
              <View style={styles.phaseTitleBlock}>
                <Text
                  style={[styles.sectionTitle, { color: colors.foreground }]}
                >
                  {t.pageEditor}
                </Text>
                <Text style={[styles.phaseHint, { color: colors.muted }]}>
                  {t.pageEditorHint}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={choosePageEditorPdf}
              style={[styles.outlineAction, { borderColor: colors.primary }]}
            >
              <Icon name="folder-open" color={colors.primary} size={17} />
              <Text
                style={[styles.outlineActionText, { color: colors.primary }]}
              >
                {t.choosePageFile}
              </Text>
            </Pressable>
            <Text
              style={[
                styles.smallLabel,
                { color: colors.muted, marginTop: 10 },
              ]}
            >
              {pageEditorFile
                ? `${pageEditorFile.name} · ${pageEditorFile.pages} ${isArabic ? "صفحة" : "pages"}`
                : t.pageOrderHint}
            </Text>
            <TextInput
              value={pageOrder}
              onChangeText={setPageOrder}
              editable={Boolean(pageEditorFile)}
              placeholder="1, 2, 3"
              placeholderTextColor={colors.muted}
              keyboardType="numbers-and-punctuation"
              style={[
                styles.pageOrderInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  textAlign: isArabic ? "right" : "left",
                },
              ]}
            />
            <Pressable
              onPress={() => setPreviewKind("pages")}
              disabled={!pageEditorFile}
              style={[
                styles.outlineAction,
                {
                  borderColor: pageEditorFile ? colors.primary : colors.border,
                  marginTop: 9,
                },
              ]}
            >
              <Icon
                name="visibility"
                color={pageEditorFile ? colors.primary : colors.muted}
                size={17}
              />
              <Text
                style={[
                  styles.outlineActionText,
                  { color: pageEditorFile ? colors.primary : colors.muted },
                ]}
              >
                {t.previewPages}
              </Text>
            </Pressable>
            <Pressable
              disabled={pageEditBusy || !pageEditorFile}
              onPress={applyPageEditor}
              style={({ pressed }) => [
                styles.printButton,
                {
                  backgroundColor: pageEditorFile
                    ? colors.primary
                    : colors.border,
                  marginTop: 9,
                },
                pressed && styles.pressed,
              ]}
            >
              <Icon name="save" color="#fff" size={18} />
              <Text style={styles.printButtonText}>
                {pageEditBusy ? "…" : t.applyPageEdit}
              </Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.idCardCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.profileHeader,
                { flexDirection: isArabic ? "row-reverse" : "row" },
              ]}
            >
              <View
                style={[
                  styles.phaseIcon,
                  { backgroundColor: colors.warning + "18" },
                ]}
              >
                <Icon name="badge" color={colors.warning} size={20} />
              </View>
              <View style={styles.phaseTitleBlock}>
                <Text
                  style={[styles.sectionTitle, { color: colors.foreground }]}
                >
                  {t.idWizard}
                </Text>
                <Text style={[styles.phaseHint, { color: colors.muted }]}>
                  {t.idWizardHint}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.idFacesRow,
                { flexDirection: isArabic ? "row-reverse" : "row" },
              ]}
            >
              {[
                { side: "front" as const, uri: idFrontUri, label: t.idFront },
                { side: "back" as const, uri: idBackUri, label: t.idBack },
              ].map((face) => (
                <View key={face.side} style={styles.idFaceBlock}>
                  <View
                    style={[
                      styles.idPreview,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    {face.uri ? (
                      <Image
                        source={{ uri: face.uri }}
                        style={styles.idPreviewImage}
                      />
                    ) : (
                      <Icon name="scanner" color={colors.muted} size={28} />
                    )}
                  </View>
                  <Text
                    style={[styles.idFaceLabel, { color: colors.foreground }]}
                  >
                    {face.label}
                  </Text>
                  <Pressable
                    onPress={() => scanIdFaceFromKyocera(face.side)}
                    style={[
                      styles.miniButton,
                      {
                        borderColor: colors.primary,
                        backgroundColor: colors.primary + "10",
                      },
                    ]}
                  >
                    <Icon name="scanner" color={colors.primary} size={15} />
                    <Text
                      style={[styles.miniButtonText, { color: colors.primary }]}
                    >
                      {t.scanIdFace}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => chooseIdFace(face.side, "library")}
                    style={[styles.miniButton, { borderColor: colors.border }]}
                  >
                    <Icon name="photo-library" color={colors.muted} size={15} />
                    <Text
                      style={[styles.miniButtonText, { color: colors.muted }]}
                    >
                      {t.choosePhoto}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
            <Pressable
              disabled={idBusy}
              onPress={createIdCardPdf}
              style={({ pressed }) => [
                styles.printButton,
                {
                  backgroundColor:
                    idFrontUri && idBackUri ? colors.primary : colors.border,
                  marginTop: 12,
                },
                pressed && styles.pressed,
              ]}
            >
              <Icon name="picture-as-pdf" color="#fff" size={18} />
              <Text style={styles.printButtonText}>
                {idBusy ? "…" : t.makeIdPdf}
              </Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.sectionHeader,
              { flexDirection: isArabic ? "row-reverse" : "row" },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {t.recent}
            </Text>
            <Pressable onPress={actionComing}>
              <Text style={[styles.viewAll, { color: colors.primary }]}>
                {t.viewAll}
              </Text>
            </Pressable>
          </View>
          <View
            style={[
              styles.filesCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <FileRow
              name={t.file1}
              time={t.today}
              icon="picture-as-pdf"
              colors={colors}
              onPress={openPrintDialog}
            />
            <FileRow
              name={t.file2}
              time={t.yesterday}
              icon="picture-as-pdf"
              colors={colors}
              onPress={openPrintDialog}
            />
            <FileRow
              name={t.file3}
              time={t.yesterday}
              icon="picture-as-pdf"
              colors={colors}
              onPress={openPrintDialog}
            />
          </View>

          <View
            style={[
              styles.sectionHeader,
              { flexDirection: isArabic ? "row-reverse" : "row" },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {t.paper}
            </Text>
            <Icon name="tune" color={colors.primary} size={20} />
          </View>
          <View
            style={[
              styles.settingsCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <SettingLabel
              title={t.format}
              value={`${paper.ar} · ${paper.size}`}
              colors={colors}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 10 }}
            >
              {paperOptions.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => setSelectedPaper(option.id)}
                  style={[
                    styles.pill,
                    {
                      backgroundColor:
                        selectedPaper === option.id
                          ? colors.primary
                          : colors.background,
                      borderColor:
                        selectedPaper === option.id
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      {
                        color:
                          selectedPaper === option.id
                            ? "#fff"
                            : colors.foreground,
                      },
                    ]}
                  >
                    {isArabic ? option.ar : option.en}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />
            <SettingLabel
              title={t.weight}
              value={selectedWeight}
              colors={colors}
            />
            <View
              style={[
                styles.weightRow,
                { flexDirection: isArabic ? "row-reverse" : "row" },
              ]}
            >
              {[
                ["70 g/m²", "خفيف"],
                ["80 g/m²", "عادي"],
                ["120 g/m²", "متوسط"],
                ["200 g/m²", "شهادة"],
              ].map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => setSelectedWeight(value)}
                  style={[
                    styles.weightItem,
                    {
                      backgroundColor:
                        selectedWeight === value
                          ? colors.primary + "16"
                          : colors.background,
                      borderColor:
                        selectedWeight === value
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.weightValue,
                      {
                        color:
                          selectedWeight === value
                            ? colors.primary
                            : colors.foreground,
                      },
                    ]}
                  >
                    {value}
                  </Text>
                  <Text style={[styles.weightLabel, { color: colors.muted }]}>
                    {isArabic
                      ? label
                      : value === "70 g/m²"
                        ? "Light"
                        : value === "80 g/m²"
                          ? "Standard"
                          : value === "120 g/m²"
                            ? "Medium"
                            : "Certificate"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />
            <SettingLabel
              title={t.orientation}
              value={orientation === "portrait" ? t.portrait : t.landscape}
              colors={colors}
            />
            <View
              style={[styles.segmented, { backgroundColor: colors.background }]}
            >
              <Pressable
                onPress={() => setOrientation("portrait")}
                style={[
                  styles.segment,
                  orientation === "portrait" && {
                    backgroundColor: colors.primary,
                  },
                ]}
              >
                <Icon
                  name="crop-portrait"
                  color={orientation === "portrait" ? "#fff" : colors.muted}
                  size={18}
                />
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: orientation === "portrait" ? "#fff" : colors.muted,
                    },
                  ]}
                >
                  {t.portrait}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setOrientation("landscape")}
                style={[
                  styles.segment,
                  orientation === "landscape" && {
                    backgroundColor: colors.primary,
                  },
                ]}
              >
                <Icon
                  name="crop-landscape"
                  color={orientation === "landscape" ? "#fff" : colors.muted}
                  size={18}
                />
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color:
                        orientation === "landscape" ? "#fff" : colors.muted,
                    },
                  ]}
                >
                  {t.landscape}
                </Text>
              </Pressable>
            </View>
            <SettingLabel
              title={t.colorMode}
              value={colorMode === "color" ? t.color : t.bw}
              colors={colors}
            />
            <View
              style={[styles.segmented, { backgroundColor: colors.background }]}
            >
              <Pressable
                onPress={() => setColorMode("color")}
                style={[
                  styles.segment,
                  colorMode === "color" && { backgroundColor: colors.primary },
                ]}
              >
                <Icon
                  name="palette"
                  color={colorMode === "color" ? "#fff" : colors.muted}
                  size={18}
                />
                <Text
                  style={[
                    styles.segmentText,
                    { color: colorMode === "color" ? "#fff" : colors.muted },
                  ]}
                >
                  {t.color}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setColorMode("bw")}
                style={[
                  styles.segment,
                  colorMode === "bw" && { backgroundColor: colors.primary },
                ]}
              >
                <Icon
                  name="tonality"
                  color={colorMode === "bw" ? "#fff" : colors.muted}
                  size={18}
                />
                <Text
                  style={[
                    styles.segmentText,
                    { color: colorMode === "bw" ? "#fff" : colors.muted },
                  ]}
                >
                  {t.bw}
                </Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => setDuplex((value) => !value)}
              style={[
                styles.duplexToggle,
                {
                  borderColor: duplex ? colors.primary : colors.border,
                  backgroundColor: duplex
                    ? colors.primary + "14"
                    : colors.background,
                  flexDirection: isArabic ? "row-reverse" : "row",
                },
              ]}
            >
              <Icon
                name="flip"
                color={duplex ? colors.primary : colors.muted}
                size={18}
              />
              <Text
                style={[
                  styles.segmentText,
                  { color: duplex ? colors.primary : colors.muted },
                ]}
              >
                {duplex ? t.duplex : t.oneSided}
              </Text>
            </Pressable>
            {duplex && (
              <View style={styles.duplexEdgeBlock}>
                <Text style={[styles.smallLabel, { color: colors.muted }]}>
                  {t.duplexEdge}
                </Text>
                <View
                  style={[
                    styles.segmented,
                    { backgroundColor: colors.background, marginTop: 5 },
                  ]}
                >
                  <Pressable
                    onPress={() => setDuplexEdge("long")}
                    style={[
                      styles.segment,
                      duplexEdge === "long" && {
                        backgroundColor: colors.primary,
                      },
                    ]}
                  >
                    <Icon
                      name="flip-to-front"
                      color={duplexEdge === "long" ? "#fff" : colors.muted}
                      size={17}
                    />
                    <Text
                      style={[
                        styles.segmentText,
                        {
                          color: duplexEdge === "long" ? "#fff" : colors.muted,
                        },
                      ]}
                    >
                      {t.longEdge}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setDuplexEdge("short")}
                    style={[
                      styles.segment,
                      duplexEdge === "short" && {
                        backgroundColor: colors.primary,
                      },
                    ]}
                  >
                    <Icon
                      name="flip-to-back"
                      color={duplexEdge === "short" ? "#fff" : colors.muted}
                      size={17}
                    />
                    <Text
                      style={[
                        styles.segmentText,
                        {
                          color: duplexEdge === "short" ? "#fff" : colors.muted,
                        },
                      ]}
                    >
                      {t.shortEdge}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
            <View
              style={[
                styles.printFooter,
                { flexDirection: isArabic ? "row-reverse" : "row" },
              ]}
            >
              <View style={styles.copiesBlock}>
                <Text style={[styles.smallLabel, { color: colors.muted }]}>
                  {t.copies}
                </Text>
                <TextInput
                  value={copies}
                  onChangeText={setCopies}
                  keyboardType="number-pad"
                  style={[
                    styles.copiesInput,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                />
              </View>
              <Pressable
                onPress={openPrintDialog}
                style={({ pressed }) => [
                  styles.printButton,
                  { backgroundColor: colors.primary },
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="print" color="#fff" size={19} />
                <Text style={styles.printButtonText}>{t.openPrint}</Text>
              </Pressable>
            </View>
          </View>

          <View
            style={[
              styles.profileCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.profileHeader,
                { flexDirection: isArabic ? "row-reverse" : "row" },
              ]}
            >
              <View
                style={[
                  styles.phaseIcon,
                  { backgroundColor: colors.primary + "18" },
                ]}
              >
                <Icon name="bookmark" color={colors.primary} size={20} />
              </View>
              <View style={styles.phaseTitleBlock}>
                <Text
                  style={[styles.sectionTitle, { color: colors.foreground }]}
                >
                  {t.profiles}
                </Text>
                <Text style={[styles.phaseHint, { color: colors.muted }]}>
                  {t.profilesHint}
                </Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingTop: 10 }}
            >
              {printProfiles.map((profile) => (
                <Pressable
                  key={profile.id}
                  onPress={() => applyProfile(profile.id)}
                  style={[
                    styles.profilePill,
                    {
                      backgroundColor:
                        selectedProfile === profile.id
                          ? colors.primary
                          : colors.background,
                      borderColor:
                        selectedProfile === profile.id
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.profilePillText,
                      {
                        color:
                          selectedProfile === profile.id
                            ? "#fff"
                            : colors.foreground,
                      },
                    ]}
                  >
                    {isArabic ? profile.ar : profile.en}
                  </Text>
                  <Text
                    style={[
                      styles.profilePillHint,
                      {
                        color:
                          selectedProfile === profile.id
                            ? "#DDF6FA"
                            : colors.muted,
                      },
                    ]}
                  >
                    {profile.duplex
                      ? t.duplex
                      : profile.colorMode === "color"
                        ? t.color
                        : t.bw}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View
            style={[
              styles.smartCard,
              {
                backgroundColor: colorScheme === "dark" ? "#1D2C3B" : "#EEF6FA",
                borderColor: colors.primary + "38",
              },
            ]}
          >
            <View
              style={[
                styles.sectionHeader,
                {
                  flexDirection: isArabic ? "row-reverse" : "row",
                  marginBottom: 4,
                },
              ]}
            >
              <View
                style={[
                  styles.aiTitle,
                  { flexDirection: isArabic ? "row-reverse" : "row" },
                ]}
              >
                <View
                  style={[styles.aiIcon, { backgroundColor: colors.primary }]}
                >
                  <Icon name="auto-awesome" color="#fff" size={19} />
                </View>
                <View>
                  <Text
                    style={[styles.sectionTitle, { color: colors.foreground }]}
                  >
                    {t.smart}
                  </Text>
                  <Text style={[styles.aiHint, { color: colors.muted }]}>
                    {t.smartHint}
                  </Text>
                </View>
              </View>
              <Switch
                value={aiEnabled}
                onValueChange={setAiEnabled}
                trackColor={{
                  false: colors.border,
                  true: colors.primary + "66",
                }}
                thumbColor={aiEnabled ? colors.primary : colors.muted}
              />
            </View>
            {aiEnabled ? (
              <View
                style={[
                  styles.aiBody,
                  { flexDirection: isArabic ? "row-reverse" : "row" },
                ]}
              >
                <TextInput
                  value={command}
                  onChangeText={setCommand}
                  placeholder={t.placeholder}
                  placeholderTextColor={colors.muted}
                  multiline
                  style={[
                    styles.commandInput,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      textAlign: isArabic ? "right" : "left",
                    },
                  ]}
                />
                <Pressable
                  onPress={() => Alert.alert(t.smart, command || t.noInternet)}
                  style={({ pressed }) => [
                    styles.executeButton,
                    { backgroundColor: colors.primary },
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon name="play-arrow" color="#fff" size={20} />
                  <Text style={styles.executeText}>{t.execute}</Text>
                </Pressable>
              </View>
            ) : (
              <Text
                style={[
                  styles.aiOffText,
                  {
                    color: colors.muted,
                    textAlign: isArabic ? "right" : "left",
                  },
                ]}
              >
                {t.smartAction} · {t.noInternet}
              </Text>
            )}
          </View>

          <View
            style={[
              styles.roadmapCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.roadmapHeader,
                { flexDirection: isArabic ? "row-reverse" : "row" },
              ]}
            >
              <View
                style={[
                  styles.roadmapIcon,
                  { backgroundColor: colors.primary + "18" },
                ]}
              >
                <Icon name="alt-route" color={colors.primary} size={21} />
              </View>
              <View style={styles.roadmapTitleBlock}>
                <Text
                  style={[styles.sectionTitle, { color: colors.foreground }]}
                >
                  {t.roadmap}
                </Text>
                <Text style={[styles.roadmapHint, { color: colors.muted }]}>
                  {t.roadmapHint}
                </Text>
              </View>
            </View>
            {[
              {
                title: t.stage1,
                hint: t.stage1Hint,
                icon: "folder-special" as const,
                done: true,
              },
              {
                title: t.stage2,
                hint: t.stage2Hint,
                icon: "print" as const,
                done: false,
              },
              {
                title: t.stage3,
                hint: t.stage3Hint,
                icon: "security" as const,
                done: false,
              },
              {
                title: t.stage4,
                hint: t.stage4Hint,
                icon: "auto-awesome" as const,
                done: false,
              },
            ].map((stage, index) => (
              <View
                key={stage.title}
                style={[
                  styles.roadmapRow,
                  {
                    flexDirection: isArabic ? "row-reverse" : "row",
                    borderTopColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.roadmapStep,
                    {
                      backgroundColor: stage.done
                        ? colors.success + "18"
                        : colors.background,
                      borderColor: stage.done ? colors.success : colors.border,
                    },
                  ]}
                >
                  <Icon
                    name={stage.icon}
                    color={stage.done ? colors.success : colors.muted}
                    size={17}
                  />
                </View>
                <View style={styles.roadmapCopy}>
                  <Text
                    style={[styles.roadmapStage, { color: colors.foreground }]}
                  >
                    {stage.title}
                  </Text>
                  <Text
                    style={[styles.roadmapStageHint, { color: colors.muted }]}
                  >
                    {stage.hint}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.roadmapStatus,
                    { color: stage.done ? colors.success : colors.muted },
                  ]}
                >
                  {stage.done
                    ? isArabic
                      ? "جاهز"
                      : "Ready"
                    : isArabic
                      ? "قادم"
                      : "Next"}
                </Text>
              </View>
            ))}
          </View>

          <View
            style={[
              styles.phaseCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.phaseHeader,
                { flexDirection: isArabic ? "row-reverse" : "row" },
              ]}
            >
              <View
                style={[
                  styles.phaseIcon,
                  { backgroundColor: colors.primary + "18" },
                ]}
              >
                <Icon name="devices" color={colors.primary} size={21} />
              </View>
              <View style={styles.phaseTitleBlock}>
                <Text
                  style={[styles.sectionTitle, { color: colors.foreground }]}
                >
                  {t.phase2}
                </Text>
                <Text style={[styles.phaseHint, { color: colors.muted }]}>
                  {t.phase2Hint}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.deviceRow,
                {
                  flexDirection: isArabic ? "row-reverse" : "row",
                  borderTopColor: colors.border,
                },
              ]}
            >
              <Icon name="print" color={colors.primary} size={19} />
              <View style={styles.deviceCopy}>
                <Text style={[styles.deviceName, { color: colors.foreground }]}>
                  {t.printerName}
                </Text>
                <Text
                  style={[
                    styles.deviceState,
                    {
                      color:
                        deviceMessage === "connected"
                          ? colors.success
                          : deviceMessage === "not-found"
                            ? colors.error
                            : colors.muted,
                    },
                  ]}
                >
                  {deviceMessage === "connected"
                    ? t.connected
                    : deviceChecked
                      ? t.connectionFailed
                      : t.notChecked}
                </Text>
              </View>
              <View
                style={[
                  styles.stateDot,
                  {
                    backgroundColor:
                      deviceMessage === "connected"
                        ? colors.success
                        : deviceMessage === "not-found"
                          ? colors.error
                          : colors.warning,
                  },
                ]}
              />
            </View>
            <View
              style={[
                styles.deviceRow,
                {
                  flexDirection: isArabic ? "row-reverse" : "row",
                  borderTopColor: colors.border,
                },
              ]}
            >
              <Icon name="document-scanner" color={colors.primary} size={19} />
              <View style={styles.deviceCopy}>
                <Text style={[styles.deviceName, { color: colors.foreground }]}>
                  {t.scan}
                </Text>
                <Text
                  style={[
                    styles.deviceState,
                    {
                      color:
                        deviceMessage === "connected"
                          ? colors.success
                          : deviceMessage === "not-found"
                            ? colors.error
                            : colors.muted,
                    },
                  ]}
                >
                  {deviceMessage === "connected"
                    ? t.connected
                    : deviceChecked
                      ? t.connectionFailed
                      : t.notChecked}
                </Text>
              </View>
              <View
                style={[
                  styles.stateDot,
                  {
                    backgroundColor:
                      deviceMessage === "connected"
                        ? colors.success
                        : deviceMessage === "not-found"
                          ? colors.error
                          : colors.warning,
                  },
                ]}
              />
            </View>
            <Text
              style={[styles.scannerSectionTitle, { color: colors.foreground }]}
            >
              {t.scannerSettings}
            </Text>
            <TextInput
              value={printerIp}
              onChangeText={setPrinterIp}
              placeholder={t.scannerIpHint}
              placeholderTextColor={colors.muted}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              style={[
                styles.scannerInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  textAlign: isArabic ? "right" : "left",
                },
              ]}
            />
            <Text style={[styles.scannerNetworkText, { color: colors.muted }]}>
              {t.networkAddress}: {phoneIp || "—"}
            </Text>
            <View
              style={[
                styles.scannerOptionRow,
                { flexDirection: isArabic ? "row-reverse" : "row" },
              ]}
            >
              <Text style={[styles.scannerLabel, { color: colors.muted }]}>
                {t.dpi}
              </Text>
              <View
                style={[
                  styles.scannerPills,
                  { flexDirection: isArabic ? "row-reverse" : "row" },
                ]}
              >
                {["200", "300", "600"].map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setScannerDpi(value)}
                    style={[
                      styles.scannerPill,
                      {
                        backgroundColor:
                          scannerDpi === value
                            ? colors.primary
                            : colors.background,
                        borderColor:
                          scannerDpi === value ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.scannerPillText,
                        {
                          color:
                            scannerDpi === value ? "#fff" : colors.foreground,
                        },
                      ]}
                    >
                      {value}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View
              style={[
                styles.scannerOptionRow,
                { flexDirection: isArabic ? "row-reverse" : "row" },
              ]}
            >
              <Text style={[styles.scannerLabel, { color: colors.muted }]}>
                {t.colorMode}
              </Text>
              <View
                style={[
                  styles.scannerPills,
                  { flexDirection: isArabic ? "row-reverse" : "row" },
                ]}
              >
                {[
                  ["color", t.scanColor],
                  ["bw", t.scanBw],
                ].map(([value, label]) => (
                  <Pressable
                    key={value}
                    onPress={() => setScannerColor(value as "color" | "bw")}
                    style={[
                      styles.scannerPill,
                      {
                        backgroundColor:
                          scannerColor === value
                            ? colors.primary
                            : colors.background,
                        borderColor:
                          scannerColor === value
                            ? colors.primary
                            : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.scannerPillText,
                        {
                          color:
                            scannerColor === value ? "#fff" : colors.foreground,
                        },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Pressable
              onPress={() => setScannerAdf((value) => !value)}
              style={[
                styles.scannerAdf,
                {
                  borderColor: scannerAdf ? colors.primary : colors.border,
                  backgroundColor: scannerAdf
                    ? colors.primary + "14"
                    : colors.background,
                  flexDirection: isArabic ? "row-reverse" : "row",
                },
              ]}
            >
              <Icon
                name="layers"
                color={scannerAdf ? colors.primary : colors.muted}
                size={17}
              />
              <Text
                style={[
                  styles.scannerLabel,
                  { color: scannerAdf ? colors.primary : colors.muted },
                ]}
              >
                {t.adf}
              </Text>
            </Pressable>
            <Pressable
              onPress={scanForDevices}
              style={({ pressed }) => [
                styles.outlineAction,
                { borderColor: colors.primary },
                pressed && styles.pressed,
              ]}
            >
              <Icon name="refresh" color={colors.primary} size={17} />
              <Text
                style={[styles.outlineActionText, { color: colors.primary }]}
              >
                {t.checkDevices}
              </Text>
            </Pressable>
            <View
              style={[
                styles.taskHeader,
                {
                  flexDirection: isArabic ? "row-reverse" : "row",
                  borderTopColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.taskTitle, { color: colors.foreground }]}>
                {t.taskManager}
              </Text>
              <Text style={[styles.taskCount, { color: colors.muted }]}>
                {tasks.length}
              </Text>
            </View>
            {tasks.length ? (
              tasks.map((task) => (
                <Text
                  key={task}
                  style={[styles.taskItem, { color: colors.muted }]}
                >
                  {task}
                </Text>
              ))
            ) : (
              <Text style={[styles.taskEmpty, { color: colors.muted }]}>
                {t.noTasks}
              </Text>
            )}
            {tasks.length > 0 && (
              <Pressable
                onPress={cancelAllTasks}
                style={({ pressed }) => [
                  styles.cancelTasksButton,
                  { borderColor: colors.error },
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="cancel" color={colors.error} size={17} />
                <Text
                  style={[styles.outlineActionText, { color: colors.error }]}
                >
                  {t.cancelAll}
                </Text>
              </Pressable>
            )}
          </View>

          <View
            style={[
              styles.phaseCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.phaseHeader,
                { flexDirection: isArabic ? "row-reverse" : "row" },
              ]}
            >
              <View
                style={[
                  styles.phaseIcon,
                  { backgroundColor: colors.success + "18" },
                ]}
              >
                <Icon name="shield" color={colors.success} size={21} />
              </View>
              <View style={styles.phaseTitleBlock}>
                <Text
                  style={[styles.sectionTitle, { color: colors.foreground }]}
                >
                  {t.phase3}
                </Text>
                <Text style={[styles.phaseHint, { color: colors.muted }]}>
                  {t.phase3Hint}
                </Text>
              </View>
            </View>
            <PrivacyRow
              icon="backup"
              title={t.backup}
              hint={t.backupHint}
              colors={colors}
              onPress={createLocalBackup}
            />
            <PrivacyRow
              icon="restore"
              title={t.restoreBackup}
              hint={t.restoreHint}
              colors={colors}
              onPress={restoreLocalBackup}
            />
            <PrivacyRow
              icon="lock-outline"
              title={t.passwords}
              hint={t.passwordsHint}
              colors={colors}
              onPress={() => showError(t.errorTitle, t.passwordsHint)}
            />
            <PrivacyRow
              icon="history"
              title={t.history}
              hint={t.historyHint}
              colors={colors}
              onPress={() =>
                Alert.alert(
                  t.history,
                  tasks.length ? tasks.join("\n") : t.noTasks,
                )
              }
            />
          </View>

          <View
            style={[
              styles.resultsCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.profileHeader,
                { flexDirection: isArabic ? "row-reverse" : "row" },
              ]}
            >
              <View
                style={[
                  styles.phaseIcon,
                  { backgroundColor: colors.success + "18" },
                ]}
              >
                <Icon name="folder-special" color={colors.success} size={20} />
              </View>
              <View style={styles.phaseTitleBlock}>
                <Text
                  style={[styles.sectionTitle, { color: colors.foreground }]}
                >
                  {t.results}
                </Text>
                <Text style={[styles.phaseHint, { color: colors.muted }]}>
                  {t.resultsHint}
                </Text>
              </View>
            </View>
            {tasks.length ? (
              tasks.map((task) => (
                <View
                  key={task}
                  style={[styles.resultRow, { borderTopColor: colors.border }]}
                >
                  <Icon name="description" color={colors.success} size={17} />
                  <Text
                    style={[styles.resultText, { color: colors.foreground }]}
                  >
                    {task}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={[styles.phaseHint, { color: colors.muted }]}>
                {t.noResults}
              </Text>
            )}
          </View>

          {selectedFiles.length > 0 && (
            <View
              style={[
                styles.selectedNotice,
                {
                  backgroundColor: colors.success + "12",
                  borderColor: colors.success + "35",
                },
              ]}
            >
              <Icon name="attach-file" color={colors.success} size={18} />
              <Text
                style={[styles.selectedNoticeText, { color: colors.success }]}
              >
                {selectedFiles.length} {t.selected}: {selectedFiles.join("، ")}
              </Text>
            </View>
          )}
        </View>

        {workspace !== "home" && (
          <View style={styles.workspaceShell}>
            <View
              style={[
                styles.workspaceHeader,
                { flexDirection: isArabic ? "row-reverse" : "row" },
              ]}
            >
              <Pressable
                onPress={() => setWorkspace("home")}
                style={[styles.backButton, { borderColor: colors.border }]}
              >
                <Icon
                  name={isArabic ? "arrow-forward" : "arrow-back"}
                  color={colors.foreground}
                  size={19}
                />
                <Text
                  style={[styles.backButtonText, { color: colors.foreground }]}
                >
                  {t.backHome}
                </Text>
              </Pressable>
              <View style={styles.workspaceHeading}>
                <Text
                  style={[styles.workspaceTitle, { color: colors.foreground }]}
                >
                  {workspace === "pdf"
                    ? t.workspacePdf
                    : workspace === "print"
                      ? t.workspacePrint
                      : workspace === "scan"
                        ? t.workspaceScan
                        : workspace === "id"
                          ? t.workspaceId
                          : workspace === "results"
                            ? t.workspaceResults
                            : t.workspaceAi}
                </Text>
                <Text style={[styles.workspaceHint, { color: colors.muted }]}>
                  {workspace === "pdf"
                    ? t.workspacePdfHint
                    : workspace === "print"
                      ? t.workspacePrintHint
                      : workspace === "scan"
                        ? t.workspaceScanHint
                        : workspace === "id"
                          ? t.workspaceIdHint
                          : workspace === "results"
                            ? t.workspaceResultsHint
                            : t.workspaceAiHint}
                </Text>
              </View>
            </View>

            <Text
              style={[
                styles.workspaceSectionLabel,
                { color: colors.foreground },
              ]}
            >
              {t.workspaceActions}
            </Text>
            {workspace === "pdf" && (
              <View style={styles.workspaceGrid}>
                <WorkspaceTile
                  icon="merge-type"
                  title={t.merge}
                  hint={t.mergeHint}
                  color="#0A7EA4"
                  onPress={mergePdfs}
                  colors={colors}
                />
                <WorkspaceTile
                  icon="photo-library"
                  title={t.images}
                  hint={t.imagesHint}
                  color="#8B5CF6"
                  onPress={imagesToPdf}
                  colors={colors}
                />
                <WorkspaceTile
                  icon="photo-filter"
                  title={t.extract}
                  hint={t.extractHint}
                  color="#F59E0B"
                  onPress={extractImages}
                  colors={colors}
                />
                <WorkspaceTile
                  icon="format-list-numbered"
                  title={t.numbering}
                  hint={t.numberingHint}
                  color="#E45757"
                  onPress={chooseNumberingFile}
                  colors={colors}
                />
                <WorkspaceTile
                  icon="view-list"
                  title={t.pageEditor}
                  hint={t.pageEditorHint}
                  color="#2563EB"
                  onPress={choosePageEditorPdf}
                  colors={colors}
                />
              </View>
            )}
            {workspace === "pdf" && (
              <View
                style={[
                  styles.advancedCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.advancedTitle, { color: colors.foreground }]}
                >
                  {t.advanced}
                </Text>
                <Text style={[styles.settingLabel, { color: colors.muted }]}>
                  {t.imageFit}
                </Text>
                <SettingPills
                  values={[
                    { value: "contain", label: t.contain },
                    { value: "fill", label: t.fill },
                  ]}
                  selected={imageFit}
                  colors={colors}
                  onSelect={(value) => setImageFit(value as typeof imageFit)}
                />
                <Text style={[styles.settingLabel, { color: colors.muted }]}>
                  {t.extractFormat}
                </Text>
                <SettingPills
                  values={[
                    { value: "jpg", label: "JPG" },
                    { value: "png", label: "PNG" },
                  ]}
                  selected={extractFormat}
                  colors={colors}
                  onSelect={(value) =>
                    setExtractFormat(value as typeof extractFormat)
                  }
                />
              </View>
            )}
            {workspace === "pdf" && numberingFile && (
              <View
                style={[
                  styles.workspacePreviewCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.workspacePreviewTitle,
                    { color: colors.foreground },
                  ]}
                >
                  {t.numberingSettings}
                </Text>
                <Text style={[styles.workspaceHint, { color: colors.muted }]}>
                  {numberingFile.name} · {numberingFile.pages}{" "}
                  {isArabic ? "صفحة" : "pages"}
                </Text>
                <TextInput
                  value={numberFormat}
                  onChangeText={setNumberFormat}
                  style={[
                    styles.workspaceInput,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                />
                <View style={styles.workspaceSegmentRow}>
                  {(["left", "center", "right"] as NumberPosition[]).map(
                    (value) => (
                      <Pressable
                        key={value}
                        onPress={() => setNumberPosition(value)}
                        style={[
                          styles.workspaceSegment,
                          {
                            backgroundColor:
                              numberPosition === value
                                ? colors.primary
                                : colors.background,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color:
                              numberPosition === value
                                ? "#fff"
                                : colors.foreground,
                            fontSize: 11,
                            fontWeight: "800",
                          }}
                        >
                          {value === "left"
                            ? t.numberLeft
                            : value === "center"
                              ? t.numberCenter
                              : t.numberRight}
                        </Text>
                      </Pressable>
                    ),
                  )}
                </View>
                <View
                  style={[
                    styles.advancedCard,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.advancedTitle, { color: colors.foreground }]}
                  >
                    {t.advanced}
                  </Text>
                  <Text style={[styles.settingLabel, { color: colors.muted }]}>
                    {t.orientation}
                  </Text>
                  <SettingPills
                    values={[
                      { value: "top", label: t.numberTop },
                      { value: "middle", label: t.numberMiddle },
                      { value: "bottom", label: t.numberBottom },
                    ]}
                    selected={numberVertical}
                    colors={colors}
                    onSelect={(value) =>
                      setNumberVertical(value as NumberVertical)
                    }
                  />
                  <View style={styles.settingsInputRow}>
                    <TextInput
                      value={numberMargin}
                      onChangeText={setNumberMargin}
                      keyboardType="decimal-pad"
                      placeholder={t.numberMargin}
                      placeholderTextColor={colors.muted}
                      style={[
                        styles.workspaceInput,
                        styles.settingsInputHalf,
                        {
                          color: colors.foreground,
                          borderColor: colors.border,
                        },
                      ]}
                    />
                    <TextInput
                      value={numberSize}
                      onChangeText={setNumberSize}
                      keyboardType="decimal-pad"
                      placeholder={t.numberSize}
                      placeholderTextColor={colors.muted}
                      style={[
                        styles.workspaceInput,
                        styles.settingsInputHalf,
                        {
                          color: colors.foreground,
                          borderColor: colors.border,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.settingsInputRow}>
                    <TextInput
                      value={numberFrom}
                      onChangeText={setNumberFrom}
                      keyboardType="number-pad"
                      placeholder={t.numberFrom}
                      placeholderTextColor={colors.muted}
                      style={[
                        styles.workspaceInput,
                        styles.settingsInputHalf,
                        {
                          color: colors.foreground,
                          borderColor: colors.border,
                        },
                      ]}
                    />
                    <TextInput
                      value={numberTo}
                      onChangeText={setNumberTo}
                      keyboardType="number-pad"
                      placeholder={t.numberTo}
                      placeholderTextColor={colors.muted}
                      style={[
                        styles.workspaceInput,
                        styles.settingsInputHalf,
                        {
                          color: colors.foreground,
                          borderColor: colors.border,
                        },
                      ]}
                    />
                  </View>
                  <TextInput
                    value={numberStart}
                    onChangeText={setNumberStart}
                    keyboardType="number-pad"
                    placeholder={t.numberStart}
                    placeholderTextColor={colors.muted}
                    style={[
                      styles.workspaceInput,
                      { color: colors.foreground, borderColor: colors.border },
                    ]}
                  />
                  <Text style={[styles.settingLabel, { color: colors.muted }]}>
                    {t.numberWhich}
                  </Text>
                  <SettingPills
                    values={[
                      { value: "all", label: t.numberAll },
                      { value: "odd", label: t.numberOdd },
                      { value: "even", label: t.numberEven },
                    ]}
                    selected={numberWhich}
                    colors={colors}
                    onSelect={(value) => setNumberWhich(value as NumberWhich)}
                  />
                  <Text style={[styles.settingLabel, { color: colors.muted }]}>
                    {t.numberNumerals}
                  </Text>
                  <SettingPills
                    values={[
                      { value: "latin", label: "123" },
                      { value: "indic", label: "١٢٣" },
                      { value: "roman-u", label: "I II" },
                      { value: "roman-l", label: "i ii" },
                    ]}
                    selected={numberNumerals}
                    colors={colors}
                    onSelect={(value) =>
                      setNumberNumerals(value as NumberNumerals)
                    }
                  />
                  <Text style={[styles.settingLabel, { color: colors.muted }]}>
                    {t.numberFont}
                  </Text>
                  <SettingPills
                    values={[
                      { value: "helvetica", label: "Helvetica" },
                      { value: "times", label: "Times" },
                      { value: "courier", label: "Courier" },
                    ]}
                    selected={numberFont}
                    colors={colors}
                    onSelect={(value) => setNumberFont(value as NumberFont)}
                  />
                  <Pressable
                    onPress={() => setNumberBold((value) => !value)}
                    style={[
                      styles.settingToggle,
                      { borderColor: colors.border },
                    ]}
                  >
                    <Text
                      style={{
                        color: numberBold ? colors.primary : colors.muted,
                        fontWeight: "800",
                        fontSize: 11,
                      }}
                    >
                      {t.numberBold}: {numberBold ? "ON" : "OFF"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setNumberMirror((value) => !value)}
                    style={[
                      styles.settingToggle,
                      { borderColor: colors.border },
                    ]}
                  >
                    <Text
                      style={{
                        color: numberMirror ? colors.primary : colors.muted,
                        fontWeight: "800",
                        fontSize: 11,
                      }}
                    >
                      {t.numberMirror}: {numberMirror ? "ON" : "OFF"}
                    </Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => setPreviewKind("numbering")}
                  style={[
                    styles.workspacePrimary,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Icon name="visibility" color="#fff" size={18} />
                  <Text style={styles.printButtonText}>
                    {t.previewNumbering}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={numberPdf}
                  style={[
                    styles.workspacePrimary,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Icon name="format-list-numbered" color="#fff" size={18} />
                  <Text style={styles.printButtonText}>{t.runNumbering}</Text>
                </Pressable>
              </View>
            )}
            {workspace === "pdf" && pageEditorFile && (
              <View
                style={[
                  styles.workspacePreviewCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.workspacePreviewTitle,
                    { color: colors.foreground },
                  ]}
                >
                  {t.pageEditor}
                </Text>
                <Text style={[styles.workspaceHint, { color: colors.muted }]}>
                  {pageEditorFile.name} · {pageEdits.length}{" "}
                  {isArabic ? "صفحة" : "pages"}
                </Text>
                <Text style={[styles.workspaceHint, { color: colors.primary }]}>
                  {isArabic
                    ? "اضغط مطولًا على الصفحة ثم اسحبها لأعلى أو لأسفل. استخدم الأزرار للتدوير أو تغيير الاتجاه أو الحذف."
                    : "Long-press a page, then drag it up or down. Use the controls to rotate, change orientation, or delete."}
                </Text>
                <View style={styles.pdfPagesList}>
                  {pageEdits.map((edit, index) => (
                    <PdfPageTile
                      key={edit.sourcePage}
                      edit={edit}
                      index={index}
                      active={selectedPageIndex === index}
                      colors={colors}
                      isArabic={isArabic}
                      onLongPress={() => setSelectedPageIndex(index)}
                      onDrag={(deltaY) => {
                        if (Math.abs(deltaY) < 42) return;
                        const direction = deltaY > 0 ? 1 : -1;
                        const target = index + direction;
                        if (target < 0 || target >= pageEdits.length) return;
                        setPageEdits((current) =>
                          movePage(current, index, target),
                        );
                        setSelectedPageIndex(target);
                      }}
                      onRotate={() =>
                        setPageEdits((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, rotation: rotatePage(item.rotation) }
                              : item,
                          ),
                        )
                      }
                      onToggleOrientation={() =>
                        setPageEdits((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  rotation: togglePageOrientation(
                                    item.rotation,
                                  ),
                                }
                              : item,
                          ),
                        )
                      }
                      onDelete={() => {
                        setPageEdits((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        );
                        setSelectedPageIndex(null);
                      }}
                    />
                  ))}
                </View>
                <Pressable
                  disabled={pageEditBusy || !pageEdits.length}
                  onPress={applyPageEditor}
                  style={[
                    styles.workspacePrimary,
                    {
                      backgroundColor: colors.primary,
                      opacity: pageEdits.length ? 1 : 0.5,
                    },
                  ]}
                >
                  <Icon name="save" color="#fff" size={18} />
                  <Text style={styles.printButtonText}>
                    {pageEditBusy ? "…" : t.applyPageEdit}
                  </Text>
                </Pressable>
              </View>
            )}
            {workspace === "print" && (
              <View style={styles.workspacePanel}>
                <WorkspaceTile
                  icon="folder-open"
                  title={t.chooseFile}
                  hint={t.printHint}
                  color={colors.primary}
                  onPress={openPrintDialog}
                  colors={colors}
                />
                <Text
                  style={[
                    styles.workspacePreviewTitle,
                    { color: colors.foreground },
                  ]}
                >
                  {t.paper}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 7 }}
                >
                  {paperOptions.map((option) => (
                    <Pressable
                      key={option.id}
                      onPress={() => setSelectedPaper(option.id)}
                      style={[
                        styles.workspaceSegment,
                        {
                          backgroundColor:
                            selectedPaper === option.id
                              ? colors.primary
                              : colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            selectedPaper === option.id
                              ? "#fff"
                              : colors.foreground,
                          fontSize: 10,
                          fontWeight: "800",
                        }}
                      >
                        {isArabic ? option.ar : option.en}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={styles.workspaceSegmentRow}>
                  {["70 g/m²", "80 g/m²", "120 g/m²", "200 g/m²"].map(
                    (value) => (
                      <Pressable
                        key={value}
                        onPress={() => setSelectedWeight(value)}
                        style={[
                          styles.workspaceSegment,
                          {
                            backgroundColor:
                              selectedWeight === value
                                ? colors.primary
                                : colors.surface,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color:
                              selectedWeight === value
                                ? "#fff"
                                : colors.foreground,
                            fontSize: 10,
                            fontWeight: "800",
                          }}
                        >
                          {value}
                        </Text>
                      </Pressable>
                    ),
                  )}
                </View>
                <View style={styles.workspaceSegmentRow}>
                  {(["portrait", "landscape"] as const).map((value) => (
                    <Pressable
                      key={value}
                      onPress={() => setOrientation(value)}
                      style={[
                        styles.workspaceSegment,
                        {
                          backgroundColor:
                            orientation === value
                              ? colors.primary
                              : colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            orientation === value ? "#fff" : colors.foreground,
                          fontSize: 10,
                          fontWeight: "800",
                        }}
                      >
                        {value === "portrait" ? t.portrait : t.landscape}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  onPress={() => setDuplex((value) => !value)}
                  style={[
                    styles.workspaceSegment,
                    {
                      backgroundColor: duplex ? colors.primary : colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: duplex ? "#fff" : colors.foreground,
                      fontSize: 11,
                      fontWeight: "800",
                      textAlign: "center",
                    }}
                  >
                    {duplex ? t.duplex : t.oneSided}
                  </Text>
                </Pressable>
                <View
                  style={[
                    styles.advancedCard,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.advancedTitle, { color: colors.foreground }]}
                  >
                    {t.advanced}
                  </Text>
                  <TextInput
                    value={copies}
                    onChangeText={setCopies}
                    keyboardType="number-pad"
                    placeholder={t.copies}
                    placeholderTextColor={colors.muted}
                    style={[
                      styles.workspaceInput,
                      { color: colors.foreground, borderColor: colors.border },
                    ]}
                  />
                  <TextInput
                    value={printPages}
                    onChangeText={setPrintPages}
                    placeholder={`${t.pageRange} — 1-3,5`}
                    placeholderTextColor={colors.muted}
                    style={[
                      styles.workspaceInput,
                      { color: colors.foreground, borderColor: colors.border },
                    ]}
                  />
                  <Text style={[styles.settingLabel, { color: colors.muted }]}>
                    {t.colorMode}
                  </Text>
                  <SettingPills
                    values={[
                      { value: "color", label: t.color },
                      { value: "bw", label: t.bw },
                    ]}
                    selected={colorMode}
                    colors={colors}
                    onSelect={(value) => setColorMode(value as "color" | "bw")}
                  />
                  <Text style={[styles.settingLabel, { color: colors.muted }]}>
                    {t.scale}
                  </Text>
                  <SettingPills
                    values={[
                      { value: "fit", label: t.fitPage },
                      { value: "actual", label: t.actualSize },
                      { value: "fill", label: t.fillPage },
                    ]}
                    selected={printScale}
                    colors={colors}
                    onSelect={(value) =>
                      setPrintScale(value as typeof printScale)
                    }
                  />
                  <Text style={[styles.settingLabel, { color: colors.muted }]}>
                    {t.duplexEdge}
                  </Text>
                  <SettingPills
                    values={[
                      { value: "long", label: t.longEdge },
                      { value: "short", label: t.shortEdge },
                    ]}
                    selected={duplexEdge}
                    colors={colors}
                    onSelect={(value) =>
                      setDuplexEdge(value as "long" | "short")
                    }
                  />
                  <TextInput
                    value={printMargins}
                    onChangeText={setPrintMargins}
                    keyboardType="decimal-pad"
                    placeholder={t.margins}
                    placeholderTextColor={colors.muted}
                    style={[
                      styles.workspaceInput,
                      { color: colors.foreground, borderColor: colors.border },
                    ]}
                  />
                  <Pressable
                    onPress={() => setPrintCollate((value) => !value)}
                    style={[
                      styles.settingToggle,
                      { borderColor: colors.border },
                    ]}
                  >
                    <Text
                      style={{
                        color: printCollate ? colors.primary : colors.muted,
                        fontWeight: "800",
                        fontSize: 11,
                      }}
                    >
                      {t.collate}: {printCollate ? "ON" : "OFF"}
                    </Text>
                  </Pressable>
                </View>
                <View
                  style={[
                    styles.workspacePreviewCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Icon name="visibility" color={colors.primary} size={24} />
                  <Text
                    style={[
                      styles.workspacePreviewTitle,
                      { color: colors.foreground },
                    ]}
                  >
                    {t.previewPrint}
                  </Text>
                  <Text style={[styles.workspaceHint, { color: colors.muted }]}>
                    {paper.ar} · {selectedWeight} ·{" "}
                    {colorMode === "color" ? t.color : t.bw} ·{" "}
                    {duplex ? t.duplex : t.oneSided}
                  </Text>
                  <Pressable
                    onPress={() => setPreviewKind("print")}
                    style={[
                      styles.workspacePrimary,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    <Text style={styles.printButtonText}>{t.previewPrint}</Text>
                  </Pressable>
                </View>
              </View>
            )}
            {workspace === "scan" && (
              <View style={styles.workspacePanel}>
                <TextInput
                  value={printerIp}
                  onChangeText={setPrinterIp}
                  placeholder={t.scannerIpHint}
                  placeholderTextColor={colors.muted}
                  style={[
                    styles.workspaceInput,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                />
                <Pressable
                  onPress={scanForDevices}
                  style={[
                    styles.workspacePrimary,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Icon name="wifi" color="#fff" size={18} />
                  <Text style={styles.printButtonText}>{t.checkDevices}</Text>
                </Pressable>
                <View
                  style={[
                    styles.advancedCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.advancedTitle, { color: colors.foreground }]}
                  >
                    {t.advanced}
                  </Text>
                  <Text style={[styles.settingLabel, { color: colors.muted }]}>
                    {t.scanSource}
                  </Text>
                  <SettingPills
                    values={[
                      { value: "glass", label: t.glass },
                      { value: "adf", label: t.adf },
                    ]}
                    selected={scannerSource}
                    colors={colors}
                    onSelect={(value) => {
                      const source = value as "glass" | "adf";
                      setScannerSource(source);
                      setScannerAdf(source === "adf");
                    }}
                  />
                  <Text style={[styles.settingLabel, { color: colors.muted }]}>
                    {t.outputFormat}
                  </Text>
                  <SettingPills
                    values={[
                      { value: "pdf", label: "PDF" },
                      { value: "jpg", label: "JPG" },
                      { value: "png", label: "PNG" },
                    ]}
                    selected={scannerFormat}
                    colors={colors}
                    onSelect={(value) =>
                      setScannerFormat(value as typeof scannerFormat)
                    }
                  />
                  <Pressable
                    onPress={() => setScannerDuplex((value) => !value)}
                    style={[
                      styles.settingToggle,
                      { borderColor: colors.border },
                    ]}
                  >
                    <Text
                      style={{
                        color: scannerDuplex ? colors.primary : colors.muted,
                        fontWeight: "800",
                        fontSize: 11,
                      }}
                    >
                      {t.scanDuplex}: {scannerDuplex ? "ON" : "OFF"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setScannerDeskew((value) => !value)}
                    style={[
                      styles.settingToggle,
                      { borderColor: colors.border },
                    ]}
                  >
                    <Text
                      style={{
                        color: scannerDeskew ? colors.primary : colors.muted,
                        fontWeight: "800",
                        fontSize: 11,
                      }}
                    >
                      {t.deskew}: {scannerDeskew ? "ON" : "OFF"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setScannerBlankPages((value) => !value)}
                    style={[
                      styles.settingToggle,
                      { borderColor: colors.border },
                    ]}
                  >
                    <Text
                      style={{
                        color: scannerBlankPages
                          ? colors.primary
                          : colors.muted,
                        fontWeight: "800",
                        fontSize: 11,
                      }}
                    >
                      {t.removeBlanks}: {scannerBlankPages ? "ON" : "OFF"}
                    </Text>
                  </Pressable>
                </View>
                <View
                  style={[
                    styles.workspacePreviewCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Icon
                    name="document-scanner"
                    color={colors.success}
                    size={26}
                  />
                  <Text
                    style={[
                      styles.workspacePreviewTitle,
                      { color: colors.foreground },
                    ]}
                  >
                    {t.scannerSettings}
                  </Text>
                  <Text style={[styles.workspaceHint, { color: colors.muted }]}>
                    {t.dpi}: {scannerDpi} ·{" "}
                    {scannerColor === "color" ? t.scanColor : t.scanBw} ·{" "}
                    {t.adf}: {scannerAdf ? "ON" : "OFF"}
                  </Text>
                </View>
              </View>
            )}
            {workspace === "id" && (
              <View style={styles.workspacePanel}>
                <View
                  style={[
                    styles.workspacePreviewCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Icon name="badge" color={colors.warning} size={28} />
                  <Text
                    style={[
                      styles.workspacePreviewTitle,
                      { color: colors.foreground },
                    ]}
                  >
                    {t.idWizard}
                  </Text>
                  <Text style={[styles.workspaceHint, { color: colors.muted }]}>
                    {t.idWizardHint}
                  </Text>
                </View>
                <View style={styles.workspaceSegmentRow}>
                  <Pressable
                    onPress={() => chooseIdFace("front", "library")}
                    style={[
                      styles.workspacePrimary,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Icon
                      name="photo-library"
                      color={colors.primary}
                      size={18}
                    />
                    <Text
                      style={[
                        styles.backButtonText,
                        { color: colors.foreground },
                      ]}
                    >
                      {t.idFront}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => chooseIdFace("back", "library")}
                    style={[
                      styles.workspacePrimary,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Icon
                      name="photo-library"
                      color={colors.primary}
                      size={18}
                    />
                    <Text
                      style={[
                        styles.backButtonText,
                        { color: colors.foreground },
                      ]}
                    >
                      {t.idBack}
                    </Text>
                  </Pressable>
                </View>
                <View
                  style={[
                    styles.advancedCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.advancedTitle, { color: colors.foreground }]}
                  >
                    {t.advanced}
                  </Text>
                  <Text style={[styles.settingLabel, { color: colors.muted }]}>
                    {t.idSize}
                  </Text>
                  <SettingPills
                    values={[
                      { value: "fit", label: t.idFit },
                      { value: "actual", label: t.idActual },
                    ]}
                    selected={idSize}
                    colors={colors}
                    onSelect={(value) => setIdSize(value as typeof idSize)}
                  />
                  <TextInput
                    value={idMargin}
                    onChangeText={setIdMargin}
                    keyboardType="decimal-pad"
                    placeholder={t.idMargin}
                    placeholderTextColor={colors.muted}
                    style={[
                      styles.workspaceInput,
                      { color: colors.foreground, borderColor: colors.border },
                    ]}
                  />
                  <Text style={[styles.settingLabel, { color: colors.muted }]}>
                    {t.quality}
                  </Text>
                  <SettingPills
                    values={[
                      { value: "standard", label: t.standard },
                      { value: "high", label: t.high },
                    ]}
                    selected={idQuality}
                    colors={colors}
                    onSelect={(value) =>
                      setIdQuality(value as typeof idQuality)
                    }
                  />
                </View>
                <Pressable
                  onPress={() => setPreviewKind("id")}
                  style={[
                    styles.workspacePrimary,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Icon name="visibility" color="#fff" size={18} />
                  <Text style={styles.printButtonText}>{t.previewId}</Text>
                </Pressable>
                <Pressable
                  onPress={createIdCardPdf}
                  disabled={!idFrontUri || !idBackUri}
                  style={[
                    styles.workspacePrimary,
                    {
                      backgroundColor:
                        idFrontUri && idBackUri
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                >
                  <Icon name="picture-as-pdf" color="#fff" size={18} />
                  <Text style={styles.printButtonText}>{t.makeIdPdf}</Text>
                </Pressable>
              </View>
            )}
            {workspace === "results" && (
              <View
                style={[
                  styles.workspacePreviewCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                {tasks.length ? (
                  tasks.map((task) => (
                    <Text
                      key={task}
                      style={[styles.resultText, { color: colors.foreground }]}
                    >
                      {task}
                    </Text>
                  ))
                ) : (
                  <Text style={[styles.workspaceHint, { color: colors.muted }]}>
                    {t.noResults}
                  </Text>
                )}
              </View>
            )}
            {workspace === "ai" && (
              <View
                style={[
                  styles.workspacePreviewCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.workspacePreviewTitle,
                    { color: colors.foreground },
                  ]}
                >
                  {t.smart}
                </Text>
                <Text style={[styles.workspaceHint, { color: colors.muted }]}>
                  {t.smartHint}
                </Text>
                <TextInput
                  value={command}
                  onChangeText={setCommand}
                  placeholder={t.placeholder}
                  placeholderTextColor={colors.muted}
                  style={[
                    styles.workspaceInput,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                />
                <Pressable
                  onPress={actionComing}
                  style={[
                    styles.workspacePrimary,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Text style={styles.printButtonText}>{t.execute}</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </ScrollView>
      <Modal
        visible={previewKind !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPreviewKind(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.previewModal,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.profileHeader,
                { flexDirection: isArabic ? "row-reverse" : "row" },
              ]}
            >
              <View
                style={[
                  styles.phaseIcon,
                  { backgroundColor: colors.primary + "18" },
                ]}
              >
                <Icon name="visibility" color={colors.primary} size={20} />
              </View>
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: colors.foreground,
                    flex: 1,
                    textAlign: isArabic ? "right" : "left",
                  },
                ]}
              >
                {previewKind ? previewTitleFor(previewKind) : ""}
              </Text>
              <Pressable onPress={() => setPreviewKind(null)}>
                <Icon name="close" color={colors.muted} size={21} />
              </Pressable>
            </View>
            {previewKind === "id" ? (
              <View
                style={[
                  styles.modalFaces,
                  { flexDirection: isArabic ? "row-reverse" : "row" },
                ]}
              >
                {[
                  [idFrontUri, t.idFront],
                  [idBackUri, t.idBack],
                ].map(([uri, label]) => (
                  <View key={label as string} style={styles.modalFace}>
                    <View
                      style={[
                        styles.modalImage,
                        {
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      {uri ? (
                        <Image
                          source={{ uri: uri as string }}
                          style={styles.modalImageContent}
                        />
                      ) : (
                        <Icon
                          name="image-not-supported"
                          color={colors.muted}
                          size={28}
                        />
                      )}
                    </View>
                    <Text
                      style={[styles.smallLabel, { color: colors.foreground }]}
                    >
                      {label as string}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View
                style={[
                  styles.previewList,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                {previewFileNames.map((name) => (
                  <View
                    key={name}
                    style={[
                      styles.previewListItem,
                      { borderBottomColor: colors.border },
                    ]}
                  >
                    <Icon name="description" color={colors.primary} size={17} />
                    <Text
                      style={[
                        styles.previewListText,
                        { color: colors.foreground },
                      ]}
                    >
                      {name}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            {previewAsset &&
            (previewKind === "images" || previewKind === "print") &&
            previewAsset.mimeType?.startsWith("image/") ? (
              <View
                style={[
                  styles.previewImageFrame,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Image
                  source={{ uri: previewAsset.uri }}
                  style={styles.previewImageContent}
                />
              </View>
            ) : null}
            {previewAsset && (
              <Text
                style={[
                  styles.modalSummaryText,
                  {
                    color: colors.muted,
                    textAlign: isArabic ? "right" : "left",
                  },
                ]}
              >
                {previewAsset.mimeType || "file"}
                {formatFileSize(previewAsset.size)
                  ? ` · ${formatFileSize(previewAsset.size)}`
                  : ""}
              </Text>
            )}
            {previewKind === "numbering" && (
              <View style={styles.modalSummary}>
                <Text
                  style={[
                    styles.modalSummaryText,
                    { color: colors.foreground },
                  ]}
                >
                  {t.numberingSettings}: {numberPosition} · {numberVertical} ·{" "}
                  {numberFormat} · {numberSize}pt
                </Text>
              </View>
            )}
            {previewKind === "pages" && (
              <View style={styles.modalSummary}>
                <Text
                  style={[
                    styles.modalSummaryText,
                    { color: colors.foreground },
                  ]}
                >
                  {t.pageOrder}: {pageOrder || t.previewEmpty}
                </Text>
              </View>
            )}
            {previewKind === "print" && (
              <View style={styles.modalSummary}>
                <Text
                  style={[
                    styles.modalSummaryText,
                    { color: colors.foreground },
                  ]}
                >
                  {paper.ar} · {selectedWeight} ·{" "}
                  {colorMode === "color" ? t.color : t.bw} ·{" "}
                  {duplex
                    ? `${t.duplex} · ${duplexEdgeLabel(duplexEdge, language)}`
                    : t.oneSided}{" "}
                  · {copies}
                </Text>
              </View>
            )}
            {previewKind === "id" ? (
              <Text
                style={[
                  styles.modalSummaryText,
                  {
                    color: colors.muted,
                    textAlign: isArabic ? "right" : "left",
                  },
                ]}
              >
                {isArabic
                  ? "الوجه الأمامي صفحة 1 والوجه الخلفي صفحة 2"
                  : "Front is page 1 and back is page 2"}
              </Text>
            ) : null}
            <View
              style={[
                styles.modalActions,
                { flexDirection: isArabic ? "row-reverse" : "row" },
              ]}
            >
              <Pressable
                onPress={() => setPreviewKind(null)}
                style={[styles.modalSecondary, { borderColor: colors.border }]}
              >
                <Text
                  style={[styles.miniButtonText, { color: colors.foreground }]}
                >
                  {t.dismiss}
                </Text>
              </Pressable>
              {previewKind === "print" && (
                <Pressable
                  onPress={continuePrint}
                  style={[
                    styles.modalPrimary,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Icon name="print" color="#fff" size={17} />
                  <Text style={styles.printButtonText}>
                    {t.previewContinue}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function SectionTitle({
  title,
  colors,
}: {
  title: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      <View style={[styles.titleRule, { backgroundColor: colors.primary }]} />
    </View>
  );
}

function SettingLabel({
  title,
  value,
  colors,
}: {
  title: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.settingLabel}>
      <Text style={[styles.smallLabel, { color: colors.muted }]}>{title}</Text>
      <Text style={[styles.settingValue, { color: colors.foreground }]}>
        {value}
      </Text>
    </View>
  );
}

function WorkspaceTile({
  icon,
  title,
  hint,
  color,
  onPress,
  colors,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  title: string;
  hint: string;
  color: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.workspaceTile,
        { backgroundColor: color + "16", borderColor: color + "35" },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[styles.workspaceTileIcon, { backgroundColor: color + "22" }]}
      >
        <Icon name={icon} color={color} size={22} />
      </View>
      <Text style={[styles.workspaceTileTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      <Text
        style={[styles.workspaceTileHint, { color: colors.muted }]}
        numberOfLines={2}
      >
        {hint}
      </Text>
      <Icon name="chevron-right" color={colors.muted} size={18} />
    </Pressable>
  );
}

function PrivacyRow({
  icon,
  title,
  hint,
  colors,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  title: string;
  hint: string;
  colors: ReturnType<typeof useColors>;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.privacyRow,
        { borderTopColor: colors.border },
        pressed && styles.rowPressed,
      ]}
    >
      <Icon name={icon} color={colors.success} size={19} />
      <View style={styles.privacyCopy}>
        <Text style={[styles.deviceName, { color: colors.foreground }]}>
          {title}
        </Text>
        <Text style={[styles.deviceState, { color: colors.muted }]}>
          {hint}
        </Text>
      </View>
      <Icon name="chevron-right" color={colors.muted} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  brandBlock: { gap: 3 },
  eyebrow: { fontSize: 12, fontWeight: "600", letterSpacing: 0.2 },
  brandName: { fontSize: 25, fontWeight: "800", letterSpacing: -0.8 },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: { fontSize: 12, marginTop: 2 },
  headerTools: { gap: 8 },
  toolButton: {
    width: 39,
    height: 39,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  langText: { fontWeight: "800", fontSize: 13 },
  offlineBanner: {
    alignItems: "center",
    gap: 8,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginBottom: 14,
  },
  offlineText: { fontSize: 12, fontWeight: "700", flex: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  errorBanner: {
    alignItems: "center",
    gap: 9,
    borderRadius: 13,
    borderWidth: 1,
    padding: 11,
    marginBottom: 14,
  },
  errorCopy: { flex: 1 },
  errorTitle: { fontSize: 12, fontWeight: "800" },
  errorHint: { fontSize: 10.5, marginTop: 3, lineHeight: 15 },
  workspaceShell: { paddingTop: 6, paddingBottom: 24, gap: 14 },
  workspaceHeader: { alignItems: "center", gap: 10, marginBottom: 4 },
  backButton: {
    minHeight: 40,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  backButtonText: { fontSize: 11, fontWeight: "800" },
  workspaceHeading: { flex: 1, alignItems: "flex-end", gap: 3 },
  workspaceTitle: { fontSize: 22, fontWeight: "900" },
  workspaceHint: { fontSize: 11, lineHeight: 17 },
  workspaceSectionLabel: {
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
  },
  workspaceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  workspaceTile: {
    width: "47%",
    minHeight: 142,
    borderRadius: 17,
    borderWidth: 1,
    padding: 12,
    gap: 7,
  },
  workspaceTileIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  workspaceTileTitle: { fontSize: 13, fontWeight: "900", textAlign: "right" },
  workspaceTileHint: {
    flex: 1,
    fontSize: 10,
    lineHeight: 15,
    textAlign: "right",
  },
  workspacePanel: { gap: 12 },
  pdfPagesList: { gap: 8, maxHeight: 430 },
  advancedCard: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 9 },
  advancedTitle: { fontSize: 14, fontWeight: "900", textAlign: "right" },
  settingLabel: { fontSize: 10, fontWeight: "800", textAlign: "right", gap: 3 },
  settingPills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  settingPill: {
    minHeight: 32,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  settingToggle: {
    minHeight: 36,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsInputRow: { flexDirection: "row", gap: 7 },
  settingsInputHalf: { flex: 1 },
  pdfPageTile: {
    minHeight: 78,
    borderRadius: 14,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pdfPagePreview: {
    flex: 1,
    minHeight: 60,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  pdfPageNumber: { fontSize: 14, fontWeight: "900" },
  pdfPageMeta: { fontSize: 9, fontWeight: "700" },
  pdfPageControls: { alignItems: "center", gap: 4 },
  pdfPageOrientation: { fontSize: 9, fontWeight: "800", marginBottom: 2 },
  pdfPageButton: {
    width: 30,
    height: 27,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  workspaceSegmentRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  workspaceSegment: {
    minHeight: 36,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  workspacePreviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 15,
    gap: 9,
  },
  workspacePreviewTitle: {
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right",
  },
  workspaceInput: {
    minHeight: 44,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 12,
    textAlign: "right",
  },
  workspacePrimary: {
    minHeight: 44,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 13,
  },
  hero: {
    borderRadius: 22,
    padding: 18,
    minHeight: 148,
    overflow: "hidden",
    marginBottom: 22,
  },
  heroCopy: { flex: 1, gap: 5 },
  heroKicker: {
    color: "#BFE8F2",
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 0.7,
  },
  heroTitle: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 26,
    lineHeight: 31,
    textAlign: "right",
  },
  heroDescription: { color: "#DDF6FA", fontSize: 12, marginTop: 3 },
  heroArt: {
    width: 102,
    height: 112,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF18",
    borderRadius: 26,
    transform: [{ rotate: "5deg" }],
  },
  heroArtBadge: {
    position: "absolute",
    bottom: 11,
    right: 10,
    backgroundColor: "#fff",
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  titleRule: {
    height: 3,
    width: 31,
    borderRadius: 3,
    marginLeft: 8,
    flex: 1,
    maxWidth: 31,
  },
  viewAll: { fontSize: 12, fontWeight: "700" },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 22,
  },
  idCardCard: {
    borderRadius: 17,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  numberingCard: {
    borderRadius: 17,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  numberFieldsRow: { gap: 8, marginTop: 10 },
  numberField: { flex: 1, gap: 4 },
  numberToggleRow: {
    minHeight: 44,
    borderTopWidth: 1,
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  colorInput: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginTop: 9,
    fontSize: 12,
  },
  idFacesRow: { gap: 9, marginTop: 12 },
  idFaceBlock: { flex: 1, gap: 6 },
  idPreview: {
    height: 76,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  idPreviewImage: { width: "100%", height: "100%", resizeMode: "cover" },
  idFaceLabel: { fontSize: 11, fontWeight: "800", textAlign: "center" },
  idFaceActions: { gap: 5 },
  miniButton: {
    minHeight: 31,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 4,
  },
  miniButtonText: { fontSize: 9.5, fontWeight: "700" },
  actionCard: { width: "48.5%", borderRadius: 17, padding: 13, minHeight: 113 },
  actionIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  actionTitle: { color: "#10233F", fontSize: 14, fontWeight: "800" },
  actionHint: { color: "#6A7E91", fontSize: 10.5, marginTop: 4 },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.88 },
  rowPressed: { opacity: 0.65 },
  filesCard: {
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 13,
    marginBottom: 22,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
  },
  fileIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 12.5, fontWeight: "700" },
  fileTime: { fontSize: 10.5, marginTop: 3 },
  settingsCard: {
    borderRadius: 17,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  smallLabel: { fontSize: 11, fontWeight: "600" },
  settingValue: { fontSize: 13, fontWeight: "800" },
  pill: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: { fontSize: 11, fontWeight: "700" },
  divider: { height: 1, marginVertical: 12 },
  weightRow: { gap: 8, marginTop: 10 },
  weightItem: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
  weightValue: { fontSize: 11, fontWeight: "800" },
  weightLabel: { fontSize: 9.5, marginTop: 3 },
  segmented: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 12,
    gap: 3,
    marginTop: 10,
  },
  segment: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 9,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  segmentText: { fontSize: 11, fontWeight: "700" },
  duplexToggle: {
    borderWidth: 1,
    borderRadius: 11,
    paddingVertical: 9,
    paddingHorizontal: 11,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 9,
  },
  duplexEdgeBlock: { marginTop: 9, gap: 3 },
  printFooter: { alignItems: "flex-end", gap: 10, marginTop: 14 },
  copiesBlock: { width: 72, gap: 4 },
  copiesInput: {
    borderWidth: 1,
    borderRadius: 10,
    height: 39,
    paddingHorizontal: 11,
    textAlign: "center",
    fontWeight: "800",
  },
  printButton: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  printButtonText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  smartCard: {
    borderRadius: 17,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  aiTitle: { alignItems: "center", gap: 9 },
  aiIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  aiHint: { fontSize: 10, marginTop: 3 },
  aiBody: { gap: 9, alignItems: "stretch", marginTop: 12 },
  commandInput: {
    flex: 1,
    minHeight: 55,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 11,
    paddingTop: 10,
    fontSize: 11,
  },
  executeButton: {
    height: 40,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  executeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  aiOffText: { fontSize: 11, marginTop: 6, lineHeight: 18 },
  previewHub: {
    borderRadius: 17,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  previewRow: {
    minHeight: 48,
    borderTopWidth: 1,
    alignItems: "center",
    gap: 9,
    paddingVertical: 7,
  },
  previewIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  previewRowText: { flex: 1, fontSize: 12, fontWeight: "800" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#00000088",
    justifyContent: "flex-end",
  },
  previewModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 16,
    minHeight: 280,
    gap: 12,
  },
  modalFaces: { gap: 10 },
  modalFace: { flex: 1, gap: 6 },
  modalImage: {
    height: 110,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  modalImageContent: { width: "100%", height: "100%", resizeMode: "contain" },
  previewImageFrame: {
    height: 170,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  previewImageContent: { width: "100%", height: "100%", resizeMode: "contain" },
  previewList: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 11 },
  previewListItem: {
    minHeight: 42,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewListText: { flex: 1, fontSize: 11, fontWeight: "700" },
  modalSummary: { borderRadius: 10, padding: 10, backgroundColor: "#0A7EA412" },
  modalSummaryText: { fontSize: 11, lineHeight: 18, fontWeight: "700" },
  modalActions: { gap: 9, justifyContent: "flex-end" },
  modalSecondary: {
    minHeight: 40,
    paddingHorizontal: 17,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimary: {
    minHeight: 40,
    paddingHorizontal: 17,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  pageEditorCard: {
    borderRadius: 17,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  pageOrderInput: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    marginTop: 7,
    fontSize: 12,
    fontWeight: "700",
  },
  resultsCard: {
    borderRadius: 17,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  resultRow: {
    minHeight: 42,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 7,
  },
  resultText: { flex: 1, fontSize: 11, fontWeight: "700" },
  selectedNotice: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  selectedNoticeText: { flex: 1, fontSize: 10.5, fontWeight: "700" },
  roadmapCard: {
    borderRadius: 17,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  roadmapHeader: { alignItems: "center", gap: 10, marginBottom: 4 },
  roadmapIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  roadmapTitleBlock: { flex: 1 },
  roadmapHint: { fontSize: 10, marginTop: 3 },
  roadmapRow: {
    alignItems: "center",
    gap: 9,
    borderTopWidth: 1,
    paddingVertical: 11,
  },
  roadmapStep: {
    width: 33,
    height: 33,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  roadmapCopy: { flex: 1 },
  roadmapStage: { fontSize: 12, fontWeight: "800" },
  roadmapStageHint: { fontSize: 10, marginTop: 3, lineHeight: 15 },
  roadmapStatus: { fontSize: 10, fontWeight: "800" },
  profileCard: {
    borderRadius: 17,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  profileHeader: { alignItems: "center", gap: 10 },
  profilePill: {
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 130,
  },
  profilePillText: { fontSize: 11, fontWeight: "800" },
  profilePillHint: { fontSize: 9.5, marginTop: 4 },
  phaseCard: {
    borderRadius: 17,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  phaseHeader: { alignItems: "center", gap: 10, marginBottom: 4 },
  phaseIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  phaseTitleBlock: { flex: 1 },
  phaseHint: { fontSize: 10, marginTop: 3 },
  deviceRow: {
    alignItems: "center",
    gap: 9,
    borderTopWidth: 1,
    paddingVertical: 11,
  },
  deviceCopy: { flex: 1 },
  deviceName: { fontSize: 12, fontWeight: "800" },
  deviceState: { fontSize: 10, marginTop: 3, lineHeight: 15 },
  stateDot: { width: 9, height: 9, borderRadius: 5 },
  scannerSectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 10,
    marginBottom: 8,
  },
  scannerInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    fontSize: 11,
  },
  scannerNetworkText: { fontSize: 10, marginTop: 5 },
  scannerOptionRow: {
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 10,
  },
  scannerLabel: { fontSize: 10.5, fontWeight: "700", flex: 1 },
  scannerPills: { gap: 5 },
  scannerPill: {
    minWidth: 42,
    borderRadius: 9,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  scannerPillText: { fontSize: 10, fontWeight: "800" },
  scannerAdf: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 9,
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  outlineAction: {
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  outlineActionText: { fontSize: 11, fontWeight: "800" },
  taskHeader: {
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingTop: 11,
    marginTop: 12,
  },
  taskTitle: { fontSize: 12, fontWeight: "800" },
  taskCount: { fontSize: 11, fontWeight: "700" },
  taskEmpty: { fontSize: 10.5, paddingTop: 8 },
  taskItem: { fontSize: 10.5, paddingTop: 8 },
  cancelTasksButton: {
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 11,
  },
  privacyRow: {
    alignItems: "center",
    gap: 9,
    borderTopWidth: 1,
    paddingVertical: 11,
    flexDirection: "row",
  },
  privacyCopy: { flex: 1 },
});
