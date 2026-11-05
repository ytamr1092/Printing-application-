import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from "react-native";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const GREETING = "أهلا د.يوسف";
const WRITING_MS = 3000;
const AnimatedView = Animated.createAnimatedComponent(View);

export function AnimatedSplash() {
  const [visible, setVisible] = useState(true);
  const [fontLoaded] = useFonts({
    DiwaniJali: require("../assets/fonts/diwani-jali.ttf"),
  });
  const { width: screenWidth } = useWindowDimensions();
  const logoScale = useRef(new Animated.Value(0.72)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const writing = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0.86)).current;
  const revealWidth = Math.min(screenWidth - 32, 500);

  useEffect(() => {
    if (!fontLoaded) return;
    void SplashScreen.hideAsync().catch(() => undefined);
    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 7, tension: 70, useNativeDriver: true }),
      ]),
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
  }, [fontLoaded, logoOpacity, logoScale, overlayOpacity, pulse, subtitleOpacity, writing]);

  if (!visible) return null;

  const reveal = writing.interpolate({
    inputRange: [0, 1],
    outputRange: [0, revealWidth],
    extrapolate: "clamp",
  });
  const penOpacity = writing.interpolate({
    inputRange: [0, 0.96, 1],
    outputRange: [0, 1, 0],
    extrapolate: "clamp",
  });

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
      <View style={[styles.writingBlock, { width: revealWidth }]} accessible accessibilityLabel={GREETING}>
        <AnimatedView style={[styles.revealMask, { width: reveal }]}>
          <Text
            numberOfLines={1}
            style={[styles.greeting, fontLoaded ? styles.diwaniFont : null]}
          >
            {GREETING}
          </Text>
          <Animated.View style={[styles.pen, { opacity: penOpacity }]} />
        </AnimatedView>
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
  writingBlock: { alignItems: "flex-end", marginTop: 18, overflow: "hidden" },
  revealMask: { alignItems: "flex-end", overflow: "hidden", minHeight: 66 },
  greeting: {
    width: 500,
    color: "#E8F6FA",
    fontSize: 54,
    lineHeight: 78,
    textAlign: "right",
    includeFontPadding: false,
  },
  diwaniFont: { fontFamily: "DiwaniJali" },
  pen: {
    position: "absolute",
    left: 2,
    top: 10,
    width: 3,
    height: 56,
    borderRadius: 2,
    backgroundColor: "#42C4D9",
    shadowColor: "#42C4D9",
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  subtitle: { color: "#B7C8D8", fontSize: 12, marginTop: 6 },
});
