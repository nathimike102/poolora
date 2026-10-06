/**
 * components/ParcelEvidence.tsx
 *
 * On the sender's tracking screen: the driver's pickup and delivery photos
 * (UC-P03), and claims for a damaged or lost parcel (UC-P05). Damage can be
 * claimed within 7 days of delivery; loss once the parcel is a day overdue.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, Image, Modal, Alert, ScrollView } from 'react-native';
import { ActivityIndicator } from './Themed';
import { Text, TextInput } from './Text';

import { apiClient, getAuthorizationHeader } from '../api/axios';
import { parcelService, type Parcel, type ParcelClaim, type ParcelPhoto } from '../services/parcelService';
import { takeParcelPhoto } from '../utils/parcelPhoto';
import { errorHandler } from '../utils/errorHandler';
import { money, REGION } from '../utils/region';
import { useTranslation } from 'react-i18next';
import { tc, tk } from '../theme/themed';

const DAY = 86_400_000;

export function ParcelEvidence({ parcel }: { parcel: Parcel }) {
  const { t } = useTranslation();
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
      Alert.alert(t('parcelEvidence.claimSent'), t('parcelEvidence.weWillTellYouWhen'));
    } catch (e) {
      Alert.alert(t('parcelEvidence.claimNotSent'), errorHandler.process(e).message);
    } finally {
      setBusy(false);
    }
  };

  const proof = photos.filter(p => p.stage !== 'claim');
  const auth = getAuthorizationHeader();
  const image = (p: ParcelPhoto) => ({ uri: `${apiClient.defaults.baseURL}${p.path}`, headers: auth ? { Authorization: auth } : undefined });

  if (!proof.length && !claims.length && !kind) return null;

  return (
    <View style={[styles.card, tc.backgroundColor_surface, tc.borderColor_border]}>
      {proof.length ? (
        <>
          <Text style={[styles.title, tc.color_text]} accessibilityRole="header">{t('parcelEvidence.photoProof')}</Text>
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
            {proof.map(p => (
              <View key={p.id} style={{ gap: 4 }}>
                <Image source={image(p)} style={styles.thumb} accessibilityLabel={`${p.stage === 'pickup' ? t('parcelEvidence.pickup') : t('parcelEvidence.delivery')} photo`} />
                <Text style={[{ fontSize: 12 }, tc.color_textSec]}>
                  {p.stage === 'pickup' ? t('parcelEvidence.pickedUp') : t('parcelEvidence.delivered')} {new Date(p.takenAt).toLocaleTimeString(REGION.dateLocale, { hour: 'numeric', minute: '2-digit' })}
                </Text>
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}

      {claims.map(cl => (
        <View key={cl._id} style={{ gap: 2 }}>
          <Text style={[{ fontSize: 14, fontWeight: '700' }, cl.status === 'approved' ? tc.color_success : tc.color_text]}>
            {t('parcelEvidence.claimLine', { kind: cl.kind === 'damaged' ? t('parcelEvidence.damage') : t('parcelEvidence.lostParcel'), amount: money(cl.amountClaimed), status: t(`parcelEvidence.status.${cl.status}`) })}
          </Text>
          {cl.status === 'approved' && cl.payout ? <Text style={[{ fontSize: 13 }, tc.color_text]}>{t('parcelEvidence.payoutAdded', { amount: money(cl.payout) })}</Text> : null}
          {cl.decisionNote ? <Text style={[{ fontSize: 13 }, tc.color_textSec]}>{cl.decisionNote}</Text> : null}
        </View>
      ))}

      {kind && !openClaim ? (
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" style={[styles.btn, { borderWidth: 1 }, tc.borderColor_primary]}>
          <Text style={[{ fontWeight: '700' }, tc.color_primary]}>{kind === 'damaged' ? t('parcelEvidence.reportDamage') : t('parcelEvidence.reportTheParcelLost')}</Text>
        </Pressable>
      ) : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <ScrollView style={[styles.sheet, tc.backgroundColor_surface]} contentContainerStyle={{ gap: 10, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            <Text style={[{ fontSize: 18, fontWeight: '700' }, tc.color_text]} accessibilityRole="header">{kind === 'damaged' ? t('parcelEvidence.reportDamage') : t('parcelEvidence.reportALostParcel')}</Text>
            <Text style={[{ fontSize: 13 }, tc.color_textSec]}>
              {parcel.insuranceValue ? t('parcelEvidence.insured', { amount: money(cover) }) : t('parcelEvidence.notInsured', { amount: money(cover) })}
            </Text>
            <TextInput
              value={form.description}
              onChangeText={description => setForm(f => ({ ...f, description }))}
              multiline
              maxLength={2000}
              placeholder={kind === 'damaged' ? t('parcelEvidence.whatWasDamagedAndHow') : t('parcelEvidence.whenYouLastSawIt')}
              placeholderTextColor={tk.textSec}
              accessibilityLabel={t('parcelEvidence.whatHappened')}
              style={[
                styles.input,
                styles.multi,
                tc.borderColor_border,
                tc.color_text,
                tc.backgroundColor_surface
              ]}
            />
            <TextInput
              value={form.amount}
              onChangeText={t => setForm(f => ({ ...f, amount: t.replace(/[^0-9.]/g, '') }))}
              keyboardType="decimal-pad"
              placeholder={t('parcelEvidence.amountUpTo', { amount: money(cover) })}
              placeholderTextColor={tk.textSec}
              accessibilityLabel={t('parcelEvidence.amountYouAreClaiming')}
              style={[
                styles.input,
                tc.borderColor_border,
                tc.color_text,
                tc.backgroundColor_surface
              ]}
            />
            {kind === 'damaged' ? (
              <>
                <Text style={[{ fontSize: 13 }, tc.color_textSec]}>{t('parcelEvidence.addPhotos', { count: claimPhotos.length })}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable onPress={() => addClaimPhoto('camera')} accessibilityRole="button" style={[styles.btn, styles.grow, { borderWidth: 1 }, tc.borderColor_border]}>
                    <Text style={tc.color_text}>{t('parcelEvidence.takeAPhoto')}</Text>
                  </Pressable>
                  <Pressable onPress={() => addClaimPhoto('library')} accessibilityRole="button" style={[styles.btn, styles.grow, { borderWidth: 1 }, tc.borderColor_border]}>
                    <Text style={tc.color_text}>{t('parcelEvidence.fromGallery')}</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => setOpen(false)} accessibilityRole="button" style={[styles.btn, styles.grow, { borderWidth: 1 }, tc.borderColor_border]}>
                <Text style={tc.color_text}>{t('parcelEvidence.cancel')}</Text>
              </Pressable>
              <Pressable onPress={send} disabled={!canSend || busy} accessibilityRole="button" style={[styles.btn, styles.grow, canSend ? tc.backgroundColor_primary : tc.backgroundColor_border]}>
                {busy ? <ActivityIndicator color={tk.textOnPrimary} /> : <Text style={[{ fontWeight: '700' }, tc.color_textOnPrimary]}>{t('parcelEvidence.sendClaim')}</Text>}
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
