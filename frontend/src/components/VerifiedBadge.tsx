/**
 * components/VerifiedBadge.tsx
 *
 * The Verified Driver badge (UC-D10): papers checked, 20+ trips, rated 4.7+,
 * few cancellations and a clean record. Shown next to the driver's name.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { useApp } from '../context/AppContext';
import { Icon } from './Icon';
import { useTranslation } from 'react-i18next';

export function VerifiedBadge({ compact = false }: { compact?: boolean }) {
  const { c } = useApp();
  const { t } = useTranslation();
  if (compact) return <Icon name="check-decagram" size={14} color={c.success} label={t('verifiedBadge.verifiedDriver')} />;
  return (
    <View style={[styles.pill, { backgroundColor: c.successLight }]} accessible accessibilityLabel={t('verifiedBadge.verifiedDriver')}>
      <Icon name="check-decagram" size={14} color={c.success} />
      <Text style={[styles.text, { color: c.text }]}>{t('verifiedBadge.verified')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  text: { fontSize: 12, fontWeight: '700' },
});
