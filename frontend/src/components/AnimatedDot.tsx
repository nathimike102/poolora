/**
 * components/AnimatedDot.tsx
 *
 * Pulsing dot used in the Splash loading indicator.
 *
 * Uses React Native Animated to avoid worklet mutation warnings in dev-client.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Animated, Easing } from 'react-native';

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
  const scale = React.useRef(new Animated.Value(1)).current;
  const opacity = React.useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const delayMs = Math.max(0, delay * 1000);

    const startScaleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.4,
          duration: 450,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 450,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    const startOpacityLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 450,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 450,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    const timeoutId = setTimeout(() => {
      startScaleLoop.start();
      startOpacityLoop.start();
    }, delayMs);

    return () => {
      clearTimeout(timeoutId);
      startScaleLoop.stop();
      startOpacityLoop.stop();
      scale.stopAnimation();
      opacity.stopAnimation();
      scale.setValue(1);
      opacity.setValue(0.5);
    };
  }, [delay, opacity, scale]);

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
          transform: [{ scale }],
          opacity,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {},
});
