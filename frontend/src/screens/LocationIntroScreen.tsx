/**
 * screens/LocationIntroScreen.tsx
 *
 * Asked once, before sign-in: why Siham wants the phone's location, then
 * Android's own question. The location sets the country's calling code at
 * sign-in and tells whether rides are open here. "Not now" goes on without
 * it; the phone's region setting stands in.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { EmptyArt } from '../components/EmptyState';
import { GradientButton } from '../components/GradientButton';
import { Text } from '../components/Text';
import { detectCountry } from '../services/locationCountry';
import type { RootStackParamList } from '../navigation/types';
import { Spacing, Typography } from '../theme';
import { tc, tk } from '../theme/themed';

/** Set once the question has been asked, so it is not asked on every start */
export const LOCATION_ASKED_KEY = '@siham_location_asked';

type Nav = NativeStackNavigationProp<RootStackParamList, 'LocationIntro'>;

export function LocationIntroScreen() {
  const navigation = useNavigation<Nav>();
  const { next } = useRoute<RouteProp<RootStackParamList, 'LocationIntro'>>().params;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [asking, setAsking] = useState(false);

  const done = () => {
    AsyncStorage.setItem(LOCATION_ASKED_KEY, '1').catch(() => undefined);
    detectCountry();
    navigation.replace(next);
  };

  const allow = async () => {
    if (asking) return;
    setAsking(true);
    try {
      await Location.requestForegroundPermissionsAsync();
    } catch {
      // Refused or unavailable: the region setting stands in
    }
    done();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing['3xl'], paddingBottom: insets.bottom + Spacing.xl }, tc.backgroundColor_surface]}>
      <View style={styles.body}>
        <EmptyArt icon="roundPushpin" />
        <Text style={[styles.title, tc.color_text]} accessibilityRole="header">{t('locationIntro.title')}</Text>
        <Text style={[styles.text, tc.color_textSec]}>{t('locationIntro.body')}</Text>
      </View>
      <GradientButton
        label={t('locationIntro.allow')}
        onPress={allow}
        loading={asking}
        disabled={asking}
        colorStart={tk.primary}
        colorEnd={tk.primaryDark}
      />
      <Pressable onPress={done} accessibilityRole="button" style={styles.later} disabled={asking}>
        <Text style={[styles.laterText, tc.color_textSec]}>{t('locationIntro.notNow')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.xl },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: Typography['3xl'], fontWeight: Typography.bold, textAlign: 'center' },
  text: { fontSize: Typography.lg, textAlign: 'center', marginTop: Spacing.md, lineHeight: 23 },
  later: { alignItems: 'center', paddingVertical: Spacing.lg, marginTop: Spacing.sm },
  laterText: { fontSize: Typography.lg, fontWeight: Typography.semibold },
});
