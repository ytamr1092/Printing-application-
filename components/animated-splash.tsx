import * as SplashScreen from "expo-splash-screen";
import { memo, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";

import { APP_FONT_FAMILY } from "@/components/app-text";
import { GREETING_LINES, GREETING_VIEW } from "@/shared/welcome-greeting-data";
import { lineProgress, revealEdge } from "@/shared/welcome-writing";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const INK = "#E8F6FA";
const GLOW = "#42C4D9";
const WRITING_MS = 4200;

/** One line of the greeting: static outlines, revealed through a moving clip. */
const GreetingLine = memo(function GreetingLine({ index }: { index: number }) {
  const line = GREETING_LINES[index];
  return (
    <>
      {line.glyphs.map((glyph, i) => (
        <Path key={i} d={glyph.d} fill={INK} />
      ))}
    </>
  );
});

function Greeting({ progress }: { progress: number }) {
  const { width: screenWidth } = useWindowDimensions();
  const width = screenWidth - 8;
  const k = width / GREETING_VIEW.width;
  const height = GREETING_VIEW.height * k;
  const steps = lineProgress(progress);
  const viewBox = `0 0 ${GREETING_VIEW.width} ${GREETING_VIEW.height}`;
  // Each line is revealed by a plain clipping view growing from the right edge
  // (no SVG clip paths, which are unreliable on some Android devices).
  return (
    <View style={{ width, height }}>
      {GREETING_LINES.map((line, index) => {
        const u = steps[index];
        if (u <= 0) return null;
        const edge = revealEdge(line, u);
        const revealPx = Math.max(0, Math.min(width, (GREETING_VIEW.width - edge) * k));
        const mid = ((line.top + line.bottom) / 2) * k;
        const bar = (line.bottom - line.top) * k;
        return (
          <View key={index} style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: revealPx, overflow: "hidden" }}>
              <View style={{ position: "absolute", top: 0, right: 0, width, height }}>
                <Svg width={width} height={height} viewBox={viewBox}>
                  <GreetingLine index={index} />
                </Svg>
              </View>
            </View>
            {u < 1 ? (
              <>
                <View style={{ position: "absolute", right: revealPx - 14, top: mid - bar / 2, width: 28, height: bar, backgroundColor: GLOW, opacity: 0.16, borderRadius: 14, transform: [{ skewX: "-12deg" }] }} />
                <View style={{ position: "absolute", right: revealPx - 2, top: mid - bar / 2, width: 4, height: bar, backgroundColor: GLOW, opacity: 0.7, borderRadius: 2, transform: [{ skewX: "-12deg" }] }} />
              </>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export function AnimatedSplash() {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
    let frame = 0;
    let cancelled = false;
    let fade: Animated.CompositeAnimation | null = null;
    const startedAt = Date.now();
    const tick = () => {
      if (cancelled) return;
      const value = Math.min(1, (Date.now() - startedAt) / WRITING_MS);
      setProgress(value);
      if (value < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }
      fade = Animated.sequence([
        Animated.timing(subtitleOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.delay(620),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]);
      fade.start(({ finished }) => {
        if (finished && !cancelled) setVisible(false);
      });
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      fade?.stop();
    };
  }, [overlayOpacity, subtitleOpacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} pointerEvents="none">
      <View style={styles.writingBlock} accessible accessibilityLabel="أهلا د.يوسف">
        <Greeting progress={progress} />
      </View>
      <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>
        مركزك الذكي للطباعة والمستندات
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0C1725",
  },
  writingBlock: { alignItems: "center" },
  subtitle: { color: "#B7C8D8", fontSize: 13, marginTop: 18, fontFamily: APP_FONT_FAMILY },
});
