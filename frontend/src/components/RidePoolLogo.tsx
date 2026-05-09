/**
 * components/RidePoolLogo.tsx
 *
 * Reusable RidePool logo rendered with react-native-svg.
 */

import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { View, StyleSheet } from 'react-native';
import { Radius } from '../theme';

interface RidePoolLogoProps {
  /** Container box size */
  size?: number;
  /** Container background color */
  backgroundColor?: string;
  /** SVG stroke/fill color */
  color?: string;
  /** Border radius of container — pass 0 for circular */
  borderRadius?: number;
}

export function RidePoolLogo({
  size = 44,
  backgroundColor = '#7C3AED',
  color = 'white',
  borderRadius,
}: RidePoolLogoProps) {
  const svgSize = size * 0.59; // Scale SVG proportionally inside container
  const br = borderRadius ?? size * 0.32; // Default proportional radius

  return (
    <View
      testID="ridepool-logo"
      style={[
        styles.container,
        { width: size, height: size, borderRadius: br, backgroundColor },
      ]}
    >
      <Svg width={svgSize} height={svgSize} viewBox="0 0 52 52" fill="none">
        <Path
          d="M10 26C10 17.16 17.16 10 26 10C34.84 10 42 17.16 42 26"
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <Circle cx="16" cy="32" r="5" fill={color} />
        <Circle cx="36" cy="32" r="5" fill={color} />
        <Path
          d="M21 32H31"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
