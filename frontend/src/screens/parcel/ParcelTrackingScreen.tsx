/**
 * screens/parcel/ParcelTrackingScreen.tsx
 *
 * Where a parcel is (UC-P04): sent, accepted, on the way, delivered. Right
 * after sending, it shows the delivery code once, to pass on to the
 * recipient. The sender can cancel with a full refund until pickup.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, Share, Linking } from 'react-native';
import { ActivityIndicator } from '../../components/Themed';
import { Text } from '../../components/Text';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Icon } from '../../components/Icon';
import { ParcelEvidence } from '../../components/ParcelEvidence';
import { parcelService, parcelStage, type Parcel } from '../../services/parcelService';
import { errorHandler } from '../../utils/errorHandler';
import type { RootStackParamList } from '../../navigation/types';
import { money } from '../../utils/region';
import { useTranslation } from 'react-i18next';

import { tc, tk } from '../../theme/themed';

const POLL_MS = 30_000;
/** Labels are in the catalogue under parcelTracking.steps */
const STEPS = ['sent', 'accepted', 'onTheWay', 'delivered'] as const;

export function ParcelTrackingScreen() {
  const { trackingNumber, deliveryCode } = useRoute<RouteProp<RootStackParamList, 'ParcelTracking'>>().params;
  const {
    user
  } = useApp();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    parcelService.track(trackingNumber).then(p => { setParcel(p); setError(''); }).catch(e => setError(errorHandler.process(e).message));
  }, [trackingNumber]);

  useFocusEffect(load);
  useEffect(() => {
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const stage = parcel ? parcelStage(parcel) : null;
  const driver = parcel && typeof parcel.driver === 'object' ? parcel.driver : null;
  const senderId = parcel && (typeof parcel.sender === 'object' ? parcel.sender._id : parcel.sender);
  const isSender = senderId === user?.id;
  const canCancel = isSender && parcel && !parcel.actualPickupTime && (parcel.status === 'pending' || parcel.status === 'confirmed');

  const shareCode = () => {
    if (!parcel || !deliveryCode) return;
    Share.share({
      message: t('parcelTracking.shareCode', { tracking: parcel.trackingNumber, code: deliveryCode }),
    }).catch(() => undefined);
  };

  const cancel = () =>
    Alert.alert(t('parcelTracking.cancelThisParcel'), t('parcelTracking.youGetAFullRefund'), [
      { text: t('parcelTracking.keepIt'), style: 'cancel' },
      {
        text: t('parcelTracking.cancelParcel'),
        style: 'destructive',
        onPress: async () => {
          if (!parcel) return;
          setCancelling(true);
          try {
            setParcel(await parcelService.cancel(parcel._id, 'Cancelled by sender'));
          } catch (e) {
            Alert.alert(t('parcelTracking.notCancelled'), errorHandler.process(e).message);
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      <ScreenHeader title={t('parcelTracking.parcel')} />
      <ScrollView contentContainerStyle={styles.content}>
        {deliveryCode ? (
          <View style={[styles.codeCard, tc.backgroundColor_primaryLight]}>
            <Text style={[{ fontSize: 14 }, tc.color_text]}>{t('parcelTracking.deliveryCodeForTheRecipient')}</Text>
            <Text style={[styles.code, tc.color_primary]} accessibilityLabel={`Delivery code ${deliveryCode.split('').join(' ')}`}>{deliveryCode}</Text>
            <Text style={[{ fontSize: 13, textAlign: 'center' }, tc.color_textSec]}>
              {t('parcelTracking.weShowItOnlyNow')}
            </Text>
            <Pressable onPress={shareCode} accessibilityRole="button" style={[styles.btn, tc.backgroundColor_primary]}>
              <Text style={[{ fontSize: 15, fontWeight: '700' }, tc.color_textOnPrimary]}>{t('parcelTracking.sendTheCode')}</Text>
            </Pressable>
          </View>
        ) : null}

        {error && !parcel ? <Text style={tc.color_error}>{error}</Text> : null}
        {!parcel ? (error ? null : <ActivityIndicator color={tk.primary} />) : (
          <>
            <View style={[
              styles.card,
              tc.backgroundColor_surfaceVariant,
              tc.borderColor_surfaceVariant
            ]}>
              <Text style={[{ fontSize: 18, fontWeight: '800' }, stage!.step < 0 ? tc.color_error : tc.color_text]} accessibilityLiveRegion="polite">
                {stage!.label}
              </Text>
              {stage!.step >= 0 ? (
                <View style={styles.steps}>
                  {STEPS.map(key => t(`parcelTracking.steps.${key}`)).map((label, i) => (
                    <View key={label} style={styles.step}>
                      <View style={[styles.dot, i <= stage!.step ? tc.backgroundColor_primary : tc.backgroundColor_border]} />
                      <Text style={[{ fontSize: 12 }, i <= stage!.step ? tc.color_text : tc.color_textSec]}>{label}</Text>
                    </View>
                  ))}
                </View>
              ) : parcel.paymentStatus === 'refunded' ? (
                <Text style={[{ fontSize: 14 }, tc.color_textSec]}>{t('parcelTracking.refunded', { amount: money(parcel.refundAmount ?? 0) })}</Text>
              ) : parcel.paymentStatus === 'refund_failed' ? (
                <Text style={[{ fontSize: 14 }, tc.color_error]}>{t('parcelTracking.refundFailed')}</Text>
              ) : null}
              <Text style={[{ fontSize: 13 }, tc.color_textSec]}>{t('parcelTracking.tracking', { tracking: parcel.trackingNumber })}</Text>
            </View>

            <View style={[
              styles.card,
              tc.backgroundColor_surfaceVariant,
              tc.borderColor_surfaceVariant
            ]}>
              <Row icon="map-marker-outline" title={parcel.pickupLocation.address} sub={t('parcelTracking.from', { name: parcel.pickupLocation.contactPerson })} />
              <Row icon="map-marker-check-outline" title={parcel.deliveryLocation.address} sub={t('parcelTracking.to', { name: parcel.deliveryLocation.contactPerson })} />
              <Row icon="weight-kilogram" title={t('parcelTracking.weightType', { weight: parcel.parcelWeight, type: t(`rideParcels.types.${parcel.parcelType}`, { defaultValue: parcel.parcelType }) })} sub={`${money(parcel.estimatedCost)}${parcel.paymentMethod === 'wallet' ? t('parcelTracking.fromWallet') : ''}`} />
              {parcel.specialInstructions ? <Row icon="note-text-outline" title={parcel.specialInstructions} /> : null}
            </View>

            {driver ? (
              <View style={[
                styles.card,
                styles.driverRow,
                tc.backgroundColor_surfaceVariant,
                tc.borderColor_surfaceVariant
              ]}>
                <Icon name="steering" size={22} color={tk.primary} />
                <Text style={[{ flex: 1, fontSize: 15, fontWeight: '600' }, tc.color_text]}>{driver.name ?? t('parcelTracking.yourDriver')}</Text>
                {driver.phone && parcel.status === 'confirmed' ? (
                  <Pressable onPress={() => Linking.openURL(`tel:${driver.phone}`)} accessibilityRole="button" accessibilityLabel={t('parcelTracking.call', { name: driver.name ?? t('parcelTracking.theDriver') })} style={[styles.call, tc.backgroundColor_primaryLight]}>
                    <Icon name="phone" size={18} color={tk.primary} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {isSender ? <ParcelEvidence parcel={parcel} /> : null}
            {canCancel ? (
              <Pressable onPress={cancel} disabled={cancelling} accessibilityRole="button" style={[styles.btn, tc.backgroundColor_errorLight]}>
                {cancelling ? <ActivityIndicator color={tk.error} /> : <Text style={[{ fontSize: 15, fontWeight: '700' }, tc.color_error]}>{t('parcelTracking.cancelParcel')}</Text>}
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );

  function Row({ icon, title, sub }: { icon: React.ComponentProps<typeof Icon>['name']; title: string; sub?: string }) {
    return (
      <View style={styles.row}>
        <Icon name={icon} size={20} color={tk.textSec} />
        <View style={{ flex: 1 }}>
          <Text style={[{ fontSize: 14 }, tc.color_text]}>{title}</Text>
          {sub ? <Text style={[{ fontSize: 12 }, tc.color_textSec]}>{sub}</Text> : null}
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  codeCard: { borderRadius: 16, padding: 16, gap: 8, alignItems: 'center' },
  code: { fontSize: 36, fontWeight: '800', letterSpacing: 8 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  steps: { flexDirection: 'row', justifyContent: 'space-between' },
  step: { alignItems: 'center', gap: 4, flex: 1 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  driverRow: { flexDirection: 'row', alignItems: 'center' },
  call: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  btn: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', paddingHorizontal: 16 },
});
