/**
 * screens/shared/GuideScreen.tsx
 *
 * How to use the app, step by step: booking a ride, sending a parcel, a group
 * trip, offering a ride, and staying safe. Shown once after a new account's
 * first sign-in, and from Help at any time. The steps name the buttons as
 * they appear on screen.
 */

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { GradientButton } from '../../components/GradientButton';
import { Icon3D, type Icon3DName } from '../../components/Icon3D';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Text } from '../../components/Text';
import { Radius, Spacing, Typography } from '../../theme';
import { tc, tk } from '../../theme/themed';

/** Set once the guide has been seen, so it opens by itself only once */
export const GUIDE_SEEN_KEY = '@poolora_guide_seen';

const TOPICS: { key: string; icon: Icon3DName; steps: number }[] = [
  { key: 'ride', icon: 'automobile', steps: 4 },
  { key: 'parcel', icon: 'package', steps: 4 },
  { key: 'trip', icon: 'handshake', steps: 3 },
  { key: 'drive', icon: 'moneyBag', steps: 4 },
  { key: 'safety', icon: 'shield', steps: 4 },
];

export function GuideScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const done = () => {
    AsyncStorage.setItem(GUIDE_SEEN_KEY, '1').catch(() => undefined);
    navigation.goBack();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      <ScreenHeader title={t('guide.title')} subtitle={t('guide.subtitle')} onBack={done} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + Spacing['2xl'] }]} showsVerticalScrollIndicator={false}>
        {TOPICS.map(topic => (
          <View key={topic.key} style={[styles.card, tc.backgroundColor_surfaceVariant, tc.cardOutline]}>
            <View style={styles.cardHead}>
              <Icon3D name={topic.icon} size={40} />
              <Text style={[styles.cardTitle, tc.color_text]} accessibilityRole="header">{t(`guide.${topic.key}.title`)}</Text>
            </View>
            {Array.from({ length: topic.steps }, (_, i) => (
              <View key={i} style={styles.step}>
                <View style={[styles.stepNumber, tc.backgroundColor_primary]}>
                  <Text style={[styles.stepNumberText, tc.color_textOnPrimary]}>{i + 1}</Text>
                </View>
                <Text style={[styles.stepText, tc.color_text]}>{t(`guide.${topic.key}.step${i + 1}`)}</Text>
              </View>
            ))}
          </View>
        ))}
        <GradientButton label={t('guide.gotIt')} onPress={done} colorStart={tk.primary} colorEnd={tk.primaryDark} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.lg },
  card: { borderRadius: Radius['2xl'], padding: Spacing.lg, gap: Spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cardTitle: { flex: 1, fontSize: Typography['2xl'], fontWeight: Typography.bold },
  step: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  stepNumber: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumberText: { fontSize: Typography.md, fontWeight: Typography.bold },
  stepText: { flex: 1, fontSize: Typography.lg, lineHeight: 22 },
});
