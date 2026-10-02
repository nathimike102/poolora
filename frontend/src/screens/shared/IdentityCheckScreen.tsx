/**
 * IdentityCheckScreen.tsx
 *
 * The identity check behind women-only rides: the user says their gender and
 * sends a photo of an ID document and a selfie taken now. An admin compares
 * them and confirms. Only verified women can post or book women-only rides,
 * because a declared gender alone would let anyone in.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { BackButton } from '../../components/BackButton';
import { Icon } from '../../components/Icon';
import { identityService, type Gender, type IdentityStatus } from '../../services/identityService';
import type { LocalFile } from '../../services/kycService';
import { errorHandler } from '../../utils/errorHandler';
import { REGION } from '../../utils/region';
import i18n from '../../i18n';
import { useTranslation } from 'react-i18next';

/** Labels are in the catalogue under identity.genders */
const GENDERS: Gender[] = ['female', 'male', 'other'];

async function pick(source: 'camera' | 'library', front = false): Promise<LocalFile | null> {
  const permission = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(i18n.t('identity.permissionNeeded'), source === 'camera' ? i18n.t('identity.allowTheCameraToTake') : i18n.t('identity.allowAccessToYourPhotos'));
    return null;
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.7,
    ...(front ? { cameraType: ImagePicker.CameraType.front } : {}),
  };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const png = asset.mimeType === 'image/png';
  return { uri: asset.uri, mimeType: png ? 'image/png' : 'image/jpeg', name: png ? 'photo.png' : 'photo.jpg' };
}

export function IdentityCheckScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<IdentityStatus | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [document, setDocument] = useState<LocalFile | null>(null);
  const [selfie, setSelfie] = useState<LocalFile | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    identityService.status()
      .then(s => {
        setStatus(s);
        setGender(g => g ?? s.declaredGender ?? s.gender);
      })
      .catch(error => Alert.alert(t('identity.couldNotLoad'), errorHandler.process(error).message));
  }, [t]);
  useFocusEffect(load);

  const submit = async () => {
    if (!gender || !document || !selfie) return;
    setSending(true);
    try {
      setStatus(await identityService.submit({ gender, document, selfie }));
      setDocument(null);
      setSelfie(null);
    } catch (error) {
      Alert.alert(t('identity.notSent'), errorHandler.process(error).message);
    } finally {
      setSending(false);
    }
  };

  const canSend = status && (status.status === 'none' || status.status === 'rejected');

  const photoRow = (label: string, file: LocalFile | null, set: (f: LocalFile | null) => void, selfieMode: boolean) => (
    <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[s.cardTitle, { color: c.text }]}>{label}</Text>
      {file ? <Image source={{ uri: file.uri }} style={s.preview} accessibilityLabel={t('identity.chosen', { label })} /> : null}
      <View style={s.row}>
        <Pressable onPress={async () => set((await pick('camera', selfieMode)) ?? file)} style={[s.smallBtn, { borderColor: c.primary }]} accessibilityRole="button">
          <Icon name="camera" size={18} color={c.primary} />
          <Text style={{ color: c.primary, fontWeight: '700' }}>{file ? t('identity.retake') : selfieMode ? t('identity.takeASelfie') : t('identity.takeAPhoto')}</Text>
        </Pressable>
        {!selfieMode ? (
          <Pressable onPress={async () => set((await pick('library')) ?? file)} style={[s.smallBtn, { borderColor: c.border }]} accessibilityRole="button">
            <Icon name="image" size={18} color={c.text} />
            <Text style={{ color: c.text, fontWeight: '600' }}>{t('identity.choose')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '700', color: c.text }}>{t('identity.identityCheck')}</Text>
      </View>

      <ScrollView contentContainerStyle={s.body}>
        <Text style={{ fontSize: 14, color: c.textSec, lineHeight: 21 }}>
          {t('identity.intro')}
        </Text>

        {!status ? <ActivityIndicator color={c.primary} /> : null}

        {status?.status === 'verified' ? (
          <View style={[s.banner, { backgroundColor: c.successLight }]} accessibilityLiveRegion="polite">
            <Icon name="shield-check" size={22} color={c.success} />
            <Text style={{ flex: 1, color: c.text }}>
              {status.gender === 'female' ? t('identity.verifiedWoman') : t('identity.verified')}
            </Text>
          </View>
        ) : null}
        {status?.status === 'pending' ? (
          <View style={[s.banner, { backgroundColor: c.primaryLight }]} accessibilityLiveRegion="polite">
            <Icon name="clock-outline" size={22} color={c.primary} />
            <Text style={{ flex: 1, color: c.text }}>
              {t('identity.pending', { date: status.submittedAt ? new Date(status.submittedAt).toLocaleDateString(REGION.dateLocale, { day: 'numeric', month: 'short' }) : '' })}
            </Text>
          </View>
        ) : null}
        {status?.status === 'rejected' ? (
          <View style={[s.banner, { backgroundColor: c.errorLight }]}>
            <Icon name="alert-circle-outline" size={22} color={c.error} />
            <Text style={{ flex: 1, color: c.text }}>{t('identity.rejected', { reason: status.rejectionReason })}</Text>
          </View>
        ) : null}

        {canSend ? (
          <>
            <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={[s.cardTitle, { color: c.text }]}>{t('identity.yourGender')}</Text>
              <View style={s.row} accessibilityRole="radiogroup">
                {GENDERS.map(value => ({ value, label: t(`identity.genders.${value}`) })).map(g => (
                  <Pressable
                    key={g.value}
                    onPress={() => setGender(g.value)}
                    style={[s.choice, { borderColor: gender === g.value ? c.primary : c.border, backgroundColor: gender === g.value ? c.primaryLight : c.surface }]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: gender === g.value }}
                  >
                    <Text style={{ fontWeight: '700', color: gender === g.value ? c.primary : c.text, textAlign: 'center' }}>{g.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {photoRow(t('identity.idPhoto'), document, setDocument, false)}
            {photoRow(t('identity.selfie'), selfie, setSelfie, true)}
            <Text style={{ fontSize: 13, color: c.textSec }}>{t('identity.makeSureThePhotoOn')}</Text>
            <Pressable
              onPress={submit}
              disabled={!gender || !document || !selfie || sending}
              style={[s.submit, { backgroundColor: gender && document && selfie ? c.primary : c.border }]}
              accessibilityRole="button"
            >
              {sending ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>{t('identity.sendForReview')}</Text>}
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1 },
  body: { padding: 20, gap: 14, paddingBottom: 40 },
  banner: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: 14 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10 },
  choice: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5 },
  preview: { width: '100%', height: 180, borderRadius: 12, resizeMode: 'cover' },
  submit: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
