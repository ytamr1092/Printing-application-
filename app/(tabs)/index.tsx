import { useMemo, useState } from "react";
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
import * as DocumentPicker from "expo-document-picker";
import * as Print from "expo-print";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useThemeContext } from "@/lib/theme-provider";
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
    picked: "Files selected",
    printReady: "Print preview prepared",
    coming: "This function will be connected in the next release. The UI is ready.",
  },
} as const;

function Icon({ name, color, size = 22 }: { name: React.ComponentProps<typeof MaterialIcons>["name"]; color: string; size?: number }) {
  return <MaterialIcons name={name} color={color} size={size} />;
}

function ActionCard({ icon, title, hint, color, onPress }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; title: string; hint: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionCard, { backgroundColor: color + "14" }, pressed && styles.pressed]}>
      <View style={[styles.actionIcon, { backgroundColor: color + "22" }]}><Icon name={icon} color={color} size={23} /></View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionHint} numberOfLines={1}>{hint}</Text>
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

export default function HomeScreen() {
  const [language, setLanguage] = useState<Language>("ar");
  const [selectedPaper, setSelectedPaper] = useState("certificate");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [copies, setCopies] = useState("1");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [command, setCommand] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const { colorScheme, setColorScheme } = useThemeContext();
  const colors = useColors();
  const isArabic = language === "ar";
  const t = copy[language];
  const paper = useMemo(() => paperPresetById(selectedPaper), [selectedPaper]);

  const chooseFiles = async (type: string | string[]) => {
    const result = await DocumentPicker.getDocumentAsync({ type, multiple: true, copyToCacheDirectory: true });
    if (!result.canceled) {
      setSelectedFiles(result.assets.map((asset) => asset.name));
      Alert.alert(t.picked, `${result.assets.length} ${t.selected}`);
    }
  };

  const openPrintDialog = async () => {
    try {
      const width = orientation === "portrait" ? 794 : 1123;
      const height = orientation === "portrait" ? 1123 : 794;
      await Print.printAsync({
        html: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"/><style>@page{size:${paper.size};margin:18mm}body{font-family:Arial;color:#10233f;text-align:center;padding-top:28%;}h1{font-size:30px}p{font-size:16px;color:#527087}</style></head><body><h1>${isArabic ? "معاينة شهادة PrintPilot" : "PrintPilot Certificate Preview"}</h1><p>${paper.ar} · ${paper.weight} · ${copies} ${isArabic ? "نسخة" : "copies"}</p></body></html>`,
        width,
        height,
        orientation: orientation === "portrait" ? Print.Orientation.portrait : Print.Orientation.landscape,
        margins: { top: 18, bottom: 18, left: 18, right: 18 },
      });
      Alert.alert(t.printReady, `${paper.size} · ${paper.weight}`);
    } catch {
      Alert.alert("PrintPilot", t.coming);
    }
  };

  const actionComing = () => Alert.alert("PrintPilot", t.coming);

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
          <ActionCard icon="merge-type" title={t.merge} hint={t.mergeHint} color="#0A7EA4" onPress={() => chooseFiles("application/pdf")} />
          <ActionCard icon="photo-library" title={t.images} hint={t.imagesHint} color="#8B5CF6" onPress={() => chooseFiles("image/*")} />
          <ActionCard icon="photo-filter" title={t.extract} hint={t.extractHint} color="#F59E0B" onPress={() => chooseFiles("application/pdf")} />
          <ActionCard icon="document-scanner" title={t.scan} hint={t.scanHint} color="#10B981" onPress={actionComing} />
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
          <SettingLabel title={t.weight} value={paper.weight} colors={colors} />
          <View style={[styles.weightRow, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
            {[
              ["80 g/m²", "عادي"],
              ["120 g/m²", "متوسط"],
              ["200 g/m²", "شهادة"],
            ].map(([value, label]) => <Pressable key={value} onPress={() => setSelectedPaper(value === "200 g/m²" ? "certificate" : "a4")} style={[styles.weightItem, { backgroundColor: paper.weight === value ? colors.primary + "16" : colors.background, borderColor: paper.weight === value ? colors.primary : colors.border }]}><Text style={[styles.weightValue, { color: paper.weight === value ? colors.primary : colors.foreground }]}>{value}</Text><Text style={[styles.weightLabel, { color: colors.muted }]}>{isArabic ? label : value === "80 g/m²" ? "Standard" : value === "120 g/m²" ? "Medium" : "Certificate"}</Text></Pressable>)}
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
});
