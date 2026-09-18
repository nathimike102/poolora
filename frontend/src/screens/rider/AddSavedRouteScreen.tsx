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
import { Icon, type IconName } from '../../components/Icon';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ICONS: { icon: IconName; label: string }[] = [
  { icon: 'home', label: 'Home' },
  { icon: 'office-building', label: 'Office' },
  { icon: 'airplane', label: 'Airport' },
  { icon: 'hospital-building', label: 'Hospital' },
  { icon: 'school', label: 'College' },
  { icon: 'cart', label: 'Market' },
  { icon: 'dumbbell', label: 'Gym' },
  { icon: 'map-marker', label: 'Other' },
];

export function AddSavedRouteScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [routeName, setRouteName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<IconName>('home');
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
        colors={['#0B2447', c.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
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
            placeholder="For example, Home to office"
            accessibilityLabel="Route name"
            placeholderTextColor={c.textSec}
            value={routeName}
            onChangeText={setRouteName}
          />

          {/* Starting Location */}
          <Text style={[styles.label, { color: c.text }]}>Starting Location</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            placeholder="Where you start"
            accessibilityLabel="Starting location"
            placeholderTextColor={c.textSec}
            value={from}
            onChangeText={setFrom}
          />

          {/* Destination */}
          <Text style={[styles.label, { color: c.text }]}>Destination</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            placeholder="Where you're going"
            accessibilityLabel="Destination"
            placeholderTextColor={c.textSec}
            value={to}
            onChangeText={setTo}
          />

          {/* Icon Selector */}
          <Text style={[styles.label, { color: c.text }]}>Route Icon</Text>
          <View style={styles.iconRow}>
            {ICONS.map(item => {
              const isSelected = selectedIcon === item.icon;
              return (
                <Pressable
                  key={item.label}
                  onPress={() => setSelectedIcon(item.icon)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={item.label}
                  style={[
                    styles.iconChip,
                    {
                      backgroundColor: isSelected ? c.primaryLight : c.surface,
                      borderColor: isSelected ? c.primary : c.border,
                    },
                  ]}
                >
                  <Icon name={item.icon} size={22} color={isSelected ? c.primary : c.textSec} />
                  <Text style={[styles.iconLabel, { color: isSelected ? c.primary : c.textSec }]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Save Button ──────────────────────────── */}
      <View style={[styles.bottomBar, { borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Pressable onPress={handleSave} disabled={saving} accessibilityRole="button">
          <LinearGradient
            colors={[c.primary, c.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          >
            <Text style={styles.saveBtnText}>
              {saving ? 'Saving' : 'Save route'}
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
    width: 44,
    height: 44,
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
