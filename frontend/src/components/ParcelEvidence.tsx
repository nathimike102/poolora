/**
 * components/ParcelEvidence.tsx
 *
 * On the sender's tracking screen: the driver's pickup and delivery photos
 * (UC-P03), and claims for a damaged or lost parcel (UC-P05). Damage can be
 * claimed within 7 days of delivery; loss once the parcel is a day overdue.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Modal, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';

import { useApp } from '../context/AppContext';
import { apiClient, getAuthorizationHeader } from '../api/axios';
import { parcelService, type Parcel, type ParcelClaim, type ParcelPhoto } from '../services/parcelService';
import { takeParcelPhoto } from '../utils/parcelPhoto';
import { errorHandler } from '../utils/errorHandler';

const DAY = 86_400_000;
const STATUS: Record<ParcelClaim['status'], string> = {
  submitted: 'Being reviewed',
  with_insurer: 'With the insurer',
  approved: 'Approved',
  rejected: 'Not approved',
};

export function ParcelEvidence({ parcel }: { parcel: Parcel }) {
  const { c } = useApp();
  const [photos, setPhotos] = useState<ParcelPhoto[]>([]);
  const [claims, setClaims] = useState<ParcelClaim[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ description: '', amount: '' });
  const [claimPhotos, setClaimPhotos] = useState<ParcelPhoto[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    parcelService.photos(parcel._id).then(setPhotos).catch(() => undefined);
    parcelService.claims(parcel._id).then(setClaims).catch(() => undefined);
  }, [parcel._id]);
  useEffect(load, [load, parcel.status, parcel.actualPickupTime]);

  const now = Date.now();
  const delivered = parcel.status === 'completed' && parcel.actualDeliveryTime;
  const kind: 'damaged' | 'lost' | null = delivered && now - new Date(parcel.actualDeliveryTime!).getTime() <= 7 * DAY
    ? 'damaged'
    : parcel.actualPickupTime && !parcel.actualDeliveryTime && now - new Date(parcel.estimatedDeliveryTime).getTime() > DAY
      ? 'lost'
      : null;
  const openClaim = claims.some(cl => cl.status !== 'rejected');
  const cover = parcel.insuranceValue && parcel.insuranceValue > 0 ? parcel.insuranceValue : parcel.estimatedCost;
  const amount = Number(form.amount);
  const canSend = form.description.trim().length >= 10 && amount >= 1 && amount <= cover && (kind === 'lost' || claimPhotos.length > 0);

  const addClaimPhoto = async (from: 'camera' | 'library') => {
    const photo = await takeParcelPhoto(parcel._id, 'claim', from);
    if (photo) setClaimPhotos(list => [...list, photo]);
  };

  const send = async () => {
    if (!kind) return;
    setBusy(true);
    try {
      await parcelService.fileClaim(parcel._id, { kind, description: form.description.trim(), amount, photoIds: claimPhotos.map(p => p.id) });
      setOpen(false);
      setForm({ description: '', amount: '' });
      setClaimPhotos([]);
      load();
      Alert.alert('Claim sent', 'We will tell you when it is decided.');
    } catch (e) {
      Alert.alert('Claim not sent', errorHandler.process(e).message);
    } finally {
      setBusy(false);
    }
  };

  const proof = photos.filter(p => p.stage !== 'claim');
  const auth = getAuthorizationHeader();
  const image = (p: ParcelPhoto) => ({ uri: `${apiClient.defaults.baseURL}${p.path}`, headers: auth ? { Authorization: auth } : undefined });

  if (!proof.length && !claims.length && !kind) return null;

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      {proof.length ? (
        <>
          <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">Photo proof</Text>
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
            {proof.map(p => (
              <View key={p.id} style={{ gap: 4 }}>
                <Image source={image(p)} style={styles.thumb} accessibilityLabel={`${p.stage === 'pickup' ? 'Pickup' : 'Delivery'} photo`} />
                <Text style={{ fontSize: 12, color: c.textSec }}>
                  {p.stage === 'pickup' ? 'Picked up' : 'Delivered'} {new Date(p.takenAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </Text>
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}

      {claims.map(cl => (
        <View key={cl._id} style={{ gap: 2 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: cl.status === 'approved' ? c.success : c.text }}>
            {cl.kind === 'damaged' ? 'Damage' : 'Lost parcel'} claim, ₹{cl.amountClaimed}: {STATUS[cl.status]}
          </Text>
          {cl.status === 'approved' && cl.payout ? <Text style={{ fontSize: 13, color: c.text }}>₹{cl.payout} was added to your wallet.</Text> : null}
          {cl.decisionNote ? <Text style={{ fontSize: 13, color: c.textSec }}>{cl.decisionNote}</Text> : null}
        </View>
      ))}

      {kind && !openClaim ? (
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" style={[styles.btn, { borderWidth: 1, borderColor: c.primary }]}>
          <Text style={{ fontWeight: '700', color: c.primary }}>{kind === 'damaged' ? 'Report damage' : 'Report the parcel lost'}</Text>
        </Pressable>
      ) : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <ScrollView style={[styles.sheet, { backgroundColor: c.surface }]} contentContainerStyle={{ gap: 10, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }} accessibilityRole="header">{kind === 'damaged' ? 'Report damage' : 'Report a lost parcel'}</Text>
            <Text style={{ fontSize: 13, color: c.textSec }}>
              {parcel.insuranceValue ? `Insured: covered up to ₹${cover}.` : `Not insured: covered up to the delivery charge, ₹${cover}.`}
            </Text>
            <TextInput
              value={form.description}
              onChangeText={description => setForm(f => ({ ...f, description }))}
              multiline
              maxLength={2000}
              placeholder={kind === 'damaged' ? 'What was damaged and how' : 'When you last saw it, and what the recipient says'}
              placeholderTextColor={c.textSec}
              accessibilityLabel="What happened"
              style={[styles.input, styles.multi, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
            />
            <TextInput
              value={form.amount}
              onChangeText={t => setForm(f => ({ ...f, amount: t.replace(/[^0-9.]/g, '') }))}
              keyboardType="decimal-pad"
              placeholder={`Amount, up to ₹${cover}`}
              placeholderTextColor={c.textSec}
              accessibilityLabel="Amount you are claiming"
              style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
            />
            {kind === 'damaged' ? (
              <>
                <Text style={{ fontSize: 13, color: c.textSec }}>Add photos of the damage and of the parcel as it arrived ({claimPhotos.length} added).</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable onPress={() => addClaimPhoto('camera')} accessibilityRole="button" style={[styles.btn, styles.grow, { borderWidth: 1, borderColor: c.border }]}>
                    <Text style={{ color: c.text }}>Take a photo</Text>
                  </Pressable>
                  <Pressable onPress={() => addClaimPhoto('library')} accessibilityRole="button" style={[styles.btn, styles.grow, { borderWidth: 1, borderColor: c.border }]}>
                    <Text style={{ color: c.text }}>From gallery</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => setOpen(false)} accessibilityRole="button" style={[styles.btn, styles.grow, { borderWidth: 1, borderColor: c.border }]}>
                <Text style={{ color: c.text }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={send} disabled={!canSend || busy} accessibilityRole="button" style={[styles.btn, styles.grow, { backgroundColor: canSend ? c.primary : c.border }]}>
                {busy ? <ActivityIndicator color={c.textOnPrimary} /> : <Text style={{ fontWeight: '700', color: c.textOnPrimary }}>Send claim</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  title: { fontSize: 15, fontWeight: '700' },
  thumb: { width: 120, height: 120, borderRadius: 10, backgroundColor: '#0001' },
  btn: { minHeight: 44, borderRadius: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '85%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15 },
  multi: { minHeight: 100, paddingTop: 12, textAlignVertical: 'top' },
});
