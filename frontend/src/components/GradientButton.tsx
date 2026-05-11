/**
 * components/GradientButton.tsx
 *
 * Primary CTA button with press scale animation (reanimated) and haptic feedback.
 */

import React, { useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Radius, Typography, Shadow } from '../theme';

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** CSS-style gradient string alternative: pass start/end colours */
  colorStart?: string;
  colorEnd?: string;
  /** Flat colour used when disabled */
  disabledColor?: string;
  height?: number;
  style?: ViewStyle;
  labelStyle?: TextStyle;
  testID?: string;
}

export function GradientButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  colorStart = '#7C3AED',
  _colorEnd = '#5B21B6',
  disabledColor = '#E5E7EB',
  height = 56,
  style,
  labelStyle,
  testID = 'gradient-button',
}: GradientButtonProps) {
  // Press scale animation via reanimated
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, { damping: 20, stiffness: 200 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 10, stiffness: 100 });
  }, [scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  const isDisabled = disabled || loading;

  return (
    <ReAnimated.View style={animStyle}>
      <TouchableOpacity
        testID={testID}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        activeOpacity={1}
        style={[
          styles.button,
          {
            height,
            backgroundColor: isDisabled ? disabledColor : colorStart,
          },
          // Apply primary shadow only when active
          !isDisabled && Shadow.primary(colorStart),
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text
            style={[
              styles.label,
              { color: isDisabled ? '#9CA3AF' : '#FFFFFF' },
              labelStyle,
            ]}
          >
            {label}
          </Text>
        )}
      </TouchableOpacity>
    </ReAnimated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  label: {
    fontSize: Typography['2xl'],
    fontWeight: Typography.bold,
    letterSpacing: 0.2,
  },
});
