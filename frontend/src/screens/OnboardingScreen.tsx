/**
 * screens/OnboardingScreen.tsx
  */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useApp } from '../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientButton } from '../components/GradientButton';
import { Typography, Spacing, Radius } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

const { width: SCREEN_W } = Dimensions.get('window');
const IMAGE_HEIGHT = 340;

// Slide data — same as web version
const SLIDES = [
  {
    image: 'https://images.unsplash.com/photo-1769555692190-acf73d7bc46c?w=600&q=80',
    title: 'Share Your Ride',
    subtitle:
      'Connect with verified co-passengers going your way. Save money, reduce traffic.',
    accent: '#7C3AED',
    badge: '🚗 CARPOOL',
  },
  {
    image: 'https://images.unsplash.com/photo-1758315427147-39bd97b36316?w=600&q=80',
    title: 'Schedule in Advance',
    subtitle:
      'Plan rides days ahead. AI matches you with the perfect carpool buddy.',
    accent: '#10B981',
    badge: '📅 SCHEDULE',
  },
  {
    image: 'https://images.unsplash.com/photo-1771848194068-169d817a1d6f?w=600&q=80',
    title: 'Ship Parcels Too',
    subtitle:
      'Send packages with trusted drivers heading in the same direction.',
    accent: '#F59E0B',
    badge: '📦 PARCELS',
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

  const next = () => {
    if (current < SLIDES.length - 1) {
      animateToSlide(current + 1);
    } else {
      // replace() removes onboarding from the back-stack
      navigation.replace('Login');
    }
  };

  const skip = () => navigation.replace('Login');

  const slide = SLIDES[current];

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* Skip button */}
      <View style={styles.skipRow}>
        <TouchableOpacity onPress={skip} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.skipLabel, { color: c.textSec }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Image area */}
      <View style={styles.imageContainer}>
        <Animated.View style={{ transform: [{ translateX: slideX }], flex: 1 }}>
          <Image
            source={{ uri: slide.image }}
            style={styles.image}
            resizeMode="cover"
          />
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

  // Image container
  imageContainer: {
    height: IMAGE_HEIGHT,
    overflow: 'hidden', // Same as CSS overflow: hidden
    position: 'relative',
  },
  image: {
    width: SCREEN_W,
    height: IMAGE_HEIGHT,
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
