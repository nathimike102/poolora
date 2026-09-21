/**
 * components/PooloraLogo.tsx
 *
 * Reusable Poolora brand mark rendered with react-native-svg.
 * Mirrors branding/poolora-mark.svg; keep the two in sync.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

/** Dark ink used for the road, wheels and passengers. */
const INK = "#1A1446";

interface PooloraLogoProps {
  /** Container box size */
  size?: number;
  /** Container background color */
  backgroundColor?: string;
  /** Border radius of container; defaults to the tile's own corner radius */
  borderRadius?: number;
  /** Render the wordmark below the icon */
  showWordmark?: boolean;
  /** Wordmark text */
  wordmark?: string;
  /** Supporting text below the wordmark */
  subtitle?: string;
}

export function PooloraLogo({
  size = 44,
  backgroundColor = "transparent",
  borderRadius,
  showWordmark = false,
  wordmark = "Poolora",
  subtitle = "Smart Scheduled Carpooling",
}: PooloraLogoProps) {
  const svgSize = size;
  const br = borderRadius ?? size * (56 / 256); // Match the tile's corners

  return (
    <View
      testID="poolora-logo"
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
          <LinearGradient id="bg" x1="0" y1="0" x2="256" y2="256" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFB400" />
            <Stop offset="0.5" stopColor="#FF4F6D" />
            <Stop offset="1" stopColor="#7B3FF2" />
          </LinearGradient>
          <LinearGradient id="glass" x1="128" y1="100" x2="128" y2="132" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#2FE0D2" />
            <Stop offset="1" stopColor="#0B7A75" />
          </LinearGradient>
        </Defs>

        {/* Tile */}
        <Rect width="256" height="256" rx="56" fill="url(#bg)" />
        <Circle cx="214" cy="42" r="70" fill="#FFFFFF" fillOpacity={0.12} />

        {/* Road */}
        <Path d="M16 198Q128 184 240 198L240 214Q128 200 16 214Z" fill={INK} fillOpacity={0.45} />
        <Path
          d="M34 205Q128 192 222 205"
          stroke="#FFFFFF"
          strokeOpacity={0.85}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray="12 11"
        />

        {/* Speed lines */}
        <Path d="M14 126H34" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" />
        <Path d="M8 146H34" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" strokeOpacity={0.8} />
        <Path d="M18 164H34" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" strokeOpacity={0.6} />

        {/* Car body, windows and passengers */}
        <Path
          d="M44 168V151Q44 139 56 137L92 132L111 106Q117 97 128 97H160Q170 97 177 105L197 128L205 130Q216 133 216 146V168Q216 178 206 178H54Q44 178 44 168Z"
          fill="#FFFFFF"
        />
        <Path d="M101 131L117 109Q121 104 128 104H140V131Z" fill="url(#glass)" />
        <Path d="M147 104H160Q166 104 171 110L187 131H147Z" fill="url(#glass)" />
        <Circle cx="124" cy="117" r="6.5" fill={INK} />
        <Path d="M113 131Q124 121 135 131Z" fill={INK} />
        <Circle cx="162" cy="117" r="6.5" fill={INK} />
        <Path d="M151 131Q162 121 173 131Z" fill={INK} />

        {/* Stripe and lights */}
        <Rect x="52" y="148" width="156" height="7" rx="3.5" fill="#0B7A75" />
        <Rect x="203" y="137" width="11" height="8" rx="4" fill="#FFD23F" />
        <Rect x="44" y="140" width="7" height="9" rx="3.5" fill="#FF3B5C" />

        {/* Wheels */}
        <Circle cx="82" cy="178" r="20" fill={INK} stroke="#FFFFFF" strokeWidth={5} />
        <Circle cx="82" cy="178" r="7.5" fill="#FFD23F" />
        <Circle cx="180" cy="178" r="20" fill={INK} stroke="#FFFFFF" strokeWidth={5} />
        <Circle cx="180" cy="178" r="7.5" fill="#FFD23F" />

        {/* Location pin */}
        <Path d="M144 90C132 76 124 67 124 56A20 20 0 1 1 164 56C164 67 156 76 144 90Z" fill="#FFFFFF" />
        <Circle cx="144" cy="56" r="8" fill="#FF4F6D" />
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
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  lockup: {
    gap: 12,
  },
  wordmarkBlock: {
    alignItems: "center",
    gap: 2,
  },
  wordmark: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
    color: INK,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: "#6B7A90",
    letterSpacing: 0.6,
  },
});
