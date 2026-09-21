/**
 * screens/OnboardingScreen.tsx
  */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useApp } from '../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientButton } from '../components/GradientButton';
import { Icon, type IconName } from '../components/Icon';
import { Typography, Spacing, Radius } from '../theme';
import type { RootStackParamList } from '../navigation/types';

export const ONBOARDING_SEEN_KEY = '@poolora_onboarding_seen';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

const { width: SCREEN_W } = Dimensions.get('window');
const IMAGE_HEIGHT = 340;

/**
 * Each slide is drawn from the app's own icon set on a tinted panel, rather
 * than a photograph: it needs no network on first launch and raises no
 * question about who owns the picture.
 */
const SLIDES = [
  {
    icon: 'car-multiple' as IconName,
    tint: '#E6F2F1',
    title: 'Share Your Ride',
    subtitle:
      'Find drivers already travelling your route and share the cost of the trip.',
    accent: '#0B7A75',
    badge: 'CARPOOL',
  },
  {
    icon: 'calendar-clock' as IconName,
    tint: '#E3F2EB',
    title: 'Schedule in Advance',
    subtitle:
      'Book a seat ahead of time. Rides are matched on your route and departure time.',
    accent: '#047857',
    badge: 'SCHEDULE',
  },
  {
    icon: 'shield-check' as IconName,
    tint: '#FBF0DF',
    title: 'Safety Built In',
    subtitle:
      'Drivers are verified before they can offer rides, and SOS alerts your emergency contacts with your location.',
    accent: '#B45309',
    badge: 'SAFETY',
  },
] as const;

// ─── Animated Dot ──────────────────────────────────────────────────────────────
interface DotProps {
  active: boolean;
  primaryColor: string;
  borderColor: string;
}

function ProgressDot({ active, primaryColor, borderColor }: DotProps) {
  // Animated width for active/inactive state
  const width = useRef(new Animated.Value(active ? 28 : 8)).current;
  const bg = useRef(
    new Animated.Value(active ? 1 : 0),
  ).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: active ? 28 : 8,
      duration: 300,
      useNativeDriver: false, // width cannot use native driver
    }).start();
  }, [active, width]);

  const backgroundColor = bg.interpolate({
    inputRange: [0, 1],
    outputRange: [borderColor, primaryColor],
  });

  useEffect(() => {
    Animated.timing(bg, {
      toValue: active ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [active, bg]);

  return (
    <Animated.View
      style={[
        styles.dot,
        { width, backgroundColor },
      ]}
    />
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export function OnboardingScreen() {
  const navigation = useNavigation<NavProp>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(0);

  // Slide animation values
  const slideX = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentY = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(1)).current;

  const animateToSlide = useCallback(
    (nextIndex: number) => {
      // Exit animation (replaces exit={{ opacity: 0, x: -60 }})
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(contentY, {
          toValue: -20,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(badgeScale, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideX, {
          toValue: -SCREEN_W * 0.15,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Update slide
        setCurrent(nextIndex);
        contentY.setValue(20);
        slideX.setValue(SCREEN_W * 0.15);

        // Enter animation (replaces initial={{ opacity:0, x:60 }} animate={{ opacity:1, x:0 }})
        Animated.parallel([
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(contentY, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.spring(badgeScale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 80,
            friction: 6,
          }),
          Animated.timing(slideX, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
    [contentOpacity, contentY, badgeScale, slideX],
  );

  const finish = () => {
    // The splash screen skips onboarding once it has been seen on this device
    AsyncStorage.setItem(ONBOARDING_SEEN_KEY, '1').catch(() => {});
    // replace() removes onboarding from the back-stack
    navigation.replace('Login');
  };

  const next = () => {
    if (current < SLIDES.length - 1) {
      animateToSlide(current + 1);
    } else {
      finish();
    }
  };

  const skip = finish;

  const slide = SLIDES[current];

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* Skip button */}
      <View style={styles.skipRow}>
        <TouchableOpacity accessibilityRole="button" onPress={skip} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.skipLabel, { color: c.textSec }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Illustration */}
      <View style={styles.imageContainer}>
        <Animated.View style={{ transform: [{ translateX: slideX }], flex: 1 }}>
          <View style={[styles.illustration, { backgroundColor: slide.tint }]}>
            <Icon name={slide.icon} size={132} color={slide.accent} />
          </View>
        </Animated.View>

        {/* Gradient overlay */}
        <View
          style={[styles.gradientOverlay, { backgroundColor: c.bg }]}
          pointerEvents="none"
        />

        {/* Accent badge */}
        <Animated.View
          style={[
            styles.badge,
            { backgroundColor: slide.accent },
            { transform: [{ scale: badgeScale }] },
          ]}
        >
          <Text style={styles.badgeText}>{slide.badge}</Text>
        </Animated.View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.textBlock,
            {
              opacity: contentOpacity,
              transform: [{ translateY: contentY }],
            },
          ]}
        >
          <Text style={[styles.title, { color: c.text }]}>{slide.title}</Text>
          <Text style={[styles.subtitle, { color: c.textSec }]}>
            {slide.subtitle}
          </Text>
        </Animated.View>

        {/* Progress dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <ProgressDot
              key={i}
              active={i === current}
              primaryColor={c.primary}
              borderColor={c.border}
            />
          ))}
        </View>

        {/* CTA */}
        <GradientButton
          label={current < SLIDES.length - 1 ? 'Continue' : 'Get Started'}
          onPress={next}
          colorStart={c.primary}
          colorEnd={c.primaryDark}
        />
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  skipRow: {
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  skipLabel: {
    fontSize: Typography.md,
    fontWeight: Typography.medium,
  },

  // Illustration panel
  imageContainer: {
    height: IMAGE_HEIGHT,
    overflow: 'hidden', // Same as CSS overflow: hidden
    position: 'relative',
  },
  illustration: {
    width: SCREEN_W,
    height: IMAGE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Gradient overlay — bottom 96dp fades to bg colour
  // Production: replace with expo-linear-gradient
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 96,
    opacity: 0.9,
  },

  // Accent badge
  badge: {
    position: 'absolute',
    top: 20,
    left: 20,
    borderRadius: Radius.md,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  badgeText: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    color: '#FFFFFF',
  },

  // Content section
  content: {
    flex: 1,
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.lg,
    paddingBottom: Spacing['2xl'],
  },
  textBlock: {
    flex: 1,
    gap: 12,
  },
  title: {
    fontSize: Typography['6xl'],
    fontWeight: Typography.extrabold,
    lineHeight: Typography['6xl'] * 1.2,
  },
  subtitle: {
    fontSize: Typography.xl,
    lineHeight: Typography.xl * 1.6,
  },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing['2xl'],
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});
