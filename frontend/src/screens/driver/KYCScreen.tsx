/**
 * screens/driver/KYCScreen.tsx
 *
 * Driver verification. Collects exactly what the Poolora team reviews:
 * driving licence, vehicle details, registration book, insurance and a
 * vehicle photo. Documents are reviewed by a person; nothing is auto-approved.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Switch,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { BackButton } from '../../components/BackButton';
import { Icon } from '../../components/Icon';
import { userService } from '../../services/userService';
import { kycService, type LocalFile } from '../../services/kycService';
import { errorHandler } from '../../utils/errorHandler';
import { Radius, Spacing, Typography } from '../../theme';
import type { User, VehicleType } from '../../types/api';
import { REGISTRABLE_VEHICLES } from '../../utils/vehicles';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

type DocKey = 'licence' | 'registration' | 'insurance' | 'vehiclePhoto';

const DOCS: { key: DocKey; label: string; hint: string }[] = [
  { key: 'licence', get label() { return i18n.t('kYC.docs.licence.label'); }, get hint() { return i18n.t('kYC.docs.licence.hint'); } },
  { key: 'registration', get label() { return i18n.t('kYC.docs.registration.label'); }, get hint() { return i18n.t('kYC.docs.registration.hint'); } },
  { key: 'insurance', get label() { return i18n.t('kYC.docs.insurance.label'); }, get hint() { return i18n.t('kYC.docs.insurance.hint'); } },
  { key: 'vehiclePhoto', get label() { return i18n.t('kYC.docs.vehiclePhoto.label'); }, get hint() { return i18n.t('kYC.docs.vehiclePhoto.hint'); } },
];


export function KYCScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<User | null>(null);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [plate, setPlate] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('hatchback');
  const [hasAC, setHasAC] = useState(true);
  const [files, setFiles] = useState<Partial<Record<DocKey, LocalFile>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      userService.getMyProfile().then(setProfile).catch(() => undefined);
    }, []),
  );

  const pick = async (key: DocKey, source: 'camera' | 'library') => {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('kYC.permissionNeeded'), `Allow ${source === 'camera' ? 'camera' : 'photo library'} access to add this document.`);
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
    const result =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
    setFiles(prev => ({
      ...prev,
      [key]: { uri: asset.uri, mimeType, name: `${key}.${mimeType === 'image/png' ? 'png' : 'jpg'}` },
    }));
  };

  const choose = (key: DocKey) =>
    Alert.alert(t('kYC.addDocument'), undefined, [
      { text: t('kYC.takePhoto'), onPress: () => pick(key, 'camera') },
      { text: t('kYC.chooseFromLibrary'), onPress: () => pick(key, 'library') },
      { text: t('kYC.cancel'), style: 'cancel' },
    ]);

  const yearNumber = Number(year);
  const currentYear = new Date().getFullYear();
  const complete =
    licenseNumber.trim().length >= 8 &&
    make.trim() &&
    model.trim() &&
    color.trim() &&
    plate.trim().length >= 6 &&
    Number.isInteger(yearNumber) &&
    yearNumber >= 2000 &&
    yearNumber <= currentYear + 1 &&
    DOCS.every(d => files[d.key]);

  const submit = async () => {
    if (!complete || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const user = await kycService.submit(
        {
          licenseNumber: licenseNumber.trim().toUpperCase(),
          vehicle: {
            make: make.trim(),
            model: model.trim(),
            year: yearNumber,
            color: color.trim(),
            plateNumber: plate.replace(/\s+/g, '').toUpperCase(),
            vehicleType,
            hasAC,
          },
          licence: files.licence!,
          registration: files.registration!,
          insurance: files.insurance!,
          vehiclePhoto: files.vehiclePhoto!,
        },
        (done, total) => setProgress(done < total ? t('kYC.uploading', { n: done + 1, total }) : t('kYC.submitting')),
      );
      setProfile(user);
    } catch (err) {
      setError(err instanceof Error && !('isAxiosError' in err) ? err.message : errorHandler.process(err).message);
    } finally {
      setSubmitting(false);
      setProgress('');
    }
  };

  const status = profile?.kyc?.status ?? 'none';

  const header = (
    <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
      <BackButton onPress={() => navigation.goBack()} />
      <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">{t('kYC.driverVerification')}</Text>
    </View>
  );

  if (status === 'pending' || status === 'approved') {
    const approved = status === 'approved';
    return (
      <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        {header}
        <View style={styles.centered}>
          <Icon name={approved ? 'check-decagram' : 'timer-sand'} size={56} color={approved ? c.success : c.primary} />
          <Text style={[styles.statusTitle, { color: c.text }]}>
            {approved ? t('kYC.youAreVerified') : t('kYC.documentsUnderReview')}
          </Text>
          <Text style={[styles.statusBody, { color: c.textSec }]}>
            {approved
              ? t('kYC.youCanOfferRidesNow') : t('kYC.aMemberOfThePoolora')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {header}
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {status === 'rejected' && (
            <View style={[styles.notice, { backgroundColor: c.errorLight }]} accessibilityLiveRegion="polite">
              <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{t('kYC.yourLastSubmissionWasNot')}</Text>
              {profile?.kyc?.rejectionReason ? (
                <Text style={{ fontSize: 14, color: c.text, marginTop: 4 }}>{profile.kyc.rejectionReason}</Text>
              ) : null}
              <Text style={{ fontSize: 14, color: c.text, marginTop: 4 }}>{t('kYC.correctTheDetailsBelowAnd')}</Text>
            </View>
          )}

          <Text style={{ fontSize: 14, color: c.textSec, lineHeight: 20 }}>
            {t('kYC.privacy')}
          </Text>

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>{t('kYC.licence')}</Text>
            <Field label={t('kYC.drivingLicenceNumber')} value={licenseNumber} onChange={setLicenseNumber} autoCapitalize="characters" c={c} />
          </View>

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>{t('kYC.vehicle')}</Text>
            <Field label={t('kYC.make')} value={make} onChange={setMake} placeholder={t('kYC.forExampleToyota')} c={c} />
            <Field label={t('kYC.model')} value={model} onChange={setModel} placeholder={t('kYC.forExampleCorolla')} c={c} />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Field label={t('kYC.year')} value={year} onChange={t => setYear(t.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={4} c={c} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t('kYC.colour')} value={color} onChange={setColor} c={c} />
              </View>
            </View>
            <Field label={t('kYC.registrationNumber')} value={plate} onChange={setPlate} autoCapitalize="characters" placeholder={t('kYC.forExampleAea1234')} c={c} />
            <Text style={[styles.label, { color: c.textSec }]}>{t('kYC.type')}</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {REGISTRABLE_VEHICLES.map(t => {
                const selected = vehicleType === t.value;
                return (
                  <Pressable
                    key={t.value}
                    onPress={() => setVehicleType(t.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={[styles.chip, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primaryLight : c.bg }]}
                  >
                    <Text style={{ fontSize: 14, color: selected ? c.primary : c.text }}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.switchRow}>
              <Text style={{ flex: 1, fontSize: 15, color: c.text }}>{t('kYC.airConditioning')}</Text>
              <Switch value={hasAC} onValueChange={setHasAC} accessibilityLabel={t('kYC.airConditioning')} trackColor={{ false: c.border, true: c.primary }} />
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>{t('kYC.documents')}</Text>
            {DOCS.map(doc => {
              const file = files[doc.key];
              return (
                <Pressable
                  key={doc.key}
                  onPress={() => choose(doc.key)}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel={file ? t('kYC.docAdded', { label: doc.label }) : t('kYC.docMissing', { label: doc.label })}
                  style={[styles.docRow, { borderColor: file ? c.success : c.border }]}
                >
                  {file ? (
                    <Image source={{ uri: file.uri }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: c.bg }]}>
                      <Icon name="camera-plus-outline" size={22} color={c.textSec} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>{doc.label}</Text>
                    <Text style={{ fontSize: 13, color: c.textSec }}>{file ? t('kYC.addedReplace') : doc.hint}</Text>
                  </View>
                  {file ? <Icon name="check-circle" size={22} color={c.success} /> : null}
                </Pressable>
              );
            })}
          </View>

          {error ? (
            <Text style={{ color: c.error, fontSize: 14 }} accessibilityLiveRegion="polite">{error}</Text>
          ) : null}

          <Pressable
            onPress={submit}
            disabled={!complete || submitting}
            accessibilityRole="button"
            accessibilityState={{ disabled: !complete || submitting, busy: submitting }}
            style={[styles.primaryBtn, { backgroundColor: complete ? c.primary : c.border }]}
          >
            {submitting ? (
              <View style={styles.row}>
                <ActivityIndicator color={c.textOnPrimary} />
                <Text style={[styles.primaryBtnText, { color: c.textOnPrimary }]} accessibilityLiveRegion="polite">{progress}</Text>
              </View>
            ) : (
              <Text style={[styles.primaryBtnText, { color: complete ? c.textOnPrimary : c.textSec }]}>{t('kYC.submitForReview')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  c,
  placeholder,
  keyboardType,
  autoCapitalize,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  c: ReturnType<typeof useApp>['c'];
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad';
  autoCapitalize?: 'none' | 'characters' | 'words';
  maxLength?: number;
}) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={[styles.label, { color: c.textSec }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.textSec}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'words'}
        maxLength={maxLength}
        accessibilityLabel={label}
        style={[styles.input, { borderColor: c.border, backgroundColor: c.bg, color: c.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: Typography.bold },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  statusTitle: { fontSize: 22, fontWeight: Typography.bold, textAlign: 'center', marginTop: 8 },
  statusBody: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  body: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  notice: { borderRadius: Radius.md, padding: Spacing.md },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: Typography.bold, marginBottom: Spacing.md },
  label: { fontSize: 13, fontWeight: Typography.semibold, marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: Radius.sm, borderWidth: 1.5, justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    minHeight: 64,
  },
  thumb: { width: 48, height: 48, borderRadius: Radius.xs },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  primaryBtn: { minHeight: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },
  primaryBtnText: { fontSize: 16, fontWeight: Typography.bold },
});
