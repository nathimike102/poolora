/**
 * components/PlaceField.tsx
 *
 * A text field with place suggestions from the backend place search,
 * nearest to the user first.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';

import { useApp } from '../context/AppContext';
import { Icon } from './Icon';
import { choosePlace, fetchPlaceSuggestions, type PlaceSuggestion } from '../services/placesService';

const DEBOUNCE_MS = 300;

export function PlaceField({
  label,
  value,
  onChange,
  placeholder,
  near,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  near?: { lat: number; lng: number };
}) {
  const { c } = useApp();
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [focused, setFocused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef(0);

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
        const found = await fetchPlaceSuggestions(text, near);
        if (id === request.current) setSuggestions(found);
      } catch {
        if (id === request.current) setSuggestions([]);
      }
    }, DEBOUNCE_MS);
  };

  return (
    <View>
      <Text style={[styles.label, { color: c.textSec }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={type}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        placeholderTextColor={c.textSec}
        accessibilityLabel={label}
        style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
      />
      {focused && suggestions.length > 0 ? (
        <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.border }]}>
          {suggestions.map(place => (
            <Pressable
              key={place.placeId}
              onPress={() => {
                onChange(choosePlace(place));
                setSuggestions([]);
              }}
              accessibilityRole="button"
              style={styles.row}
            >
              <Icon name="map-marker-outline" size={16} color={c.textSec} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: c.text }} numberOfLines={1}>{place.name}</Text>
                {place.subtitle ? <Text style={{ fontSize: 12, color: c.textSec }} numberOfLines={1}>{place.subtitle}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 },
  list: { borderWidth: 1, borderRadius: 10, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 12 },
});
