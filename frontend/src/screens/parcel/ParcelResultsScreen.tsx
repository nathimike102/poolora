/**
 * screens/parcel/ParcelResultsScreen.tsx
 *
 * Rides that pass the parcel's pickup and then its drop (UC-P02), with the
 * price. Choosing one sends the request to that driver: the wallet pays at
 * once, or the card payment screen opens.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { ActivityIndicator } from '../../components/Themed';
import { Text } from '../../components/Text';
import { EmptyState } from '../../components/EmptyState';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import { Icon } from '../../components/Icon';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import { rideService } from '../../services/rideService';
import { parcelService } from '../../services/parcelService';
import { errorHandler } from '../../utils/errorHandler';
import type { RootStackParamList } from '../../navigation/types';
import type { Ride } from '../../types/api';
import { money, REGION } from '../../utils/region';
import { useTranslation } from 'react-i18next';
import { tc, tk } from '../../theme/themed';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function when(iso: string) {
  return new Date(iso).toLocaleString(REGION.dateLocale, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function ParcelResultsScreen() {
  const { draft } = useRoute<RouteProp<RootStackParamList, 'ParcelResults'>>().params;
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [rides, setRides] = useState<Ride[] | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const { pickupLocation: from, deliveryLocation: to } = draft;
    rideService
      .searchRides({ pickupLat: from.lat, pickupLng: from.lng, dropoffLat: to.lat, dropoffLng: to.lng, departureTime: draft.departureTime, timeDeviationMins: 180 })
      .then(res => {
        if (!active) return;
        const found = res.data.items.length ? res.data.items : res.data.alternatives?.items ?? [];
        setRides(found);
      })
      .catch(e => active && setError(errorHandler.process(e).message));
    parcelService.quote(from, to, draft.parcelWeight).then(q => active && setPrice(q.total)).catch(() => undefined);
    return () => { active = false; };
  }, [draft]);

  const send = (ride: Ride) => {
    const driver = ride.driver?.name?.split(' ')[0] ?? t('parcelResults.theDriver');
    Alert.alert(
      t('parcelResults.confirmTitle', { driver }),
      t(draft.useWallet ? 'parcelResults.confirmWallet' : 'parcelResults.confirmOnline', { price: price !== null ? `${money(price)} ` : '', driver }),
      [
        { text: t('parcelResults.cancel'), style: 'cancel' },
        {
          text: t('parcelResults.send'),
          onPress: async () => {
            setSending(ride._id);
            try {
              const result = await parcelService.create({
                rideId: ride._id,
                parcelWeight: draft.parcelWeight,
                parcelType: draft.parcelType,
                pickupLocation: draft.pickupLocation,
                deliveryLocation: draft.deliveryLocation,
                estimatedDeliveryTime: ride.estimatedArrival ?? new Date(new Date(ride.scheduledDeparture).getTime() + 4 * 3_600_000).toISOString(),
                specialInstructions: draft.specialInstructions,
                useWallet: draft.useWallet,
              });
              const tracking = { trackingNumber: result.parcel.trackingNumber, deliveryCode: result.deliveryOtp };
              if (result.parcel.paymentMethod === 'online') {
                // Pay online first; the tracking screen is underneath once paid
                navigation.replace('ParcelTracking', tracking);
                navigation.navigate('Payment', {
                  parcelId: result.parcel._id,
                  amount: result.parcel.estimatedCost,
                  summary: `Parcel to ${draft.deliveryLocation.contactPerson}, ${draft.deliveryLocation.address.split(',')[0]}`,
                });
              } else {
                navigation.replace('ParcelTracking', tracking);
              }
            } catch (e) {
              Alert.alert(t('parcelResults.notSent'), errorHandler.process(e).message);
            } finally {
              setSending(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      <ScreenHeader
        title={t('parcelResults.chooseADriver')}
        subtitle={`${draft.pickupLocation.address.split(',')[0]} to ${draft.deliveryLocation.address.split(',')[0]}${price !== null ? ` · ${money(price)}` : ''}`}
      />
      {error ? (
        <Text style={[{ padding: 20 }, tc.color_error]}>{error}</Text>
      ) : rides === null ? (
        <ActivityIndicator color={tk.primary} style={{ padding: 32 }} />
      ) : (
        <FlatList
          data={rides}
          keyExtractor={r => r._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState icon="package" title={t('parcelResults.noDriversOnThisRoute')} body={t('parcelResults.tryAnotherDayOrTime')} />
          }
          renderItem={({ item: r }) => (
            <Pressable
              onPress={() => send(r)}
              disabled={sending !== null}
              accessibilityRole="button"
              accessibilityLabel={t('parcelResults.sendLabel', { driver: r.driver?.name ?? t('parcelResults.driverLower'), when: when(r.scheduledDeparture) })}
              style={[
                styles.card,
                tc.backgroundColor_surfaceVariant,
                tc.borderColor_surfaceVariant
              ]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.nameRow}>
                  <Text style={[{ fontSize: 15, fontWeight: '700' }, tc.color_text]}>{r.driver?.name ?? t('parcelResults.driver')}</Text>
                  {r.driver?.verified ? <VerifiedBadge compact /> : null}
                </View>
                <Text style={[{ fontSize: 13 }, tc.color_textSec]}>{t('parcelResults.leaves', { when: when(r.scheduledDeparture) })}</Text>
                <Text style={[{ fontSize: 13 }, tc.color_textSec]} numberOfLines={1}>
                  {t('parcelResults.route', { from: r.pickupLocation.address?.split(',')[0], to: r.dropoffLocation.address?.split(',')[0] })}
                  {r.vehicle ? ` · ${r.vehicle.make} ${r.vehicle.model}` : ''}
                </Text>
              </View>
              {sending === r._id ? <ActivityIndicator color={tk.primary} /> : <Icon name="chevron-right" size={22} color={tk.textSec} />}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  list: { padding: 16, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  empty: { alignItems: 'center', gap: 8, padding: 32 },
});
