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

export function VerifiedBadge({ compact = false }: { compact?: boolean }) {
  const { c } = useApp();
  if (compact) return <Icon name="check-decagram" size={14} color={c.success} label="Verified driver" />;
  return (
    <View style={[styles.pill, { backgroundColor: c.successLight }]} accessible accessibilityLabel="Verified driver">
      <Icon name="check-decagram" size={14} color={c.success} />
      <Text style={[styles.text, { color: c.text }]}>Verified</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  text: { fontSize: 12, fontWeight: '700' },
});
