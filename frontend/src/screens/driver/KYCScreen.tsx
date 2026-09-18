/**
 * screens/driver/KYCScreen.tsx
 *
 * Driver verification. Collects exactly what the Sanchari team reviews:
 * driving licence, vehicle details, registration certificate, insurance and a
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

type DocKey = 'licence' | 'registration' | 'insurance' | 'vehiclePhoto';

const DOCS: { key: DocKey; label: string; hint: string }[] = [
  { key: 'licence', label: 'Driving licence', hint: 'Front side, all text readable' },
  { key: 'registration', label: 'Registration certificate (RC)', hint: 'The page showing the registration number' },
  { key: 'insurance', label: 'Vehicle insurance', hint: 'The current policy page' },
  { key: 'vehiclePhoto', label: 'Photo of your vehicle', hint: 'Number plate clearly visible' },
];

const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'hatchback', label: 'Hatchback' },
  { value: 'sedan', label: 'Sedan' },
  { value: 'suv', label: 'SUV' },
  { value: 'mini', label: 'Mini' },
];

export function KYCScreen() {
  const navigation = useNavigation();
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
      Alert.alert('Permission needed', `Allow ${source === 'camera' ? 'camera' : 'photo library'} access to add this document.`);
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
    Alert.alert('Add document', undefined, [
      { text: 'Take photo', onPress: () => pick(key, 'camera') },
      { text: 'Choose from library', onPress: () => pick(key, 'library') },
      { text: 'Cancel', style: 'cancel' },
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
        (done, total) => setProgress(done < total ? `Uploading document ${done + 1} of ${total}` : 'Submitting'),
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
      <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">Driver verification</Text>
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
            {approved ? 'You are verified' : 'Documents under review'}
          </Text>
          <Text style={[styles.statusBody, { color: c.textSec }]}>
            {approved
              ? 'You can offer rides now.'
              : 'A member of the Sanchari team checks every submission. We will notify you when it has been reviewed.'}
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
              <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>Your last submission was not approved</Text>
              {profile?.kyc?.rejectionReason ? (
                <Text style={{ fontSize: 14, color: c.text, marginTop: 4 }}>{profile.kyc.rejectionReason}</Text>
              ) : null}
              <Text style={{ fontSize: 14, color: c.text, marginTop: 4 }}>Correct the details below and submit again.</Text>
            </View>
          )}

          <Text style={{ fontSize: 14, color: c.textSec, lineHeight: 20 }}>
            Riders can only book drivers whose documents have been checked. Your documents are stored privately
            and are only seen by the team reviewing your application.
          </Text>

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Licence</Text>
            <Field label="Driving licence number" value={licenseNumber} onChange={setLicenseNumber} autoCapitalize="characters" c={c} />
          </View>

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Vehicle</Text>
            <Field label="Make" value={make} onChange={setMake} placeholder="For example, Maruti Suzuki" c={c} />
            <Field label="Model" value={model} onChange={setModel} placeholder="For example, Swift" c={c} />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Field label="Year" value={year} onChange={t => setYear(t.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={4} c={c} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Colour" value={color} onChange={setColor} c={c} />
              </View>
            </View>
            <Field label="Registration number" value={plate} onChange={setPlate} autoCapitalize="characters" placeholder="For example, AP05AB1234" c={c} />
            <Text style={[styles.label, { color: c.textSec }]}>Type</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {VEHICLE_TYPES.map(t => {
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
              <Text style={{ flex: 1, fontSize: 15, color: c.text }}>Air conditioning</Text>
              <Switch value={hasAC} onValueChange={setHasAC} accessibilityLabel="Air conditioning" trackColor={{ false: c.border, true: c.primary }} />
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Documents</Text>
            {DOCS.map(doc => {
              const file = files[doc.key];
              return (
                <Pressable
                  key={doc.key}
                  onPress={() => choose(doc.key)}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel={`${doc.label}, ${file ? 'added, tap to replace' : 'not added'}`}
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
                    <Text style={{ fontSize: 13, color: c.textSec }}>{file ? 'Added. Tap to replace.' : doc.hint}</Text>
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
              <Text style={[styles.primaryBtnText, { color: complete ? c.textOnPrimary : c.textSec }]}>Submit for review</Text>
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
