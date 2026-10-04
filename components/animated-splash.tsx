import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export function AnimatedSplash() {
  const [visible, setVisible] = useState(true);
  const logoScale = useRef(new Animated.Value(0.72)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.86)).current;

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 360,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 7,
          tension: 70,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 1,
          duration: 760,
          useNativeDriver: false,
        }),
      ]),
      Animated.delay(180),
    ]);
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 520,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.86,
          duration: 520,
          useNativeDriver: true,
        }),
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
  }, [logoOpacity, logoScale, progress, pulse, titleOpacity]);

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View
        style={[
          styles.logo,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <Animated.View
          style={[styles.pulseRing, { transform: [{ scale: pulse }] }]}
        />
        <View style={styles.logoHalo}>
          <MaterialIcons name="print" size={52} color="#FFFFFF" />
        </View>
        <View style={styles.checkBadge}>
          <MaterialIcons name="check" size={15} color="#0C1725" />
        </View>
      </Animated.View>
      <Animated.View style={[styles.titleBlock, { opacity: titleOpacity }]}>
        <Text style={styles.title}>طباعة</Text>
        <Text style={styles.subtitle}>مركزك الذكي للطباعة والمستندات</Text>
        <View style={styles.track}>
          <Animated.View
            style={[
              styles.progress,
              {
                width: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>
      </Animated.View>
    </View>
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
  titleBlock: { alignItems: "center", marginTop: 26 },
  title: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  subtitle: { color: "#B7C8D8", fontSize: 12, marginTop: 6 },
  track: {
    width: 150,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#24384B",
    overflow: "hidden",
    marginTop: 22,
  },
  progress: { height: "100%", borderRadius: 2, backgroundColor: "#42C4D9" },
});
