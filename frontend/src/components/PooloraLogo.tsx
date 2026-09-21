/**
 * components/PooloraLogo.tsx
 *
 * Reusable Poolora brand mark: the app icon as a rounded tile.
 */

import React from "react";
import { Image, View, Text, StyleSheet } from "react-native";

// Rendered by scripts/generate_brand_assets.py from branding/poolora-icon.png.
import logoMark from "../../assets/logo-mark.png";

/** Wordmark colour. */
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
  /** "light" for the wordmark on a coloured or dark background */
  tone?: "dark" | "light";
}

export function PooloraLogo({
  size = 44,
  backgroundColor = "transparent",
  borderRadius,
  showWordmark = false,
  wordmark = "Poolora",
  subtitle = "Smart Scheduled Carpooling",
  tone = "dark",
}: PooloraLogoProps) {
  const br = borderRadius ?? size * 0.225; // Match the tile's corners

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
      <Image
        source={logoMark}
        style={{ width: size, height: size, borderRadius: br }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />

      {showWordmark ? (
        <View style={styles.wordmarkBlock}>
          <Text style={[styles.wordmark, tone === "light" && styles.wordmarkLight]}>{wordmark}</Text>
          <Text style={[styles.subtitle, tone === "light" && styles.subtitleLight]}>{subtitle}</Text>
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
  wordmarkLight: { color: "#FFFFFF" },
  subtitleLight: { color: "rgba(255,255,255,0.85)" },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: "#6B7A90",
    letterSpacing: 0.6,
  },
});
