/**
 * components/AnimatedDot.tsx
 *
 * Pulsing dot used in the Splash loading indicator.
 *
 * Uses react-native-reanimated for smooth 60fps animations on the UI thread.
 */

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface AnimatedDotProps {
  color?: string;
  size?: number;
  delay?: number;
}

export function AnimatedDot({
  color = 'rgba(255,255,255,0.8)',
  size = 8,
  delay = 0,
}: AnimatedDotProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    const delayMs = delay * 1000;
    scale.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1.4, { duration: 450 }),
          withTiming(1, { duration: 450 }),
        ),
        -1,
      ),
    );
    opacity.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 450 }),
          withTiming(0.5, { duration: 450 }),
        ),
        -1,
      ),
    );
  }, [delay, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      testID="animated-dot"
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {},
});
