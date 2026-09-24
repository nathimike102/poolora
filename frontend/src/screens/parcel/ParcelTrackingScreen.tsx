/**
 * screens/parcel/ParcelTrackingScreen.tsx
 *
 * Where a parcel is (UC-P04): sent, accepted, on the way, delivered. Right
 * after sending, it shows the delivery code once, to pass on to the
 * recipient. The sender can cancel with a full refund until pickup.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Share, Linking } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { BackButton } from '../../components/BackButton';
import { Icon } from '../../components/Icon';
import { parcelService, parcelStage, type Parcel } from '../../services/parcelService';
import { errorHandler } from '../../utils/errorHandler';
import type { RootStackParamList } from '../../navigation/types';

const POLL_MS = 30_000;
const STEPS = ['Sent', 'Accepted', 'On the way', 'Delivered'];

export function ParcelTrackingScreen() {
  const { trackingNumber, deliveryCode } = useRoute<RouteProp<RootStackParamList, 'ParcelTracking'>>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { c, user } = useApp();
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
      message: `A Poolora parcel is on its way to you (tracking ${parcel.trackingNumber}). Give the driver this delivery code when it arrives: ${deliveryCode}`,
    }).catch(() => undefined);
  };

  const cancel = () =>
    Alert.alert('Cancel this parcel?', 'You get a full refund, to your wallet or card.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel parcel',
        style: 'destructive',
        onPress: async () => {
          if (!parcel) return;
          setCancelling(true);
          try {
            setParcel(await parcelService.cancel(parcel._id, 'Cancelled by sender'));
          } catch (e) {
            Alert.alert('Not cancelled', errorHandler.process(e).message);
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">Parcel</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {deliveryCode ? (
          <View style={[styles.codeCard, { backgroundColor: c.primaryLight }]}>
            <Text style={{ fontSize: 14, color: c.text }}>Delivery code for the recipient</Text>
            <Text style={[styles.code, { color: c.primary }]} accessibilityLabel={`Delivery code ${deliveryCode.split('').join(' ')}`}>{deliveryCode}</Text>
            <Text style={{ fontSize: 13, color: c.textSec, textAlign: 'center' }}>
              We show it only now. Send it to the recipient; the driver needs it to hand the parcel over.
            </Text>
            <Pressable onPress={shareCode} accessibilityRole="button" style={[styles.btn, { backgroundColor: c.primary }]}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: c.textOnPrimary }}>Send the code</Text>
            </Pressable>
          </View>
        ) : null}

        {error && !parcel ? <Text style={{ color: c.error }}>{error}</Text> : null}
        {!parcel ? (error ? null : <ActivityIndicator color={c.primary} />) : (
          <>
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: stage!.step < 0 ? c.error : c.text }} accessibilityLiveRegion="polite">
                {stage!.label}
              </Text>
              {stage!.step >= 0 ? (
                <View style={styles.steps}>
                  {STEPS.map((label, i) => (
                    <View key={label} style={styles.step}>
                      <View style={[styles.dot, { backgroundColor: i <= stage!.step ? c.primary : c.border }]} />
                      <Text style={{ fontSize: 12, color: i <= stage!.step ? c.text : c.textSec }}>{label}</Text>
                    </View>
                  ))}
                </View>
              ) : parcel.paymentStatus === 'refunded' ? (
                <Text style={{ fontSize: 14, color: c.textSec }}>₹{parcel.refundAmount} refunded{parcel.paymentMethod === 'wallet' ? ' to your wallet' : ' to your card; banks take 5 to 7 working days'}.</Text>
              ) : parcel.paymentStatus === 'refund_failed' ? (
                <Text style={{ fontSize: 14, color: c.error }}>We could not refund this automatically. Our team will refund you; contact support if it has not arrived in a week.</Text>
              ) : null}
              <Text style={{ fontSize: 13, color: c.textSec }}>Tracking {parcel.trackingNumber}</Text>
            </View>

            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Row icon="map-marker-outline" title={parcel.pickupLocation.address} sub={`From ${parcel.pickupLocation.contactPerson}`} />
              <Row icon="map-marker-check-outline" title={parcel.deliveryLocation.address} sub={`To ${parcel.deliveryLocation.contactPerson}`} />
              <Row icon="weight-kilogram" title={`${parcel.parcelWeight} kg, ${parcel.parcelType}`} sub={`₹${parcel.estimatedCost}${parcel.paymentMethod === 'wallet' ? ' from wallet' : ''}`} />
              {parcel.specialInstructions ? <Row icon="note-text-outline" title={parcel.specialInstructions} /> : null}
            </View>

            {driver ? (
              <View style={[styles.card, styles.driverRow, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Icon name="steering" size={22} color={c.primary} />
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: c.text }}>{driver.name ?? 'Your driver'}</Text>
                {driver.phone && parcel.status === 'confirmed' ? (
                  <Pressable onPress={() => Linking.openURL(`tel:${driver.phone}`)} accessibilityRole="button" accessibilityLabel={`Call ${driver.name ?? 'the driver'}`} style={[styles.call, { backgroundColor: c.primaryLight }]}>
                    <Icon name="phone" size={18} color={c.primary} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {canCancel ? (
              <Pressable onPress={cancel} disabled={cancelling} accessibilityRole="button" style={[styles.btn, { backgroundColor: c.errorLight }]}>
                {cancelling ? <ActivityIndicator color={c.error} /> : <Text style={{ fontSize: 15, fontWeight: '700', color: c.error }}>Cancel parcel</Text>}
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
        <Icon name={icon} size={20} color={c.textSec} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, color: c.text }}>{title}</Text>
          {sub ? <Text style={{ fontSize: 12, color: c.textSec }}>{sub}</Text> : null}
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
