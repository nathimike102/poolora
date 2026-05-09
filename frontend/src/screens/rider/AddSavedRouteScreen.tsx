import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { addSavedRoute } from '../../services/savedRouteService';
import { Spacing, Radius, Shadow, Typography } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ICONS = [
  { emoji: '🏠', label: 'Home' },
  { emoji: '🏢', label: 'Office' },
  { emoji: '✈️', label: 'Airport' },
  { emoji: '🏥', label: 'Hospital' },
  { emoji: '🎓', label: 'College' },
  { emoji: '🛒', label: 'Market' },
  { emoji: '🏋️', label: 'Gym' },
  { emoji: '📍', label: 'Other' },
];

export function AddSavedRouteScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [routeName, setRouteName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [time, setTime] = useState('');
  const [savings, setSavings] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('🏠');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!routeName.trim()) {
      Alert.alert('Missing Info', 'Please enter a route name.');
      return;
    }
    if (!from.trim()) {
      Alert.alert('Missing Info', 'Please enter the starting location.');
      return;
    }
    if (!to.trim()) {
      Alert.alert('Missing Info', 'Please enter the destination.');
      return;
    }

    setSaving(true);
    try {
      await addSavedRoute({
        name: routeName.trim(),
        from: from.trim(),
        to: to.trim(),
        icon: selectedIcon,
        time: time.trim() || '',
        savings: savings.trim() || '',
      });
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not save route. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* ── Header ───────────────────────────────── */}
      <LinearGradient
        colors={['#1A2E4A', c.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M19 12H5M12 5l-7 7 7 7"
              stroke="white"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>Add Saved Route</Text>
      </LinearGradient>

      {/* ── Form ─────────────────────────────────── */}
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Route Name */}
          <Text style={[styles.label, { color: c.text }]}>Route Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            placeholder="e.g. Home → Office"
            placeholderTextColor={c.textSec}
            value={routeName}
            onChangeText={setRouteName}
          />

          {/* Starting Location */}
          <Text style={[styles.label, { color: c.text }]}>Starting Location</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            placeholder="e.g. Koramangala 6th Block"
            placeholderTextColor={c.textSec}
            value={from}
            onChangeText={setFrom}
          />

          {/* Destination */}
          <Text style={[styles.label, { color: c.text }]}>Destination</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            placeholder="e.g. MG Road"
            placeholderTextColor={c.textSec}
            value={to}
            onChangeText={setTo}
          />

          {/* Icon Selector */}
          <Text style={[styles.label, { color: c.text }]}>Route Icon</Text>
          <View style={styles.iconRow}>
            {ICONS.map(item => {
              const isSelected = selectedIcon === item.emoji;
              return (
                <Pressable
                  key={item.label}
                  onPress={() => setSelectedIcon(item.emoji)}
                  style={[
                    styles.iconChip,
                    {
                      backgroundColor: isSelected ? c.primaryLight : c.surface,
                      borderColor: isSelected ? c.primary : c.border,
                    },
                  ]}
                >
                  <Text style={styles.iconEmoji}>{item.emoji}</Text>
                  <Text style={[styles.iconLabel, { color: isSelected ? c.primary : c.textSec }]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Estimated Time (optional) */}
          <Text style={[styles.label, { color: c.text }]}>
            Estimated Time <Text style={{ color: c.textSec, fontWeight: '400' }}>(optional)</Text>
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            placeholder="e.g. 35 min"
            placeholderTextColor={c.textSec}
            value={time}
            onChangeText={setTime}
          />

          {/* Estimated Savings (optional) */}
          <Text style={[styles.label, { color: c.text }]}>
            Estimated Savings <Text style={{ color: c.textSec, fontWeight: '400' }}>(optional)</Text>
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            placeholder="e.g. ₹280/week"
            placeholderTextColor={c.textSec}
            value={savings}
            onChangeText={setSavings}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Save Button ──────────────────────────── */}
      <View style={[styles.bottomBar, { borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Pressable onPress={handleSave} disabled={saving}>
          <LinearGradient
            colors={[c.primary, c.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          >
            <Text style={styles.saveBtnText}>
              {saving ? 'Saving…' : 'Save Route'}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: Typography.bold,
    color: 'white',
  },

  /* Form */
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: 40,
  },
  label: {
    fontSize: 14,
    fontWeight: Typography.semibold,
    marginBottom: 8,
    marginTop: 18,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    fontSize: 15,
  },

  /* Icon selector */
  iconRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconChip: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  iconEmoji: { fontSize: 22 },
  iconLabel: { fontSize: 11, fontWeight: Typography.medium, marginTop: 4 },

  /* Bottom bar */
  bottomBar: {
    paddingHorizontal: Spacing.xl,
    paddingTop: 12,
    borderTopWidth: 1,
    backgroundColor: 'transparent',
  },
  saveBtn: {
    height: 56,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: Typography.bold,
    color: 'white',
  },
});
