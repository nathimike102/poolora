/**
 * components/DriverLoginModal.tsx
 *
 * Bottom-sheet modal for driver sign-up / login flow.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../context/AppContext';
import { GradientButton } from './GradientButton';
import { Typography, Spacing, Radius, Shadow } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const { height: SCREEN_H } = Dimensions.get('window');

// ─── Step data ────────────────────────────────────────────────────────────────

const STEPS = [
  {
    emoji: '👤',
    label: 'Personal Details',
    desc: 'Name, DOB, gender & contact info',
  },
  {
    emoji: '🚗',
    label: 'Vehicle Details',
    desc: 'Car info, registration & fuel type',
  },
  {
    emoji: '📄',
    label: 'Document Verification',
    desc: 'Aadhaar, DL, RC, PAN & Insurance',
  },
] as const;

// ─── Props ─────────────────────────────────────────────────────────────────────

interface DriverLoginModalProps {
  visible: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DriverLoginModal({ visible, onClose }: DriverLoginModalProps) {
  const navigation = useNavigation<NavProp>();
  const { c, setRole } = useApp();

  // ── Sheet slide animation ─────────────────────────────────────────────────
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: true,
        stiffness: 380,
        damping: 38,
      }).start();
    }
  }, [visible, slideY]);

  // ── Animated close ──────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    Animated.spring(slideY, {
      toValue: SCREEN_H,
      useNativeDriver: true,
      stiffness: 380,
      damping: 38,
    }).start(() => {
      // Reset position for next open, then notify parent
      slideY.setValue(SCREEN_H);
      onClose();
    });
  }, [slideY, onClose]);

  const handleSwitch = useCallback(() => {
    setRole('driver');
    handleClose();
    setTimeout(() => {
      navigation.navigate('PersonalDetails');
    }, 350); // after sheet has closed
  }, [setRole, handleClose, navigation]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      {/* Backdrop */}
      <TouchableOpacity
        testID="modal-backdrop"
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleClose}
      />

      {/* ── Bottom Sheet ──────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: c.surface },
          { transform: [{ translateY: slideY }] },
          Shadow.lg,
        ]}
      >
        {/* Drag handle */}
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconBox, { backgroundColor: c.primaryDark }]}>
                <Svg width={28} height={28} viewBox="0 0 24 24" fill="white">
                  <Path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
                </Svg>
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: c.text }]}>
                  Become a Driver
                </Text>
                <Text style={[styles.headerSubtitle, { color: c.textSec }]}>
                  Complete 3 quick steps to get started
                </Text>
              </View>
            </View>

            {/* Close button */}
            <TouchableOpacity
              testID="modal-close-btn"
              onPress={handleClose}
              style={[styles.closeBtn, { backgroundColor: c.bg, borderColor: c.border }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                stroke={c.textSec} strokeWidth={2.5}
              >
                <Path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* ── 3-step list ──────────────────────────────────────────────── */}
          <View
            style={[
              styles.stepsContainer,
              { backgroundColor: c.bg, borderColor: c.border },
            ]}
          >
            {STEPS.map((step, i) => (
              <View key={i}>
                {i > 0 && (
                  <View
                    style={[styles.stepDivider, { backgroundColor: c.border }]}
                  />
                )}
                <View style={styles.stepRow}>
                  {/* Icon with number badge */}
                  <View style={styles.stepIconWrapper}>
                    <View style={[styles.stepIcon, { backgroundColor: c.primaryLight }]}>
                      <Text style={styles.stepEmoji}>{step.emoji}</Text>
                    </View>
                    {/* Number badge */}
                    <View style={[styles.stepBadge, { backgroundColor: c.primary }]}>
                      <Text style={styles.stepBadgeText}>{i + 1}</Text>
                    </View>
                  </View>

                  <View style={styles.stepText}>
                    <Text style={[styles.stepLabel, { color: c.text }]}>
                      {step.label}
                    </Text>
                    <Text style={[styles.stepDesc, { color: c.textSec }]}>
                      {step.desc}
                    </Text>
                  </View>

                  <Svg width={16} height={16} viewBox="0 0 24 24" fill={c.border}>
                    <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                  </Svg>
                </View>
              </View>
            ))}
          </View>

          {/* ── Earnings banner ──────────────────────────────────────────── */}
          <View
            style={[
              styles.earningsBanner,
              {
                backgroundColor: `${c.success}12`,
                borderColor: `${c.success}30`,
              },
            ]}
          >
            <Text style={styles.earningsEmoji}>💰</Text>
            <View>
              <Text style={[styles.earningsTitle, { color: c.success }]}>
                Earn ₹5,000 – ₹15,000/month extra
              </Text>
              <Text style={[styles.earningsDesc, { color: c.textSec }]}>
                Set your own schedule · Instant UPI payouts
              </Text>
            </View>
          </View>

          {/* ── CTA ───────────────────────────────────────────────────────── */}
          <GradientButton
            testID="onboarding-btn"
            label="Start Driver Onboarding"
            onPress={handleSwitch}
            colorStart={c.primary}
            colorEnd={c.primaryDark}
          />

          <Text style={[styles.disclaimer, { color: c.textSec }]}>
            Takes 5–10 minutes · Document review within 2–4 hours
          </Text>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },

  // Bottom sheet
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: Radius['4xl'],
    borderTopRightRadius: Radius['4xl'],
    paddingBottom: Spacing['6xl'],
  },

  handleRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: Spacing.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },

  content: {
    paddingHorizontal: Spacing['2xl'],
    gap: Spacing.xl,
    paddingBottom: Spacing.lg,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography['3xl'],
    fontWeight: Typography.extrabold,
  },
  headerSubtitle: {
    fontSize: Typography.base,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: Spacing.sm,
  },

  // Steps
  stepsContainer: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  stepDivider: {
    height: 1,
    marginLeft: 56,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  stepIconWrapper: {
    position: 'relative',
    flexShrink: 0,
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepEmoji: {
    fontSize: 20,
  },
  stepBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontSize: Typography.xs,
    fontWeight: Typography.extrabold,
    color: '#FFFFFF',
  },
  stepText: {
    flex: 1,
  },
  stepLabel: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
  },
  stepDesc: {
    fontSize: Typography.sm,
    marginTop: 1,
  },

  // Earnings
  earningsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderRadius: Radius['2xl'],
    borderWidth: 1,
  },
  earningsEmoji: {
    fontSize: 24,
  },
  earningsTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
  },
  earningsDesc: {
    fontSize: Typography.sm,
    marginTop: 1,
  },

  // Disclaimer
  disclaimer: {
    textAlign: 'center',
    fontSize: Typography.xs,
    marginTop: -Spacing.sm,
  },
});
