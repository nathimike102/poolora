/**
 * components/MockMap.tsx
 *
 * SVG-based placeholder map used when a real map provider is unavailable.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Rect,
  Circle,
  Path,
  Line as SvgLine,
  G,
  Text as SvgText,
} from 'react-native-svg';

import { useApp } from '../context/AppContext';

interface MockMapProps {
  showRoute?: boolean;
  showDriver?: boolean;
  style?: ViewStyle;
}

export function MockMap({
  showRoute = false,
  showDriver = false,
  style,
}: MockMapProps) {
  const { isDarkMode } = useApp();

  // ── Colour palette (same as web, resolved from darkMode flag) ──────────────
  const roadColor      = isDarkMode ? '#2A3050' : '#E0E4EE';
  const mainRoadColor  = isDarkMode ? '#3A4570' : '#C8D0E0';
  const bgColor        = isDarkMode ? '#1A1E2E' : '#EEF2F8';
  const parkColor      = isDarkMode ? '#1A2A1A' : '#D4EDDA';
  const waterColor     = isDarkMode ? '#1A2035' : '#C8D8EE';
  const buildingColor  = isDarkMode ? '#252840' : '#DDE2EE';
  const treeDarkColor  = isDarkMode ? '#1E3A1E' : '#B8DCC4';

  // Pulse animation for location ring
  const pulseR = useRef(new Animated.Value(14)).current;
  const pulseOpacity = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseR, { toValue: 22, duration: 1000, useNativeDriver: false }),
          Animated.timing(pulseR, { toValue: 14, duration: 1000, useNativeDriver: false }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, { toValue: 0.05, duration: 1000, useNativeDriver: false }),
          Animated.timing(pulseOpacity, { toValue: 0.2, duration: 1000, useNativeDriver: false }),
        ]),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulseR, pulseOpacity]);

  // We can't pass Animated.Value directly to SVG props.
  // Use state to sync the animated value to a number.
  const [pulseRVal, setPulseRVal] = React.useState(14);
  const [pulseOpVal, setPulseOpVal] = React.useState(0.2);

  useEffect(() => {
    const rListener = pulseR.addListener(({ value }) => setPulseRVal(value));
    const oListener = pulseOpacity.addListener(({ value }) => setPulseOpVal(value));
    return () => {
      pulseR.removeListener(rListener);
      pulseOpacity.removeListener(oListener);
    };
  }, [pulseR, pulseOpacity]);

  return (
    <View testID="mock-map" style={[styles.container, style]}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 390 300"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Background */}
        <Rect width={390} height={300} fill={bgColor} />

        {/* City blocks — top */}
        <Rect x={0}   y={0} width={60}  height={50} fill={buildingColor} />
        <Rect x={70}  y={0} width={80}  height={45} fill={buildingColor} />
        <Rect x={160} y={0} width={50}  height={55} fill={buildingColor} />
        <Rect x={220} y={0} width={70}  height={40} fill={buildingColor} />
        <Rect x={300} y={0} width={90}  height={50} fill={buildingColor} />

        {/* Park */}
        <Rect x={70} y={55} width={80} height={60} rx={4} fill={parkColor} />
        <Circle cx={110} cy={75} r={12} fill={treeDarkColor} />
        <Circle cx={130} cy={90} r={8}  fill={treeDarkColor} />
        <Circle cx={90}  cy={95} r={10} fill={treeDarkColor} />

        {/* Water */}
        <Rect x={300} y={60} width={90} height={70} rx={4} fill={waterColor} />

        {/* Mid buildings */}
        <Rect x={0}   y={60}  width={55} height={50} fill={buildingColor} />
        <Rect x={160} y={65}  width={45} height={45} fill={buildingColor} />
        <Rect x={215} y={70}  width={75} height={40} fill={buildingColor} />

        {/* Horizontal main road */}
        <Rect x={0} y={120} width={390} height={18} fill={mainRoadColor} />
        {/* Road dashes */}
        {[30, 80, 130, 180, 230, 280, 330].map(x => (
          <Rect key={x} x={x} y={128} width={20} height={2}
            fill={isDarkMode ? '#3A4560' : '#C0C8D8'} />
        ))}

        {/* Vertical main road */}
        <Rect x={155} y={0} width={18} height={300} fill={mainRoadColor} />

        {/* Horizontal side roads */}
        {[50, 160, 210, 260].map(y => (
          <Rect key={y} x={0} y={y} width={390} height={10} fill={roadColor} />
        ))}

        {/* Vertical side roads */}
        {[60, 210, 290].map(x => (
          <Rect key={x} x={x} y={0} width={10} height={300} fill={roadColor} />
        ))}

        {/* Lower buildings */}
        <Rect x={0}   y={140} width={55} height={60} fill={buildingColor} />
        <Rect x={70}  y={145} width={75} height={55} fill={buildingColor} />
        <Rect x={175} y={140} width={25} height={60} fill={buildingColor} />
        <Rect x={220} y={145} width={60} height={55} fill={buildingColor} />
        <Rect x={300} y={140} width={90} height={60} fill={buildingColor} />
        <Rect x={0}   y={175} width={50} height={60} fill={buildingColor} />
        <Rect x={70}  y={180} width={80} height={55} fill={buildingColor} />
        <Rect x={175} y={175} width={25} height={60} fill={buildingColor} />
        <Rect x={220} y={180} width={65} height={55} fill={buildingColor} />
        <Rect x={300} y={175} width={85} height={55} fill={buildingColor} />
        <Rect x={0}   y={225} width={55} height={60} fill={buildingColor} />
        <Rect x={70}  y={225} width={75} height={60} fill={buildingColor} />
        <Rect x={175} y={225} width={25} height={60} fill={buildingColor} />
        <Rect x={220} y={225} width={60} height={60} fill={buildingColor} />
        <Rect x={300} y={225} width={90} height={60} fill={buildingColor} />

        {/* Route line + markers */}
        {showRoute && (
          <G>
            <Path
              d="M 80 240 Q 100 200 164 180 Q 164 150 164 129"
              stroke="#7C3AED"
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
              opacity={0.9}
            />
            {/* Origin */}
            <Circle cx={80} cy={240} r={8} fill="#7C3AED" />
            <Circle cx={80} cy={240} r={4} fill="white" />
            {/* Destination */}
            <Circle cx={164} cy={125} r={9} fill="#E53935" />
            <Circle cx={164} cy={125} r={4} fill="white" />
          </G>
        )}

        {/* Driver car marker */}
        {showDriver && (
          <G>
            <Circle cx={95} cy={210} r={22} fill="white" opacity={0.9} />
            <Circle cx={95} cy={210} r={18} fill="#7C3AED" />
            <SvgText
              x={95} y={216}
              textAnchor="middle"
              fill="white"
              fontSize={18}
            >
              🚗
            </SvgText>
          </G>
        )}

        {/* Pulsing location dot */}
        <G>
          <Circle
            cx={164} cy={129}
            r={pulseRVal}
            fill="#7C3AED"
            opacity={pulseOpVal}
          />
          <Circle cx={164} cy={129} r={9} fill="#7C3AED" />
          <Circle cx={164} cy={129} r={4} fill="white" />
        </G>
      </Svg>

      {/* Bottom gradient overlay */}
      <View
        style={[
          styles.gradientOverlay,
          {
            backgroundColor: isDarkMode
              ? 'rgba(22,25,38,0.8)'
              : 'rgba(246,248,252,0.8)',
          },
        ]}
        pointerEvents="none"
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },

  // Gradient overlay at the bottom of the map
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    // pointer-events: none is handled via pointerEvents prop on the View
  },
});
