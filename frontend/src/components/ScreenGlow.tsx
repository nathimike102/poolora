/**
 * components/ScreenGlow.tsx
 *
 * A soft wash of the brand colour fading down from the top of a tab screen,
 * stronger in dark mode where it shows less. Put it first inside the
 * screen's root so the content draws over it.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from './ThemedSvg';


import { tk, useIsDark } from '../theme/themed';

export function ScreenGlow() {
  const isDarkMode = useIsDark();
  return (
    <View pointerEvents="none" style={styles.glow} accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Defs>
          {/* An ellipse wider than the screen, centred on its top edge */}
          <RadialGradient id="screenGlow" cx="50%" cy="0%" rx="85%" ry="100%" fx="50%" fy="0%">
            <Stop offset="0" stopColor={tk.primary} stopOpacity={isDarkMode ? 0.2 : 0.1} />
            <Stop offset="1" stopColor={tk.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#screenGlow)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
});
