/**
 * screens/SplashScreen.tsx
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path, Circle } from 'react-native-svg';

import { useApp } from '../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedDot } from '../components/AnimatedDot';
import { Typography, Spacing, Radius, Shadow } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Splash'>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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
      navigation.replace('Onboarding');
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
    <View style={[styles.root, { backgroundColor: c.primary, paddingTop: insets.top }]}>
      {/* Background decorative circles */}
      <View style={[styles.circleLarge, styles.absolutePosition]} />
      <View style={[styles.circleSmall, styles.absolutePosition]} />

      {/* ── Logo + Wordmark ─────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.logoContainer,
          logoAnimStyle,
        ]}
      >
        {/* Logo box */}
        <View style={styles.logoBox}>
          <Svg width={52} height={52} viewBox="0 0 52 52" fill="none">
            <Path
              d="M10 26C10 17.16 17.16 10 26 10C34.84 10 42 17.16 42 26"
              stroke="white"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <Circle cx="16" cy="32" r="5" fill="white" />
            <Circle cx="36" cy="32" r="5" fill="white" />
            <Path
              d="M21 32H31"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <Path
              d="M26 10V6M26 6L22 10M26 6L30 10"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>

        {/* Wordmark */}
        <View style={styles.wordmarkContainer}>
          <Text style={styles.appName}>RidePool</Text>
          <Text style={styles.tagline}>Smart Scheduled Carpooling</Text>
        </View>
      </Animated.View>

      {/* ── Loading Dots ────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.loaderContainer,
          loaderAnimStyle,
        ]}
      >
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
    alignItems: 'center',
    justifyContent: 'center',
    // overflow: 'hidden' is default in RN — no need to specify
  },

  // Decorative background circles
  absolutePosition: {
    position: 'absolute',
  },
  circleLarge: {
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(255,255,255,0.04)',
    top: -100,
    right: -100,
  },
  circleSmall: {
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -60,
    left: -60,
  },

  // Logo area
  logoContainer: {
    alignItems: 'center',
    gap: Spacing.xl,
  },

  // Logo box
  logoBox: {
    width: 88,
    height: 88,
    borderRadius: Radius['5xl'],
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.lg,
  },

  // Wordmark
  wordmarkContainer: {
    alignItems: 'center',
    gap: 6,
  },
  appName: {
    fontSize: Typography['7xl'],
    fontWeight: Typography.extrabold,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: Typography.md,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
  },

  // Loading indicator
  loaderContainer: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
    gap: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  platformLabel: {
    fontSize: Typography.sm,
    color: 'rgba(255,255,255,0.4)',
  },
});
