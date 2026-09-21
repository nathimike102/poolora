/**
 * screens/SplashScreen.tsx
 */

import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useApp } from "../context/AppContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedDot } from "../components/AnimatedDot";
import { PooloraLogo } from "../components/PooloraLogo";
import { Typography, Spacing } from "../theme";
import type { RootStackParamList } from "../navigation/types";

type NavProp = NativeStackNavigationProp<RootStackParamList, "Splash">;

export function SplashScreen() {
  const navigation = useNavigation<NavProp>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  // ── Animations (react-native-reanimated) ────────────────────────────────────
  const logoScale = useSharedValue(0.6);
  const logoOpacity = useSharedValue(0);
  const loaderOpacity = useSharedValue(0);
  const loaderTranslateY = useSharedValue(20);

  useEffect(() => {
    // 1. Logo entrance
    logoScale.value = withSpring(1, { damping: 7, stiffness: 60 });
    logoOpacity.value = withTiming(1, { duration: 700 });

    // 2. Loader entrance (delay 1200ms)
    loaderOpacity.value = withDelay(1200, withTiming(1, { duration: 500 }));
    loaderTranslateY.value = withDelay(1200, withTiming(0, { duration: 500 }));

    // 3. Auto-navigate after 2.8s
    const timer = setTimeout(() => {
      navigation.replace("Onboarding");
    }, 2800);

    return () => clearTimeout(timer);
  }, [navigation, logoScale, logoOpacity, loaderOpacity, loaderTranslateY]);

  const logoAnimStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const loaderAnimStyle = useAnimatedStyle(() => ({
    opacity: loaderOpacity.value,
    transform: [{ translateY: loaderTranslateY.value }],
  }));

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: c.primary, paddingTop: insets.top },
      ]}
    >
      {/* Background decorative circles */}
      <View style={[styles.circleLarge, styles.absolutePosition]} />
      <View style={[styles.circleSmall, styles.absolutePosition]} />

      {/* ── Logo + Wordmark ─────────────────────────────────────────────────── */}
      <Animated.View style={[styles.logoContainer, logoAnimStyle]}>
        <PooloraLogo
          size={150}
          backgroundColor="rgba(255,255,255,0.10)"
          borderRadius={36}
          showWordmark
          wordmark="Poolora"
          subtitle="Smart Scheduled Carpooling"
        />
      </Animated.View>

      {/* ── Loading Dots ────────────────────────────────────────────────────── */}
      <Animated.View style={[styles.loaderContainer, loaderAnimStyle]}>
        <View style={styles.dotsRow}>
          <AnimatedDot delay={0} />
          <AnimatedDot delay={0.2} />
          <AnimatedDot delay={0.4} />
        </View>
        <Text style={styles.platformLabel}>India's #1 Carpooling Platform</Text>
      </Animated.View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    // overflow: 'hidden' is default in RN — no need to specify
  },

  // Decorative background circles
  absolutePosition: {
    position: "absolute",
  },
  circleLarge: {
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: "rgba(255,255,255,0.04)",
    top: -100,
    right: -100,
  },
  circleSmall: {
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(255,255,255,0.04)",
    bottom: -60,
    left: -60,
  },

  // Logo area
  logoContainer: {
    alignItems: "center",
    gap: Spacing.lg,
  },

  // Loading indicator
  loaderContainer: {
    position: "absolute",
    bottom: 60,
    alignItems: "center",
    gap: 12,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 6,
  },
  platformLabel: {
    fontSize: Typography.sm,
    color: "rgba(255,255,255,0.4)",
  },
});
