import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ScreenHeader } from '../../components/ScreenHeader';
import { PlaceField } from '../../components/PlaceField';
import { Text, TextInput } from '../../components/Text';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from '../../components/Themed';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addSavedRoute } from '../../services/savedRouteService';
import { Spacing, Radius, Shadow, Typography } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';
import { Icon, type IconName } from '../../components/Icon';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { tc, tk } from '../../theme/themed';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ICONS: { icon: IconName; label: string }[] = [
  { icon: 'home', get label() { return i18n.t('addSavedRoute.icons.home'); } },
  { icon: 'office-building', get label() { return i18n.t('addSavedRoute.icons.office'); } },
  { icon: 'airplane', get label() { return i18n.t('addSavedRoute.icons.airport'); } },
  { icon: 'hospital-building', get label() { return i18n.t('addSavedRoute.icons.hospital'); } },
  { icon: 'school', get label() { return i18n.t('addSavedRoute.icons.college'); } },
  { icon: 'cart', get label() { return i18n.t('addSavedRoute.icons.market'); } },
  { icon: 'dumbbell', get label() { return i18n.t('addSavedRoute.icons.gym'); } },
  { icon: 'map-marker', get label() { return i18n.t('addSavedRoute.icons.other'); } },
];

export function AddSavedRouteScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [routeName, setRouteName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<IconName>('home');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!routeName.trim()) {
      Alert.alert(t('addSavedRoute.missingInfo'), t('addSavedRoute.pleaseEnterARouteName'));
      return;
    }
    if (!from.trim()) {
      Alert.alert(t('addSavedRoute.missingInfo'), t('addSavedRoute.pleaseEnterTheStartingLocation'));
      return;
    }
    if (!to.trim()) {
      Alert.alert(t('addSavedRoute.missingInfo'), t('addSavedRoute.pleaseEnterTheDestination'));
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
      Alert.alert(t('addSavedRoute.error'), t('addSavedRoute.couldNotSaveRoutePlease'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      <ScreenHeader title={t('addSavedRoute.addSavedRoute')} />

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
          <Text style={[styles.label, tc.color_text]}>{t('addSavedRoute.routeName2')}</Text>
          <TextInput
            style={[
              styles.input,
              tc.backgroundColor_surfaceVariant,
              tc.borderColor_surfaceVariant,
              tc.color_text
            ]}
            placeholder={t('addSavedRoute.forExampleHomeToOffice')}
            accessibilityLabel={t('addSavedRoute.routeName')}
            placeholderTextColor={tk.textSec}
            value={routeName}
            onChangeText={setRouteName}
          />

          {/* Starting location and destination, picked like a ride's */}
          <View style={styles.places}>
            <PlaceField label={t('addSavedRoute.startingLocation2')} value={from} onChange={setFrom} placeholder={t('addSavedRoute.whereYouStart')} field="from" allowCurrent />
            <PlaceField label={t('addSavedRoute.destination')} value={to} onChange={setTo} placeholder={t('addSavedRoute.whereYoureGoing')} field="to" />
          </View>

          {/* Icon Selector */}
          <Text style={[styles.label, tc.color_text]}>{t('addSavedRoute.routeIcon')}</Text>
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
                    isSelected ? tc.backgroundColor_primaryLight : tc.backgroundColor_surface,
                    isSelected ? tc.borderColor_primary : tc.borderColor_border
                  ]}
                >
                  <Icon name={item.icon} size={22} color={isSelected ? tk.primary : tk.textSec} />
                  <Text style={[styles.iconLabel, isSelected ? tc.color_primary : tc.color_textSec]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Save Button ──────────────────────────── */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }, tc.borderTopColor_border]}>
        <Pressable onPress={handleSave} disabled={saving} accessibilityRole="button">
          <LinearGradient
            colors={[tk.primary, tk.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          >
            <Text style={styles.saveBtnText}>
              {saving ? t('addSavedRoute.saving') : t('addSavedRoute.saveRoute')}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  places: { gap: Spacing.lg, marginTop: Spacing.lg },
  root: { flex: 1 },
  flex1: { flex: 1 },

  /* Header */

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
