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
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ActivityIndicator, Switch } from '../../components/Themed';
import { Text, TextInput } from '../../components/Text';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import { Icon } from '../../components/Icon';
import { userService } from '../../services/userService';
import { kycService, type LocalFile } from '../../services/kycService';
import { errorHandler } from '../../utils/errorHandler';
import { Radius, Spacing, Typography } from '../../theme';
import type { User, VehicleType } from '../../types/api';
import { REGISTRABLE_VEHICLES } from '../../utils/vehicles';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

import { tc, tk } from '../../theme/themed';

type DocKey = 'licence' | 'registration' | 'insurance' | 'vehiclePhoto';

const DOCS: { key: DocKey; label: string; hint: string }[] = [
  { key: 'licence', get label() { return i18n.t('kYC.docs.licence.label'); }, get hint() { return i18n.t('kYC.docs.licence.hint'); } },
  { key: 'registration', get label() { return i18n.t('kYC.docs.registration.label'); }, get hint() { return i18n.t('kYC.docs.registration.hint'); } },
  { key: 'insurance', get label() { return i18n.t('kYC.docs.insurance.label'); }, get hint() { return i18n.t('kYC.docs.insurance.hint'); } },
  { key: 'vehiclePhoto', get label() { return i18n.t('kYC.docs.vehiclePhoto.label'); }, get hint() { return i18n.t('kYC.docs.vehiclePhoto.hint'); } },
];


export function KYCScreen() {
  const { t } = useTranslation();
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
    <ScreenHeader title={t('kYC.driverVerification')} />
  );

  if (status === 'pending' || status === 'approved') {
    const approved = status === 'approved';
    return (
      <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
        {header}
        <View style={styles.centered}>
          <Icon name={approved ? 'check-decagram' : 'timer-sand'} size={56} color={approved ? tk.success : tk.primary} />
          <Text style={[styles.statusTitle, tc.color_text]}>
            {approved ? t('kYC.youAreVerified') : t('kYC.documentsUnderReview')}
          </Text>
          <Text style={[styles.statusBody, tc.color_textSec]}>
            {approved
              ? t('kYC.youCanOfferRidesNow') : t('kYC.aMemberOfThePoolora')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      {header}
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {status === 'rejected' && (
            <View style={[styles.notice, tc.backgroundColor_errorLight]} accessibilityLiveRegion="polite">
              <Text style={[{ fontSize: 14, fontWeight: '700' }, tc.color_text]}>{t('kYC.yourLastSubmissionWasNot')}</Text>
              {profile?.kyc?.rejectionReason ? (
                <Text style={[{ fontSize: 14, marginTop: 4 }, tc.color_text]}>{profile.kyc.rejectionReason}</Text>
              ) : null}
              <Text style={[{ fontSize: 14, marginTop: 4 }, tc.color_text]}>{t('kYC.correctTheDetailsBelowAnd')}</Text>
            </View>
          )}

          <Text style={[{ fontSize: 14, lineHeight: 20 }, tc.color_textSec]}>
            {t('kYC.privacy')}
          </Text>

          <View style={[
            styles.card,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant
          ]}>
            <Text style={[styles.sectionTitle, tc.color_text]}>{t('kYC.licence')}</Text>
            <Field label={t('kYC.drivingLicenceNumber')} value={licenseNumber} onChange={setLicenseNumber} autoCapitalize="characters" />
          </View>

          <View style={[
            styles.card,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant
          ]}>
            <Text style={[styles.sectionTitle, tc.color_text]}>{t('kYC.vehicle')}</Text>
            <Field label={t('kYC.make')} value={make} onChange={setMake} placeholder={t('kYC.forExampleToyota')} />
            <Field label={t('kYC.model')} value={model} onChange={setModel} placeholder={t('kYC.forExampleCorolla')} />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Field label={t('kYC.year')} value={year} onChange={t => setYear(t.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={4} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t('kYC.colour')} value={color} onChange={setColor} />
              </View>
            </View>
            <Field label={t('kYC.registrationNumber')} value={plate} onChange={setPlate} autoCapitalize="characters" placeholder={t('kYC.forExampleAea1234')} />
            <Text style={[styles.label, tc.color_textSec]}>{t('kYC.type')}</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {REGISTRABLE_VEHICLES.map(t => {
                const selected = vehicleType === t.value;
                return (
                  <Pressable
                    key={t.value}
                    onPress={() => setVehicleType(t.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={[
                      styles.chip,
                      selected ? tc.borderColor_primary : tc.borderColor_border,
                      selected ? tc.backgroundColor_primaryLight : tc.backgroundColor_surface
                    ]}
                  >
                    <Text style={[{ fontSize: 14 }, selected ? tc.color_primary : tc.color_text]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.switchRow}>
              <Text style={[{ flex: 1, fontSize: 15 }, tc.color_text]}>{t('kYC.airConditioning')}</Text>
              <Switch value={hasAC} onValueChange={setHasAC} accessibilityLabel={t('kYC.airConditioning')} trackColor={{ false: tk.border, true: tk.primary }} />
            </View>
          </View>

          <View style={[
            styles.card,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant
          ]}>
            <Text style={[styles.sectionTitle, tc.color_text]}>{t('kYC.documents')}</Text>
            {DOCS.map(doc => {
              const file = files[doc.key];
              return (
                <Pressable
                  key={doc.key}
                  onPress={() => choose(doc.key)}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel={file ? t('kYC.docAdded', { label: doc.label }) : t('kYC.docMissing', { label: doc.label })}
                  style={[styles.docRow, file ? tc.borderColor_success : tc.borderColor_border]}
                >
                  {file ? (
                    <Image source={{ uri: file.uri }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbEmpty, tc.backgroundColor_surface]}>
                      <Icon name="camera-plus-outline" size={22} color={tk.textSec} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[{ fontSize: 15, fontWeight: '600' }, tc.color_text]}>{doc.label}</Text>
                    <Text style={[{ fontSize: 13 }, tc.color_textSec]}>{file ? t('kYC.addedReplace') : doc.hint}</Text>
                  </View>
                  {file ? <Icon name="check-circle" size={22} color={tk.success} /> : null}
                </Pressable>
              );
            })}
          </View>

          {error ? (
            <Text style={[{ fontSize: 14 }, tc.color_error]} accessibilityLiveRegion="polite">{error}</Text>
          ) : null}

          <Pressable
            onPress={submit}
            disabled={!complete || submitting}
            accessibilityRole="button"
            accessibilityState={{ disabled: !complete || submitting, busy: submitting }}
            style={[styles.primaryBtn, complete ? tc.backgroundColor_primary : tc.backgroundColor_border]}
          >
            {submitting ? (
              <View style={styles.row}>
                <ActivityIndicator color={tk.textOnPrimary} />
                <Text style={[styles.primaryBtnText, tc.color_textOnPrimary]} accessibilityLiveRegion="polite">{progress}</Text>
              </View>
            ) : (
              <Text style={[styles.primaryBtnText, complete ? tc.color_textOnPrimary : tc.color_textSec]}>{t('kYC.submitForReview')}</Text>
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
  placeholder,
  keyboardType,
  autoCapitalize,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad';
  autoCapitalize?: 'none' | 'characters' | 'words';
  maxLength?: number;
}) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={[styles.label, tc.color_textSec]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={tk.textSec}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'words'}
        maxLength={maxLength}
        accessibilityLabel={label}
        style={[
          styles.input,
          tc.borderColor_border,
          tc.backgroundColor_surface,
          tc.color_text
        ]}
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
