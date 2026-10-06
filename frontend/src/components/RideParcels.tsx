/**
 * components/RideParcels.tsx
 *
 * Parcels on a driver's ride (UC-P02 to UC-P04): accept or decline a paid
 * request, mark it picked up, and hand it over with the recipient's code.
 * Nothing is shown when the ride has no parcels.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, Alert, Modal, Linking } from 'react-native';
import { ActivityIndicator } from './Themed';
import { Text, TextInput } from './Text';

import { Icon } from './Icon';
import { parcelService, parcelStage, type Parcel } from '../services/parcelService';
import { errorHandler } from '../utils/errorHandler';
import { takeParcelPhoto } from '../utils/parcelPhoto';
import { money } from '../utils/region';
import { useTranslation } from 'react-i18next';
import { tc, tk } from '../theme/themed';

export function RideParcels({ rideId }: { rideId: string }) {
  const { t } = useTranslation();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [delivering, setDelivering] = useState<Parcel | null>(null);
  const [code, setCode] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  /** The handover photo is taken before the code is confirmed (UC-P03) */
  const [handoverPhoto, setHandoverPhoto] = useState(false);

  const load = useCallback(() => {
    parcelService.list('driver', rideId).then(setParcels).catch(() => undefined);
  }, [rideId]);
  useEffect(load, [load]);

  const act = async (p: Parcel, fn: () => Promise<Parcel>) => {
    setBusy(p._id);
    try {
      const updated = await fn();
      setParcels(list => list.map(x => (x._id === p._id ? { ...x, ...updated, ride: x.ride } : x)));
      return true;
    } catch (e) {
      Alert.alert(t('rideParcels.thatDidNotWork'), errorHandler.process(e).message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const decline = (p: Parcel) =>
    Alert.alert(t('rideParcels.declineThisParcel'), t('rideParcels.theSenderIsRefundedIn'), [
      { text: t('rideParcels.keepIt'), style: 'cancel' },
      { text: t('rideParcels.decline'), style: 'destructive', onPress: () => act(p, () => parcelService.reject(p._id)) },
    ]);

  /** Photo of the parcel first, then the pickup (UC-P03) */
  const pickUp = async (p: Parcel) => {
    setBusy(p._id);
    const photo = await takeParcelPhoto(p._id, 'pickup');
    setBusy(null);
    if (photo) await act(p, () => parcelService.pickup(p._id));
  };

  const photographHandover = async () => {
    if (!delivering) return;
    setBusy(delivering._id);
    const photo = await takeParcelPhoto(delivering._id, 'delivery');
    setBusy(null);
    if (photo) setHandoverPhoto(true);
  };

  const deliver = async () => {
    if (!delivering) return;
    const ok = await act(delivering, () => parcelService.deliver(delivering._id, code.trim(), receivedBy.trim()));
    if (ok) {
      setDelivering(null);
      setCode('');
      setReceivedBy('');
      setHandoverPhoto(false);
    }
  };

  const shown = parcels.filter(p => p.status !== 'cancelled');
  if (shown.length === 0) return null;

  return (
    <View style={[styles.card, tc.backgroundColor_surface, tc.borderColor_border]}>
      <Text style={[styles.title, tc.color_textSec]}>{t('rideParcels.parcels')}</Text>
      {shown.map((p, i) => {
        const stage = parcelStage(p);
        const pending = p.status === 'pending';
        const toPickUp = p.status === 'confirmed' && !p.actualPickupTime;
        const toDeliver = p.status === 'confirmed' && Boolean(p.actualPickupTime);
        return (
          <View key={p._id} style={[styles.item, i > 0 && [{ borderTopWidth: 1 }, tc.borderTopColor_border]]}>
            <View style={styles.itemHead}>
              <Icon name="package-variant-closed" size={20} color={tk.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[{ fontSize: 14, fontWeight: '700' }, tc.color_text]}>
                  {t('rideParcels.summary', { weight: p.parcelWeight, type: t(`rideParcels.types.${p.parcelType}`, { defaultValue: p.parcelType }), amount: money(p.driverEarnings ?? Math.round(p.estimatedCost * 0.7)) })}
                </Text>
                <Text style={[{ fontSize: 12 }, tc.color_textSec]}>{stage.label}</Text>
              </View>
            </View>
            <Text style={[{ fontSize: 13 }, tc.color_text]}>
              From {p.pickupLocation.contactPerson}, {p.pickupLocation.address.split(',')[0]}
            </Text>
            <Text style={[{ fontSize: 13 }, tc.color_text]}>
              To {p.deliveryLocation.contactPerson}, {p.deliveryLocation.address.split(',')[0]}
            </Text>
            {p.specialInstructions ? <Text style={[{ fontSize: 13, fontStyle: 'italic' }, tc.color_textSec]}>“{p.specialInstructions}”</Text> : null}
            {busy === p._id ? <ActivityIndicator color={tk.primary} /> : (
              <View style={styles.actions}>
                {pending ? (
                  <>
                    <Pressable onPress={() => act(p, () => parcelService.accept(p._id))} accessibilityRole="button" style={[styles.btn, tc.backgroundColor_primary]}>
                      <Text style={[{ fontWeight: '700' }, tc.color_textOnPrimary]}>{t('rideParcels.accept')}</Text>
                    </Pressable>
                    <Pressable onPress={() => decline(p)} accessibilityRole="button" style={[styles.btn, { borderWidth: 1 }, tc.borderColor_border]}>
                      <Text style={[{ fontWeight: '600' }, tc.color_text]}>{t('rideParcels.decline')}</Text>
                    </Pressable>
                  </>
                ) : null}
                {toPickUp ? (
                  <>
                    <Pressable onPress={() => Linking.openURL(`tel:${p.pickupLocation.contactPhone}`)} accessibilityRole="button" accessibilityLabel={t('rideParcels.call', { name: p.pickupLocation.contactPerson })} style={[styles.btn, { borderWidth: 1 }, tc.borderColor_border]}>
                      <Icon name="phone" size={16} color={tk.text} />
                    </Pressable>
                    <Pressable onPress={() => pickUp(p)} disabled={busy !== null} accessibilityRole="button" accessibilityHint={t('rideParcels.opensTheCameraToPhotograph')} style={[styles.btn, tc.backgroundColor_primary]}>
                      {busy === p._id ? <ActivityIndicator color={tk.textOnPrimary} /> : <Text style={[{ fontWeight: '700' }, tc.color_textOnPrimary]}>{t('rideParcels.photoAndPickUp')}</Text>}
                    </Pressable>
                  </>
                ) : null}
                {toDeliver ? (
                  <>
                    <Pressable onPress={() => Linking.openURL(`tel:${p.deliveryLocation.contactPhone}`)} accessibilityRole="button" accessibilityLabel={t('rideParcels.call', { name: p.deliveryLocation.contactPerson })} style={[styles.btn, { borderWidth: 1 }, tc.borderColor_border]}>
                      <Icon name="phone" size={16} color={tk.text} />
                    </Pressable>
                    <Pressable onPress={() => { setReceivedBy(p.deliveryLocation.contactPerson); setDelivering(p); }} accessibilityRole="button" style={[styles.btn, tc.backgroundColor_primary]}>
                      <Text style={[{ fontWeight: '700' }, tc.color_textOnPrimary]}>{t('rideParcels.handOver')}</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            )}
          </View>
        );
      })}

      <Modal visible={delivering !== null} transparent animationType="slide" onRequestClose={() => setDelivering(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, tc.backgroundColor_surface]}>
            <Text style={[{ fontSize: 18, fontWeight: '700' }, tc.color_text]} accessibilityRole="header">{t('rideParcels.handOverTheParcel')}</Text>
            <Text style={[{ fontSize: 14 }, tc.color_textSec]}>{t('rideParcels.photographTheParcelWithThe')}</Text>
            <Pressable onPress={photographHandover} disabled={busy !== null} accessibilityRole="button" style={[
              styles.btn,
              { borderWidth: 1 },
              handoverPhoto ? tc.borderColor_success : tc.borderColor_primary
            ]}>
              <Text style={[{ fontWeight: '700' }, handoverPhoto ? tc.color_success : tc.color_primary]}>{handoverPhoto ? t('rideParcels.photoTaken') : t('rideParcels.takeTheHandoverPhoto')}</Text>
            </Pressable>
            <TextInput
              value={code}
              onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder={t('rideParcels.deliveryCode')}
              placeholderTextColor={tk.textSec}
              accessibilityLabel={t('rideParcels.deliveryCode')}
              style={[
                styles.input,
                styles.codeInput,
                tc.borderColor_border,
                tc.color_text,
                tc.backgroundColor_surface
              ]}
            />
            <TextInput
              value={receivedBy}
              onChangeText={setReceivedBy}
              placeholder={t('rideParcels.receivedBy')}
              placeholderTextColor={tk.textSec}
              accessibilityLabel={t('rideParcels.nameOfThePersonReceiving')}
              style={[
                styles.input,
                tc.borderColor_border,
                tc.color_text,
                tc.backgroundColor_surface
              ]}
            />
            <View style={styles.actions}>
              <Pressable onPress={() => { setDelivering(null); setHandoverPhoto(false); }} accessibilityRole="button" style={[styles.btn, styles.grow, { borderWidth: 1 }, tc.borderColor_border]}>
                <Text style={tc.color_text}>{t('rideParcels.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={deliver}
                disabled={!handoverPhoto || code.length !== 6 || receivedBy.trim().length < 2 || busy !== null}
                accessibilityRole="button"
                style={[styles.btn, styles.grow, handoverPhoto && code.length === 6 && receivedBy.trim().length >= 2 ? tc.backgroundColor_primary : tc.backgroundColor_border]}
              >
                {busy ? <ActivityIndicator color={tk.textOnPrimary} /> : <Text style={[{ fontWeight: '700' }, tc.color_textOnPrimary]}>{t('rideParcels.confirmDelivery')}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  title: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  item: { paddingVertical: 12, gap: 4 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  btn: { minHeight: 44, minWidth: 44, borderRadius: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12, paddingBottom: 32 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 },
  codeInput: { fontSize: 22, letterSpacing: 6, textAlign: 'center' },
});
