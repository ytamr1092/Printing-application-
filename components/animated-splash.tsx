import * as SplashScreen from "expo-splash-screen";
import { memo, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { ClipPath, Defs, G, Line, Path, Polygon } from "react-native-svg";

import { GREETING_LINES, GREETING_VIEW } from "@/shared/welcome-greeting-data";
import { WRITING_SLANT, lineProgress, revealEdge, revealPolygon } from "@/shared/welcome-writing";

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
  const height = (width * GREETING_VIEW.height) / GREETING_VIEW.width;
  const steps = lineProgress(progress);
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${GREETING_VIEW.width} ${GREETING_VIEW.height}`}>
      <Defs>
        {GREETING_LINES.map((line, index) => (
          <ClipPath key={index} id={`written-${index}`}>
            <Polygon points={revealPolygon(line, steps[index])} />
          </ClipPath>
        ))}
      </Defs>
      {GREETING_LINES.map((line, index) => (
        <G key={index} clipPath={`url(#written-${index})`}>
          <GreetingLine index={index} />
        </G>
      ))}
      {GREETING_LINES.map((line, index) => {
        const u = steps[index];
        if (u <= 0 || u >= 1) return null;
        // A soft light travels with the writing front, like the pen's tip.
        const edge = revealEdge(line, u);
        const mid = (line.top + line.bottom) / 2;
        const x = (y: number) => edge - (y - mid) * WRITING_SLANT;
        return (
          <G key={`front-${index}`}>
            <Line x1={x(line.top)} y1={line.top} x2={x(line.bottom)} y2={line.bottom} stroke={GLOW} strokeOpacity={0.18} strokeWidth={90} strokeLinecap="round" />
            <Line x1={x(line.top)} y1={line.top} x2={x(line.bottom)} y2={line.bottom} stroke={GLOW} strokeOpacity={0.55} strokeWidth={18} strokeLinecap="round" />
          </G>
        );
      })}
    </Svg>
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
  subtitle: { color: "#B7C8D8", fontSize: 13, marginTop: 18 },
});
