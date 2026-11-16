import { ActivityIndicator, Pressable, View } from "react-native";
import { Text } from "@/components/app-text";
import { FONT_SIZE } from "@/constants/typography";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useColors } from "@/hooks/use-colors";
import { devicesForTask, type NetworkPrinterDevice } from "@/shared/network-devices";
import { copy } from "@/shared/copy";
import { styles } from "./home-styles";
import type { OperationProgress } from "./home-types";

export function Icon({
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

export function ActionCard({
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

export function FileRow({
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

export function OperationProgressBanner({
  progress,
  colors,
  isArabic,
  dismissLabel,
  hint,
  onDismiss,
}: {
  progress: OperationProgress;
  colors: ReturnType<typeof useColors>;
  isArabic: boolean;
  hint: string;
  dismissLabel: string;
  onDismiss: () => void;
}) {
  const stages = [
    "progressStage1",
    "progressStage2",
    "progressStage3",
  ] as const;
  const settled = progress.complete || progress.deviceState === "completed" || progress.deviceState === "failed" || progress.deviceState === "canceled" || progress.deviceState === "awaiting-confirmation";
  const statusColor = progress.deviceState === "failed" || progress.deviceState === "canceled" ? colors.error : progress.deviceState === "awaiting-confirmation" ? colors.muted : colors.primary;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.progressCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={[styles.progressHeader, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
        {progress.deviceState === "failed" || progress.deviceState === "canceled" ? (
          <Icon name="error-outline" color={colors.error} size={19} />
        ) : progress.deviceState === "awaiting-confirmation" ? (
          <Icon name="schedule" color={colors.muted} size={19} />
        ) : progress.complete || progress.deviceState === "completed" ? (
          <Icon name="check-circle" color={colors.primary} size={19} />
        ) : (
          <ActivityIndicator color={colors.primary} size="small" />
        )}
        <Text
          style={[styles.progressLabel, { color: statusColor, textAlign: isArabic ? "right" : "left" }]}
          numberOfLines={2}
        >
          {progress.label}
        </Text>
        {settled ? (
          <Pressable onPress={onDismiss} accessibilityLabel={dismissLabel}>
            <Icon name="close" color={colors.muted} size={19} />
          </Pressable>
        ) : null}
      </View>
      {!progress.deviceTask ? (
        <View style={[styles.progressStages, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
          {stages.map((stage, index) => {
            const active = index < progress.stage;
            return (
              <View key={stage} style={styles.progressStage}>
                <View
                  style={[
                    styles.progressStageTrack,
                    { backgroundColor: active ? colors.primaryFill : colors.border },
                  ]}
                />
                <Text
                  style={[
                    styles.progressStageText,
                    { color: active ? colors.primary : colors.muted, textAlign: isArabic ? "right" : "left" },
                  ]}
                  numberOfLines={1}
                >
                  {copy[isArabic ? "ar" : "en"][stage]}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
      <Text style={[styles.progressHint, { color: colors.muted, textAlign: isArabic ? "right" : "left" }]}>
        {hint}
      </Text>
    </View>
  );
}

export function SettingPills({
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
                selected === item.value ? colors.primaryFill : colors.background,
              borderColor:
                selected === item.value ? colors.primary : colors.border,
            },
          ]}
        >
          <Text
            style={{
              color: selected === item.value ? "#fff" : colors.foreground,
              fontSize: FONT_SIZE.secondary,
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

export function NetworkDeviceSelector({
  devices,
  mode,
  selectedPrintAddress,
  selectedScanServiceUrl,
  discovering,
  searched,
  error,
  colors,
  isArabic,
  onDiscover,
  onSelectPrint,
  onSelectScan,
}: {
  devices: NetworkPrinterDevice[];
  mode: "print" | "scan";
  selectedPrintAddress: string | null;
  selectedScanServiceUrl: string | null;
  discovering: boolean;
  searched: boolean;
  error: string | null;
  colors: ReturnType<typeof useColors>;
  isArabic: boolean;
  onDiscover: () => void;
  onSelectPrint: (device: NetworkPrinterDevice) => void;
  onSelectScan: (device: NetworkPrinterDevice) => void;
}) {
  const text = copy[isArabic ? "ar" : "en"];
  const taskDevices = devicesForTask(devices, mode);
  const selected = mode === "print" ? Boolean(selectedPrintAddress) : Boolean(selectedScanServiceUrl);
  const searchLabel = mode === "print" ? text.printDeviceSearch : text.scanDeviceSearch;
  const searchingLabel = mode === "print" ? text.printDeviceSearching : text.scanDeviceSearching;
  const searchPrompt = mode === "print" ? text.printDeviceSearchPrompt : text.scanDeviceSearchPrompt;
  const searchEmpty = mode === "print" ? text.printDeviceSearchNone : text.scanDeviceSearchNone;
  return (
    <View style={{ gap: 9, marginVertical: 8 }}>
      <Pressable
        accessibilityRole="button"
        disabled={discovering}
        onPress={onDiscover}
        style={({ pressed }) => [
          styles.outlineAction,
          { borderColor: colors.primary, opacity: discovering ? 0.6 : 1 },
          pressed && styles.pressed,
        ]}
      >
        {discovering ? <ActivityIndicator color={colors.primary} size="small" /> : <Icon name="search" color={colors.primary} size={18} />}
        <Text style={[styles.outlineActionText, { color: colors.primary }]}>
          {discovering ? searchingLabel : searchLabel}
        </Text>
      </Pressable>
      {discovering ? (
        <Text style={{ color: colors.muted, textAlign: isArabic ? "right" : "left" }}>{searchingLabel}</Text>
      ) : error ? (
        <Text style={{ color: colors.error, textAlign: isArabic ? "right" : "left" }}>{error}</Text>
      ) : searched && taskDevices.length === 0 ? (
        <Text style={{ color: colors.muted, textAlign: isArabic ? "right" : "left" }}>{searchEmpty}</Text>
      ) : !searched ? (
        <Text style={{ color: colors.muted, textAlign: isArabic ? "right" : "left" }}>{searchPrompt}</Text>
      ) : null}
      {taskDevices.map((device) => {
        const selectedPrint = device.address === selectedPrintAddress;
        const selectedScan = device.serviceUrl === selectedScanServiceUrl;
        const selectedForTask = mode === "print" ? selectedPrint : selectedScan;
        const printFormats = (device.supportedFormats ?? [])
          .filter((format) => format === "application/pdf" || format === "image/jpeg")
          .map((format) => format === "application/pdf" ? "PDF" : "JPEG");
        return (
          <View
            key={device.serviceUrl ?? `ipp:${device.address}`}
            style={[
              styles.advancedCard,
              {
                backgroundColor: colors.surface,
                borderColor: selectedForTask ? colors.primary : colors.border,
                borderWidth: 1,
                padding: 12,
              },
            ]}
          >
            <View style={{ flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: colors.foreground, fontWeight: "800", textAlign: isArabic ? "right" : "left" }}>
                  {device.name || device.model || text.deviceNameUnknown}
                </Text>
                {device.model && device.model !== device.name ? (
                  <Text style={{ color: colors.muted, textAlign: isArabic ? "right" : "left" }}>{device.model}</Text>
                ) : null}
                <Text style={{ color: colors.muted, textAlign: isArabic ? "right" : "left" }}>{text.scannerAddress}: {device.address}</Text>
                {mode === "print" ? (
                  <Text style={{ color: colors.success, textAlign: isArabic ? "right" : "left" }}>
                    {`${text.printConfirmed}: ${printFormats.join(", ")}`}
                  </Text>
                ) : (
                  <Text style={{ color: colors.success, textAlign: isArabic ? "right" : "left" }}>{text.scanConfirmed}</Text>
                )}
              </View>
            </View>
            <View style={{ flexDirection: isArabic ? "row-reverse" : "row", gap: 8, marginTop: 10 }}>
              {mode === "print" ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedPrint }}
                  onPress={() => onSelectPrint(device)}
                  style={[styles.settingPill, { flex: 1, borderColor: selectedPrint ? colors.primary : colors.border, backgroundColor: selectedPrint ? colors.primaryFill : colors.background }]}
                >
                  <Text style={{ color: selectedPrint ? "#fff" : colors.foreground, fontWeight: "800", textAlign: "center" }}>
                    {selectedPrint ? text.printSelected : text.printAction}
                  </Text>
                </Pressable>
              ) : null}
              {mode === "scan" ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedScan }}
                  onPress={() => onSelectScan(device)}
                  style={[styles.settingPill, { flex: 1, borderColor: selectedScan ? colors.primary : colors.border, backgroundColor: selectedScan ? colors.primaryFill : colors.background }]}
                >
                  <Text style={{ color: selectedScan ? "#fff" : colors.foreground, fontWeight: "800", textAlign: "center" }}>
                    {selectedScan ? text.scanSelected : text.scanAction}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
      <Text style={{ color: selected ? colors.success : colors.muted, textAlign: isArabic ? "right" : "left" }}>
        {selected ? text.deviceSelected : mode === "print" ? text.printChooseDevice : text.scanChooseDevice}
      </Text>
      <Text style={{ color: colors.muted, textAlign: isArabic ? "right" : "left" }}>
        {mode === "print" ? text.printUnconfirmedHidden : text.scanUnconfirmedHidden}
      </Text>
    </View>
  );
}


export function SectionTitle({
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
      <View style={[styles.titleRule, { backgroundColor: colors.primaryFill }]} />
    </View>
  );
}

export function SettingLabel({
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

export function WorkspaceTile({
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

export function PrivacyRow({
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
