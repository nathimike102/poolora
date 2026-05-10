/**
 * components/RidePoolLogo.tsx
 *
 * Reusable Sanchari brand mark rendered with react-native-svg.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

interface RidePoolLogoProps {
  /** Container box size */
  size?: number;
  /** Container background color */
  backgroundColor?: string;
  /** Border radius of container — pass 0 for circular */
  borderRadius?: number;
  /** Render the wordmark below the icon */
  showWordmark?: boolean;
  /** Wordmark text */
  wordmark?: string;
  /** Supporting text below the wordmark */
  subtitle?: string;
}

export function RidePoolLogo({
  size = 44,
  backgroundColor = 'transparent',
  borderRadius,
  showWordmark = false,
  wordmark = 'Sanchari',
  subtitle = 'Smart Scheduled Carpooling',
}: RidePoolLogoProps) {
  const svgSize = size;
  const br = borderRadius ?? size * 0.32; // Default proportional radius

  return (
    <View
      testID="ridepool-logo"
      style={[
        styles.wrapper,
        showWordmark ? styles.lockup : styles.container,
        showWordmark
          ? null
          : {
              width: size,
              height: size,
              borderRadius: br,
              backgroundColor,
            },
      ]}
    >
      <Svg width={svgSize} height={svgSize} viewBox="0 0 256 256" fill="none">
        <Defs>
          <LinearGradient id="pinGradient" x1="128" y1="20" x2="128" y2="126" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#FFB02E" />
            <Stop offset="100%" stopColor="#FF7A00" />
          </LinearGradient>
          <LinearGradient id="leftArc" x1="42" y1="56" x2="118" y2="164" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#0FA7A0" />
            <Stop offset="100%" stopColor="#11B5B0" />
          </LinearGradient>
          <LinearGradient id="rightArc" x1="138" y1="56" x2="214" y2="164" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#7A47C1" />
            <Stop offset="100%" stopColor="#8E5BDA" />
          </LinearGradient>
          <LinearGradient id="roadLeft" x1="28" y1="178" x2="128" y2="200" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#18B7AF" />
            <Stop offset="100%" stopColor="#2BA7BE" />
          </LinearGradient>
          <LinearGradient id="roadRight" x1="120" y1="184" x2="228" y2="206" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#3D79DD" />
            <Stop offset="100%" stopColor="#2F63C5" />
          </LinearGradient>
        </Defs>

        <Path
          d="M56 106C56 67.4 82.2 44 128 44"
          stroke="url(#leftArc)"
          strokeWidth="22"
          strokeLinecap="round"
        />
        <Path
          d="M200 106C200 67.4 173.8 44 128 44"
          stroke="url(#rightArc)"
          strokeWidth="22"
          strokeLinecap="round"
        />

        <Path
          d="M128 20C107 20 90 36.8 90 57.5C90 81.8 117.2 111.8 126.8 122.2C127.4 122.8 128.6 122.8 129.2 122.2C138.8 111.8 166 81.8 166 57.5C166 36.8 149 20 128 20Z"
          fill="url(#pinGradient)"
        />
        <Circle cx="128" cy="59" r="18" fill="#FFF7EE" />

        <Path
          d="M88 126C91 92 112.5 78 128 78C143.5 78 165 92 168 126"
          stroke="#0D2F66"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <Path
          d="M81 131H175C182.2 131 188 136.8 188 144V163H68V144C68 136.8 73.8 131 81 131Z"
          fill="#F8FBFF"
          stroke="#0D2F66"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <Path
          d="M90 133C94 116 105.8 104 121 102H135C150.2 104 162 116 166 133"
          stroke="#0D2F66"
          strokeWidth="6"
          strokeLinecap="round"
        />

        <Circle cx="104" cy="116" r="11" fill="#0D2F66" />
        <Circle cx="128" cy="112" r="12" fill="#0D2F66" />
        <Circle cx="153" cy="116" r="11" fill="#0D2F66" />
        <Path
          d="M96 150C98 140 104 134 112 134C119 134 124 139 128 145C132 139 137 134 144 134C152 134 158 140 160 150"
          fill="#0D2F66"
        />

        <Path
          d="M72 146C64 146 58 150 56 156L54 163H68"
          fill="#0D2F66"
        />
        <Path
          d="M184 146C192 146 198 150 200 156L202 163H188"
          fill="#0D2F66"
        />
        <Path
          d="M71 158C71 152.5 77.3 147 86.5 147C95.7 147 102 151.1 107 157.2C101 162.5 94.4 165 86.8 165C77.8 165 71 162 71 158Z"
          fill="#0D2F66"
        />
        <Path
          d="M185 158C185 152.5 178.7 147 169.5 147C160.3 147 154 151.1 149 157.2C155 162.5 161.6 165 169.2 165C178.2 165 185 162 185 158Z"
          fill="#0D2F66"
        />

        <Path
          d="M36 194C78 171 121 168 169 176C187 179 202 184 220 194"
          stroke="url(#roadLeft)"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <Path
          d="M92 208C134 189 174 188 222 197"
          stroke="url(#roadRight)"
          strokeWidth="14"
          strokeLinecap="round"
        />
      </Svg>

      {showWordmark ? (
        <View style={styles.wordmarkBlock}>
          <Text style={styles.wordmark}>{wordmark}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockup: {
    gap: 12,
  },
  wordmarkBlock: {
    alignItems: 'center',
    gap: 2,
  },
  wordmark: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    color: '#0D2F66',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: '#6B7A90',
    letterSpacing: 0.6,
  },
});
