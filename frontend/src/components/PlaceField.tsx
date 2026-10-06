/**
 * components/PlaceField.tsx
 *
 * Every place a form asks for works like the drop field of a ride search:
 * suggestions as you type (nearest first), your recent places, where you are
 * now, and a pin on the map. A place with a known position (the map, where
 * you are, a rank or terminus) keeps that point for geocodePlace.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { Text, TextInput } from './Text';
import { Icon, type IconName } from './Icon';
import { choosePlace, fetchPlaceSuggestions, rememberExactPlace, type PlaceSuggestion } from '../services/placesService';
import { getPlaceHistory, type HistoryPlace } from '../services/placeHistoryService';
import { useCurrentPlace } from '../hooks/useCurrentPlace';
import { pickOnMap } from '../utils/mapPick';
import { MAPS_ENABLED } from '../config/maps';
import { Radius, Spacing, Typography } from '../theme';
import { tc, tk } from '../theme/themed';

const DEBOUNCE_MS = 300;
const MAX_RECENT = 3;

interface Props {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  /** Biases suggestions; defaults to where the phone is */
  near?: { lat: number; lng: number };
  /** Which end of a journey this is: the map pin's colour and title follow it */
  field?: 'from' | 'to';
  /** Offer where the phone is now (a pickup, a start) */
  allowCurrent?: boolean;
}

interface Row {
  key: string;
  icon: IconName;
  title: string;
  sub?: string;
  onPress: () => void;
}

export function PlaceField({ label, value, onChange, placeholder, near, field = 'to', allowCurrent }: Props) {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { place: here } = useCurrentPlace();
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [recent, setRecent] = useState<HistoryPlace[]>([]);
  const [focused, setFocused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef(0);
  const bias = near ?? (here ? { lat: here.lat, lng: here.lng } : undefined);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const type = (text: string) => {
    onChange(text);
    if (timer.current) clearTimeout(timer.current);
    if (text.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const id = ++request.current;
      try {
        const found = await fetchPlaceSuggestions(text, bias);
        if (id === request.current) setSuggestions(found);
      } catch {
        if (id === request.current) setSuggestions([]);
      }
    }, DEBOUNCE_MS);
  };

  const focus = () => {
    setFocused(true);
    getPlaceHistory().then(list => setRecent(list.slice(0, MAX_RECENT))).catch(() => undefined);
  };

  const done = (text: string) => {
    onChange(text);
    setSuggestions([]);
    setFocused(false);
  };

  const showPreview = !focused && value.length > 0;
  const rows: Row[] = [];
  if (focused && allowCurrent && here?.address) {
    rows.push({
      key: 'here',
      icon: 'crosshairs-gps',
      title: t('home.currentLocation'),
      sub: here.address,
      onPress: () => {
        rememberExactPlace(here.address!, here.lat, here.lng);
        done(here.address!);
      },
    });
  }
  if (focused && value.trim().length < 2) {
    for (const p of recent) {
      const text = p.subtitle ? `${p.name}, ${p.subtitle}` : p.name;
      rows.push({
        key: `recent:${text}`,
        icon: p.favourite ? 'star-outline' : 'history',
        title: p.name,
        sub: p.subtitle,
        onPress: () => {
          if (p.lat !== undefined && p.lng !== undefined) rememberExactPlace(text, p.lat, p.lng);
          done(text);
        },
      });
    }
  }
  if (focused) {
    for (const place of suggestions) {
      rows.push({ key: place.placeId, icon: 'map-marker-outline', title: place.name, sub: place.subtitle, onPress: () => done(choosePlace(place)) });
    }
  }

  return (
    <View>
      <Text style={[styles.label, tc.color_textSec]}>{label}</Text>
      <View style={[
        styles.inputRow,
        tc.backgroundColor_surface,
        focused ? tc.borderColor_primary : tc.borderColor_border
      ]}>
        <View style={[styles.dot, field === 'from' ? tc.borderColor_success : tc.borderColor_error]} />
        <View style={styles.flex1}>
          <TextInput
            value={value}
            onChangeText={type}
            onFocus={focus}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder={placeholder}
            placeholderTextColor={tk.textSec}
            accessibilityLabel={label}
            style={[styles.input, { opacity: showPreview ? 0 : 1 }, tc.color_text]}
          />
          {/* An unfocused Android field shows the end of a long address; this
              shows its start, cut short with "…". Touches reach the field. */}
          {showPreview ? (
            <View pointerEvents="none" style={styles.preview}>
              <Text style={[styles.previewText, tc.color_text]} numberOfLines={1}>{value}</Text>
            </View>
          ) : null}
        </View>
        {MAPS_ENABLED ? (
          <Pressable
            onPress={() => pickOnMap(navigation, field, point => done(point.address))}
            accessibilityRole="button"
            accessibilityLabel={`${t('search.selectOnMap')}: ${label}`}
            hitSlop={6}
            style={[styles.mapBtn, tc.backgroundColor_surfaceVariant]}
          >
            <Icon name="map-outline" size={20} color={tk.text} />
          </Pressable>
        ) : null}
      </View>
      {rows.length > 0 ? (
        <View style={[styles.list, tc.backgroundColor_surface, tc.borderColor_border]}>
          {rows.map((row, i) => (
            <Pressable
              key={row.key}
              onPress={row.onPress}
              accessibilityRole="button"
              style={[styles.row, i < rows.length - 1 && [{ borderBottomWidth: StyleSheet.hairlineWidth }, tc.borderBottomColor_border]]}
            >
              <Icon name={row.icon} size={20} color={tk.textSec} />
              <View style={styles.flex1}>
                <Text style={[styles.rowTitle, tc.color_text]} numberOfLines={1}>{row.title}</Text>
                {row.sub ? <Text style={[styles.rowSub, tc.color_textSec]} numberOfLines={1}>{row.sub}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingLeft: 14,
    paddingRight: 6,
  },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 3 },
  input: { minHeight: 48, fontSize: Typography.lg },
  preview: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center' },
  previewText: { fontSize: Typography.lg },
  mapBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  list: { borderWidth: 1, borderRadius: Radius.md, marginTop: 4, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 52, paddingHorizontal: 14, paddingVertical: 6 },
  rowTitle: { fontSize: Typography.lg, fontWeight: Typography.semibold },
  rowSub: { fontSize: Typography.sm, marginTop: 1 },
});
