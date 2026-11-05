import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import {
  NIB,
  WELCOME_VIEWBOX,
  buildPenTrack,
  buildTimeline,
  strokePath,
  type StrokeTiming,
} from "@/shared/welcome-calligraphy";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const INK = "#E8F6FA";
const WRITING_MS = 3600;

const timeline: StrokeTiming[] = buildTimeline();
const pen = buildPenTrack(timeline);
const nibAngle = (NIB.angleDeg * Math.PI) / 180;

/** The same stroke shifted along the nib angle: stacked copies make the chisel thick/thin look. */
const nibCopies = (segments: number[][]) =>
  NIB.copies.map((k) => {
    const dx = ((k * NIB.length) / 2) * Math.cos(nibAngle);
    const dy = ((k * NIB.length) / 2) * Math.sin(nibAngle);
    return strokePath(segments.map((c) => c.map((value, i) => value + (i % 2 === 0 ? dx : dy))));
  });

function Calligraphy({ writing }: { writing: Animated.Value }) {
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(screenWidth - 32, 440);
  const height = (width * WELCOME_VIEWBOX.height) / WELCOME_VIEWBOX.width;
  const strokes = useMemo(
    () =>
      timeline.map(({ stroke, length, start, end }, index) => {
        if (stroke.segments) {
          const dash = length + 2;
          const offset = writing.interpolate({
            inputRange: [start, end],
            outputRange: [dash + 12, 0],
            extrapolate: "clamp",
          });
          return nibCopies(stroke.segments).map((d, copy) => (
            <AnimatedPath
              key={`${index}-${copy}`}
              d={d}
              fill="none"
              stroke={INK}
              strokeWidth={stroke.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={[dash, dash + 14]}
              strokeDashoffset={offset}
            />
          ));
        }
        const opacity = writing.interpolate({
          inputRange: [start, end],
          outputRange: [0, 1],
          extrapolate: "clamp",
        });
        return (
          <AnimatedCircle key={index} cx={stroke.dot[0]} cy={stroke.dot[1]} r={stroke.dot[2] * 1.2} fill={INK} opacity={opacity} />
        );
      }),
    [writing],
  );
  const penX = writing.interpolate({ inputRange: pen.times, outputRange: pen.xs, extrapolate: "clamp" });
  const penY = writing.interpolate({ inputRange: pen.times, outputRange: pen.ys, extrapolate: "clamp" });
  const penOpacity = writing.interpolate({ inputRange: [0, 0.96, 1], outputRange: [1, 1, 0], extrapolate: "clamp" });
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`${WELCOME_VIEWBOX.x} ${WELCOME_VIEWBOX.y} ${WELCOME_VIEWBOX.width} ${WELCOME_VIEWBOX.height}`}
    >
      {strokes}
      <AnimatedCircle cx={penX} cy={penY} r={18} fill="#42C4D9" opacity={Animated.multiply(penOpacity, 0.22)} />
      <AnimatedCircle cx={penX} cy={penY} r={6} fill="#42C4D9" opacity={penOpacity} />
    </Svg>
  );
}

export function AnimatedSplash() {
  const [visible, setVisible] = useState(true);
  const logoScale = useRef(new Animated.Value(0.72)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const writing = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0.86)).current;

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 7, tension: 70, useNativeDriver: true }),
      ]),
      // The greeting is written stroke by stroke.
      Animated.timing(writing, {
        toValue: 1,
        duration: WRITING_MS,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: false,
      }),
      Animated.timing(subtitleOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.delay(520),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]);
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 520, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.86, duration: 520, useNativeDriver: true }),
      ]),
    );
    pulseAnimation.start();
    animation.start(({ finished }) => {
      if (finished) setVisible(false);
    });
    return () => {
      animation.stop();
      pulseAnimation.stop();
    };
  }, [logoOpacity, logoScale, overlayOpacity, pulse, subtitleOpacity, writing]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} pointerEvents="none">
      <Animated.View style={[styles.logo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulse }] }]} />
        <View style={styles.logoHalo}>
          <MaterialIcons name="print" size={52} color="#FFFFFF" />
        </View>
        <View style={styles.checkBadge}>
          <MaterialIcons name="check" size={15} color="#0C1725" />
        </View>
      </Animated.View>
      <View style={styles.writingBlock} accessible accessibilityLabel="أهلا د.يوسف">
        <Calligraphy writing={writing} />
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
  logo: { alignItems: "center", justifyContent: "center" },
  pulseRing: {
    position: "absolute",
    width: 132,
    height: 132,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: "#42C4D9",
    opacity: 0.45,
  },
  logoHalo: {
    width: 112,
    height: 112,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A7EA4",
    shadowColor: "#42C4D9",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  checkBadge: {
    position: "absolute",
    right: -4,
    bottom: -3,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#42C4D9",
    borderWidth: 3,
    borderColor: "#0C1725",
  },
  writingBlock: { alignItems: "center", marginTop: 18 },
  subtitle: { color: "#B7C8D8", fontSize: 12, marginTop: 6 },
});
