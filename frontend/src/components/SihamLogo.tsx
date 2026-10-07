/**
 * components/SihamLogo.tsx
 *
 * The Siham brand mark, drawn from vector artwork so it is sharp at any size.
 * Alone it is the app icon (symbol on a navy tile); with `showWordmark` it is
 * the primary logo, the symbol above the SIHAM wordmark.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";

import { SYMBOL_FIGURES, SYMBOL_TRANSFORM, WORDMARK_PATH, WORDMARK_VIEWBOX } from "./brand/sihamArt";
import { Brand } from "../theme";
import { useThemeColor, type AnyColor } from "../theme/themed";

const [, , WORDMARK_W, WORDMARK_H] = WORDMARK_VIEWBOX.split(" ").map(Number);

interface SihamSymbolProps {
  size: number;
  /** "light" for a dark background (the logo's own colours), "dark" for a light one */
  tone?: "dark" | "light";
}

/** The three-people symbol on its own, without a tile. */
export function SihamSymbol({ size, tone = "dark" }: SihamSymbolProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1000 1000">
      <G transform={SYMBOL_TRANSFORM}>
        {SYMBOL_FIGURES.map((f) => {
          // The ivory figure disappears on a light background, so it turns navy
          const fill = tone === "dark" && f.fill === Brand.ivory ? Brand.navy : f.fill;
          return (
            <G key={f.name} fill={fill}>
              <Path d={f.d} />
              <Circle cx={f.head.cx} cy={f.head.cy} r={f.head.r} />
            </G>
          );
        })}
      </G>
    </Svg>
  );
}

/** The SIHAM letters. */
export function SihamWordmark({ width, color }: { width: number; color: string }) {
  return (
    <Svg width={width} height={(width * WORDMARK_H) / WORDMARK_W} viewBox={WORDMARK_VIEWBOX}>
      <Path d={WORDMARK_PATH} fill={color} fillRule="evenodd" />
    </Svg>
  );
}

interface SihamLogoProps {
  /** Tile size, or the symbol's size when the wordmark is shown */
  size?: number;
  /** Tile colour; navy by default, like the app icon */
  backgroundColor?: AnyColor;
  /** Corner radius of the tile; defaults to the app icon's corners */
  borderRadius?: number;
  /** Show the symbol above the SIHAM wordmark instead of the icon tile */
  showWordmark?: boolean;
  /** Supporting text below the wordmark */
  subtitle?: string;
  /** "light" for the wordmark on a coloured or dark background */
  tone?: "dark" | "light";
}

export function SihamLogo({
  size = 44,
  backgroundColor: backgroundColorProp = Brand.navy,
  borderRadius,
  showWordmark = false,
  subtitle = "Smart Scheduled Carpooling",
  tone = "dark",
}: SihamLogoProps) {
  const backgroundColor = useThemeColor(backgroundColorProp);

  if (showWordmark) {
    return (
      <View testID="siham-logo" accessible accessibilityRole="image" accessibilityLabel="Siham" style={styles.lockup}>
        <SihamSymbol size={size} tone={tone} />
        <SihamWordmark width={size * 1.25} color={tone === "light" ? Brand.ivory : Brand.navy} />
        {subtitle ? <Text style={[styles.subtitle, tone === "light" && styles.subtitleLight]}>{subtitle}</Text> : null}
      </View>
    );
  }

  return (
    <View
      testID="siham-logo"
      accessible
      accessibilityRole="image"
      accessibilityLabel="Siham"
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: borderRadius ?? size * 0.225, backgroundColor },
      ]}
    >
      <SihamSymbol size={size * 0.72} tone="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: "center",
    justifyContent: "center",
  },
  lockup: {
    alignItems: "center",
    gap: 14,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: "#6B7A90",
    letterSpacing: 0.6,
  },
  subtitleLight: { color: "rgba(245,241,231,0.8)" },
});
