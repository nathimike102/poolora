/**
 * components/RideParcels.tsx
 *
 * Parcels on a driver's ride (UC-P02 to UC-P04): accept or decline a paid
 * request, mark it picked up, and hand it over with the recipient's code.
 * Nothing is shown when the ride has no parcels.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Modal, TextInput, ActivityIndicator, Linking } from 'react-native';

import { useApp } from '../context/AppContext';
import { Icon } from './Icon';
import { parcelService, parcelStage, type Parcel } from '../services/parcelService';
import { errorHandler } from '../utils/errorHandler';
import { takeParcelPhoto } from '../utils/parcelPhoto';

export function RideParcels({ rideId }: { rideId: string }) {
  const { c } = useApp();
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
      Alert.alert('That did not work', errorHandler.process(e).message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const decline = (p: Parcel) =>
    Alert.alert('Decline this parcel?', 'The sender is refunded in full.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: () => act(p, () => parcelService.reject(p._id)) },
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
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.title, { color: c.textSec }]}>Parcels</Text>
      {shown.map((p, i) => {
        const stage = parcelStage(p);
        const pending = p.status === 'pending';
        const toPickUp = p.status === 'confirmed' && !p.actualPickupTime;
        const toDeliver = p.status === 'confirmed' && Boolean(p.actualPickupTime);
        return (
          <View key={p._id} style={[styles.item, i > 0 && { borderTopWidth: 1, borderTopColor: c.border }]}>
            <View style={styles.itemHead}>
              <Icon name="package-variant-closed" size={20} color={c.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>
                  {p.parcelWeight} kg {p.parcelType} · ₹{p.driverEarnings ?? Math.round(p.estimatedCost * 0.7)} for you
                </Text>
                <Text style={{ fontSize: 12, color: c.textSec }}>{stage.label}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 13, color: c.text }}>
              From {p.pickupLocation.contactPerson}, {p.pickupLocation.address.split(',')[0]}
            </Text>
            <Text style={{ fontSize: 13, color: c.text }}>
              To {p.deliveryLocation.contactPerson}, {p.deliveryLocation.address.split(',')[0]}
            </Text>
            {p.specialInstructions ? <Text style={{ fontSize: 13, color: c.textSec, fontStyle: 'italic' }}>“{p.specialInstructions}”</Text> : null}
            {busy === p._id ? <ActivityIndicator color={c.primary} /> : (
              <View style={styles.actions}>
                {pending ? (
                  <>
                    <Pressable onPress={() => act(p, () => parcelService.accept(p._id))} accessibilityRole="button" style={[styles.btn, { backgroundColor: c.primary }]}>
                      <Text style={{ fontWeight: '700', color: c.textOnPrimary }}>Accept</Text>
                    </Pressable>
                    <Pressable onPress={() => decline(p)} accessibilityRole="button" style={[styles.btn, { borderWidth: 1, borderColor: c.border }]}>
                      <Text style={{ fontWeight: '600', color: c.text }}>Decline</Text>
                    </Pressable>
                  </>
                ) : null}
                {toPickUp ? (
                  <>
                    <Pressable onPress={() => Linking.openURL(`tel:${p.pickupLocation.contactPhone}`)} accessibilityRole="button" accessibilityLabel={`Call ${p.pickupLocation.contactPerson}`} style={[styles.btn, { borderWidth: 1, borderColor: c.border }]}>
                      <Icon name="phone" size={16} color={c.text} />
                    </Pressable>
                    <Pressable onPress={() => pickUp(p)} disabled={busy !== null} accessibilityRole="button" accessibilityHint="Opens the camera to photograph the parcel, then marks it picked up" style={[styles.btn, { backgroundColor: c.primary }]}>
                      {busy === p._id ? <ActivityIndicator color={c.textOnPrimary} /> : <Text style={{ fontWeight: '700', color: c.textOnPrimary }}>Photo and pick up</Text>}
                    </Pressable>
                  </>
                ) : null}
                {toDeliver ? (
                  <>
                    <Pressable onPress={() => Linking.openURL(`tel:${p.deliveryLocation.contactPhone}`)} accessibilityRole="button" accessibilityLabel={`Call ${p.deliveryLocation.contactPerson}`} style={[styles.btn, { borderWidth: 1, borderColor: c.border }]}>
                      <Icon name="phone" size={16} color={c.text} />
                    </Pressable>
                    <Pressable onPress={() => { setReceivedBy(p.deliveryLocation.contactPerson); setDelivering(p); }} accessibilityRole="button" style={[styles.btn, { backgroundColor: c.primary }]}>
                      <Text style={{ fontWeight: '700', color: c.textOnPrimary }}>Hand over</Text>
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
          <View style={[styles.sheet, { backgroundColor: c.surface }]}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }} accessibilityRole="header">Hand over the parcel</Text>
            <Text style={{ fontSize: 14, color: c.textSec }}>Photograph the parcel with the recipient, then ask them for the 6-digit delivery code the sender gave them.</Text>
            <Pressable onPress={photographHandover} disabled={busy !== null} accessibilityRole="button" style={[styles.btn, { borderWidth: 1, borderColor: handoverPhoto ? c.success : c.primary }]}>
              <Text style={{ fontWeight: '700', color: handoverPhoto ? c.success : c.primary }}>{handoverPhoto ? 'Photo taken' : 'Take the handover photo'}</Text>
            </Pressable>
            <TextInput
              value={code}
              onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="Delivery code"
              placeholderTextColor={c.textSec}
              accessibilityLabel="Delivery code"
              style={[styles.input, styles.codeInput, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
            />
            <TextInput
              value={receivedBy}
              onChangeText={setReceivedBy}
              placeholder="Received by"
              placeholderTextColor={c.textSec}
              accessibilityLabel="Name of the person receiving it"
              style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
            />
            <View style={styles.actions}>
              <Pressable onPress={() => { setDelivering(null); setHandoverPhoto(false); }} accessibilityRole="button" style={[styles.btn, styles.grow, { borderWidth: 1, borderColor: c.border }]}>
                <Text style={{ color: c.text }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={deliver}
                disabled={!handoverPhoto || code.length !== 6 || receivedBy.trim().length < 2 || busy !== null}
                accessibilityRole="button"
                style={[styles.btn, styles.grow, { backgroundColor: handoverPhoto && code.length === 6 && receivedBy.trim().length >= 2 ? c.primary : c.border }]}
              >
                {busy ? <ActivityIndicator color={c.textOnPrimary} /> : <Text style={{ fontWeight: '700', color: c.textOnPrimary }}>Confirm delivery</Text>}
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
