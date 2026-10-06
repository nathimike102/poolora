/**
 * screens/rider/ReceiptsScreen.tsx
 *
 * Every receipt the rider has, newest first. Receipts are kept in the app
 * rather than emailed after each trip, so a regular rider's inbox does not
 * fill up; any one of them can still be emailed or shared from its page.
 */

import React, { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import { ActivityIndicator } from '../../components/Themed';
import { Text } from '../../components/Text';
import { EmptyState } from '../../components/EmptyState';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ScreenHeader } from '../../components/ScreenHeader';
import { Icon3D } from '../../components/Icon3D';
import { Icon } from '../../components/Icon';
import type { RootStackParamList } from '../../navigation/types';
import type { Booking } from '../../types/api';
import { bookingService } from '../../services/bookingService';
import { riderPays } from '../../utils/fares';
import { money, REGION } from '../../utils/region';
import { logger } from '../../utils/logger';
import { tc, tk } from '../../theme/themed';

interface ReceiptItem {
  id: string;
  to: string;
  departure: Date | null;
  paid: number;
  status: Booking['status'];
}

/** A seat that was confirmed and paid for at some point has a receipt */
export function hasReceipt(b: Booking): boolean {
  return b.status === 'completed' || (b.status === 'cancelled' && riderPays(b) > 0);
}

function toItem(b: Booking): ReceiptItem {
  const ride = b.ride as unknown as { departureTime?: string } | undefined;
  return {
    id: b._id,
    to: (b.dropoff?.address ?? '').split(',')[0].trim(),
    departure: ride?.departureTime ? new Date(ride.departureTime) : null,
    paid: riderPays(b) - (b.refundAmount ?? 0),
    status: b.status,
  };
}

export function ReceiptsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ReceiptItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      bookingService
        .getRiderBookings(1, 100)
        .then((res) => {
          if (!active) return;
          setItems(
            (res.data?.items ?? [])
              .filter(hasReceipt)
              .map(toItem)
              .sort((a, b) => (b.departure?.getTime() ?? 0) - (a.departure?.getTime() ?? 0)),
          );
          setFailed(false);
        })
        .catch((error) => {
          logger.error('Failed to load receipts', { error });
          if (active) setFailed(true);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const renderItem = ({ item }: { item: ReceiptItem }) => {
    const when = item.departure
      ? item.departure.toLocaleDateString(REGION.dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })
      : '';
    const status = item.status === 'completed' ? t('receipt.status.completed') : t('receipt.status.cancelled');
    return (
      <Pressable
        onPress={() => navigation.navigate('Receipt', { bookingId: item.id })}
        accessibilityRole="button"
        accessibilityLabel={t('receipts.itemLabel', { place: item.to || t('myRides.dropPoint'), when, amount: money(item.paid), status })}
        style={({ pressed }) => [
          styles.row,
          pressed ? tc.backgroundColor_surfaceVariant : tc.backgroundColor_surface,
          tc.borderColor_border
        ]}
      >
        <Icon3D name="receipt" size={40} />
        <View style={styles.flex1}>
          <Text style={[styles.place, tc.color_text]} numberOfLines={1}>{item.to || t('myRides.dropPoint')}</Text>
          <Text style={[styles.meta, tc.color_textSec]}>{when} · {status}</Text>
        </View>
        <Text style={[styles.amount, tc.color_text]}>{money(item.paid)}</Text>
        <Icon name="chevron-right" size={20} color={tk.textSec} />
      </Pressable>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      <ScreenHeader title={t('receipts.title')} />
      {items === null ? (
        <View style={styles.center}>
          {failed ? (
            <Text style={[styles.empty, tc.color_textSec]}>{t('receipts.loadFailed')}</Text>
          ) : (
            <ActivityIndicator color={tk.primary} accessibilityLabel={t('receipts.loading')} />
          )}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ListHeaderComponent={<Text style={[styles.note, tc.color_textSec]}>{t('receipts.keptHere')}</Text>}
          ListEmptyComponent={<EmptyState icon="receipt" title={t('receipts.noneTitle')} body={t('receipts.none')} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  list: { padding: 20, gap: 10 },
  note: { fontSize: 13, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  flex1: { flex: 1 },
  place: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 13, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700' },
  empty: { fontSize: 14, textAlign: 'center', padding: 24 },
});
