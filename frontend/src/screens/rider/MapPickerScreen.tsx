/**
 * screens/rider/MapPickerScreen.tsx
 *
 * Visual map picker — lets the user pin their exact pickup / destination
 * location. On confirm, navigates back to SearchScreen with the chosen location.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Ellipse, Circle } from 'react-native-svg';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MockMap } from '../../components/MockMap';
import { Typography, Spacing, Radius, Shadow } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MapPicker'>;
type Route = RouteProp<RootStackParamList, 'MapPicker'>;

const PINNABLE_LOCATIONS = [
  'Koramangala 6th Block',
  'HSR Layout Sector 1',
  'Indiranagar 100 Feet Road',
  'MG Road Metro Station',
  'Whitefield ITPL',
  'Electronic City Phase 1',
  'Kempegowda International Airport',
  'Marathahalli Bridge',
  'Hebbal Flyover',
  'Jayanagar 4th Block',
];

export function MapPickerScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const isDestination = route.params.field === 'to';
  const [selected, setSelected] = useState(PINNABLE_LOCATIONS[0]);

  const confirm = () => {
    navigation.navigate('RiderTabs', {
      screen: 'Search',
      params: {
        pickedLocation: selected,
        pickedField: route.params.field,
      },
    });
  };

  return (
    <View style={styles.root}>
      {/* ── Full-screen map ────────────────────────────────────────── */}
      <MockMap style={StyleSheet.absoluteFillObject} />

      {/* ── Top gradient overlay with header ──────────────────────── */}
      <LinearGradient
        colors={[c.primary + 'F2', c.primary + '99', 'transparent']}
        style={[styles.topOverlay, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth={2.5}
              strokeLinecap="round"
            >
              <Path d="M19 12H5M12 5l-7 7 7 7" />
            </Svg>
          </TouchableOpacity>
          <View style={styles.flex1}>
            <Text style={styles.headerTitle}>
              {`Pick ${isDestination ? 'Destination' : 'Pickup'} Location`}
            </Text>
            <Text style={styles.headerSub}>Select a location from the list below</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── Centre pin marker ──────────────────────────────────────── */}
      <View style={styles.pinWrap} pointerEvents="none">
        <Svg width={36} height={44} viewBox="0 0 36 44">
          {/* Drop shadow ellipse */}
          <Ellipse cx={18} cy={42} rx={10} ry={3} fill="rgba(0,0,0,0.18)" />
          {/* Pin body */}
          <Path
            d="M18 2C11.37 2 6 7.37 6 14c0 9.75 12 26 12 26s12-16.25 12-26c0-6.63-5.37-12-12-12z"
            fill={c.primary}
          />
          <Circle cx={18} cy={14} r={5} fill="white" />
        </Svg>
      </View>

      {/* ── Bottom sheet ───────────────────────────────────────────── */}
      <View
        style={[
          styles.bottomSheet,
          Shadow.lg,
          { backgroundColor: c.surface, paddingBottom: insets.bottom + 12 },
        ]}
      >
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: c.border }]} />

        {/* Location chips */}
        <Text style={[styles.sectionLabel, { color: c.textSec }]}>NEARBY LOCATIONS</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          keyboardShouldPersistTaps="always"
        >
          {PINNABLE_LOCATIONS.map(loc => {
            const active = selected === loc;
            return (
              <TouchableOpacity
                key={loc}
                activeOpacity={0.75}
                onPress={() => setSelected(loc)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? c.primary : c.bg,
                    borderColor: active ? c.primary : c.border,
                  },
                ]}
              >
                {active && (
                  <Svg width={10} height={10} viewBox="0 0 24 24" fill="white">
                    <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </Svg>
                )}
                <Text style={[styles.chipText, { color: active ? 'white' : c.text }]}>
                  {loc}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Selected location preview */}
        <View
          style={[
            styles.selectedRow,
            { backgroundColor: c.primaryLight, borderColor: c.primary + '40' },
          ]}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill={c.primary}>
            <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </Svg>
          <Text style={[styles.selectedLabel, { color: c.textSec }]}>
            {`${isDestination ? 'Destination' : 'Pickup'}:`}
          </Text>
          <Text style={[styles.selectedText, { color: c.primary }]} numberOfLines={1}>
            {selected}
          </Text>
        </View>

        {/* Confirm button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={confirm}
          style={[styles.confirmBtn, { overflow: 'hidden', borderRadius: Radius.xl }]}
        >
          <LinearGradient
            colors={[c.primary, c.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.confirmGradient}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="white">
              <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </Svg>
            <Text style={styles.confirmText}>Confirm Location</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  // ── Header overlay ──────────────────────────────────────────────
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['3xl'] ?? 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: Typography.bold,
    color: 'white',
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },

  // ── Pin ─────────────────────────────────────────────────────────
  pinWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 120, // offset up so pin tip points to map center
  },

  // ── Bottom sheet ────────────────────────────────────────────────
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingBottom: Spacing.xs,
    paddingRight: Spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: Typography.semibold,
  },

  // ── Selected preview ────────────────────────────────────────────
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    marginTop: Spacing.md,
  },
  selectedLabel: {
    fontSize: 13,
    fontWeight: Typography.semibold,
  },
  selectedText: {
    flex: 1,
    fontSize: 14,
    fontWeight: Typography.bold,
  },

  // ── Confirm button ──────────────────────────────────────────────
  confirmBtn: {
    marginTop: Spacing.md,
  },
  confirmGradient: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  confirmText: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: 'white',
  },
});
