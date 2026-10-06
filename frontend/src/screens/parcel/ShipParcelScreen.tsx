/**
 * screens/parcel/ShipParcelScreen.tsx
 *
 * Send a parcel with a driver who is already making the trip (UC-P01):
 * where it goes, when, what it is, and who hands it over and receives it.
 * The next screen lists rides on that route. The sender's parcels are
 * listed first so they can follow them.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Switch, ActivityIndicator } from '../../components/Themed';
import { Text, TextInput } from '../../components/Text';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Icon } from '../../components/Icon';
import { PlaceField } from '../../components/PlaceField';
import { RideDatePicker } from '../../components/RideDatePicker';
import { ClockTimePicker } from '../../components/ClockTimePicker';
import { useCurrentPlace } from '../../hooks/useCurrentPlace';
import { geocodePlace, rememberExactPlace } from '../../services/placesService';
import { parcelService, parcelStage, type Parcel, type ParcelType } from '../../services/parcelService';
import { realPhone } from '../../utils/phone';
import { errorHandler } from '../../utils/errorHandler';
import type { RootStackParamList } from '../../navigation/types';
import { toE164, REGION } from '../../utils/region';
import { useTranslation } from 'react-i18next';

import { tc, tk } from '../../theme/themed';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Labels are in the catalogue under shipParcel.types */
const TYPES: ParcelType[] = ['document', 'general', 'fragile', 'perishable'];


export function ShipParcelScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const {
    user
  } = useApp();
  const insets = useSafeAreaInsets();
  const { place: here } = useCurrentPlace();
  const near = here ? { lat: here.lat, lng: here.lng } : undefined;

  const [mine, setMine] = useState<Parcel[] | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState(() => new Date());
  const [time, setTime] = useState('10:00');
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [weight, setWeight] = useState('1');
  const [type, setType] = useState<ParcelType>('general');
  const [senderName, setSenderName] = useState(user?.name ?? '');
  const [senderPhone, setSenderPhone] = useState(realPhone(user?.phone) ?? '');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [useWallet, setUseWallet] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // The pickup starts where the phone is, as on the home screen, until the
  // sender changes it
  const pickupTouched = useRef(false);
  useEffect(() => {
    if (pickupTouched.current || !here?.address) return;
    rememberExactPlace(here.address, here.lat, here.lng);
    setFrom(here.address);
  }, [here]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      parcelService.list('sender').then(p => active && setMine(p)).catch(() => active && setMine([]));
      return () => { active = false; };
    }, []),
  );

  const departure = (() => {
    const d = new Date(date);
    const [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d;
  })();
  const kg = Number(weight);

  const next = async () => {
    const sPhone = toE164(senderPhone);
    const rPhone = toE164(recipientPhone);
    if (from.trim().length < 3 || to.trim().length < 3) return setError(t('shipParcel.errors.places'));
    if (!Number.isFinite(kg) || kg < 0.1 || kg > 50) return setError(t('shipParcel.errors.weight'));
    if (departure.getTime() <= Date.now()) return setError(t('shipParcel.errors.time'));
    if (senderName.trim().length < 2 || !sPhone) return setError(t('shipParcel.errors.sender', { example: REGION.phonePlaceholder }));
    if (recipientName.trim().length < 2 || !rPhone) return setError(t('shipParcel.errors.recipient', { example: REGION.phonePlaceholder }));
    setError('');
    setBusy(true);
    try {
      const [a, b] = await Promise.all([geocodePlace(from), geocodePlace(to)]);
      navigation.navigate('ParcelResults', {
        draft: {
          pickupLocation: { lat: a.lat, lng: a.lng, address: a.formattedAddress, contactPerson: senderName.trim(), contactPhone: sPhone },
          deliveryLocation: { lat: b.lat, lng: b.lng, address: b.formattedAddress, contactPerson: recipientName.trim(), contactPhone: rPhone },
          departureTime: departure.toISOString(),
          parcelWeight: Math.round(kg * 10) / 10,
          parcelType: type,
          specialInstructions: notes.trim() || undefined,
          useWallet,
        },
      });
    } catch (e) {
      setError(errorHandler.process(e).message);
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, value: string, set: (value: string) => void, opts: { placeholder?: string; phone?: boolean } = {}) => (
    <View style={{ flex: 1 }}>
      <Text style={[styles.label, tc.color_textSec]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={set}
        placeholder={opts.placeholder}
        placeholderTextColor={tk.textSec}
        keyboardType={opts.phone ? 'phone-pad' : 'default'}
        accessibilityLabel={label}
        style={[
          styles.input,
          tc.borderColor_border,
          tc.color_text,
          tc.backgroundColor_surface
        ]}
      />
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      <ScreenHeader title={t('shipParcel.sendAParcel')} />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {mine && mine.length > 0 ? (
            <View style={[
              styles.card,
              tc.backgroundColor_surfaceVariant,
              tc.borderColor_surfaceVariant
            ]}>
              <Text style={[styles.cardTitle, tc.color_text]}>{t('shipParcel.yourParcels')}</Text>
              {mine.slice(0, 5).map(p => (
                <Pressable
                  key={p._id}
                  onPress={() => navigation.navigate('ParcelTracking', { trackingNumber: p.trackingNumber })}
                  accessibilityRole="button"
                  style={styles.parcelRow}
                >
                  <Icon name="package-variant-closed" size={20} color={tk.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[{ fontSize: 14, fontWeight: '600' }, tc.color_text]} numberOfLines={1}>
                      To {p.deliveryLocation.contactPerson}, {p.deliveryLocation.address.split(',')[0]}
                    </Text>
                    <Text style={[{ fontSize: 12 }, tc.color_textSec]}>{parcelStage(p).label}</Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={tk.textSec} />
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={[
            styles.card,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant
          ]}>
            <PlaceField label={t('shipParcel.pickUpFrom')} value={from} onChange={text => { pickupTouched.current = true; setFrom(text); }} placeholder={t('shipParcel.whereTheDriverCollectsIt')} near={near} field="from" allowCurrent />
            <PlaceField label={t('shipParcel.deliverTo')} value={to} onChange={setTo} placeholder={t('shipParcel.whereItGoes')} near={near} field="to" />
            <View style={styles.row}>
              <Pressable onPress={() => setShowDate(true)} accessibilityRole="button" style={[styles.picker, tc.borderColor_border, tc.backgroundColor_surface]}>
                <Icon name="calendar" size={18} color={tk.primary} />
                <Text style={tc.color_text}>{date.toLocaleDateString(REGION.dateLocale, { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
              </Pressable>
              <Pressable onPress={() => setShowTime(true)} accessibilityRole="button" style={[styles.picker, tc.borderColor_border, tc.backgroundColor_surface]}>
                <Icon name="clock-outline" size={18} color={tk.primary} />
                <Text style={tc.color_text}>{time}</Text>
              </Pressable>
            </View>
          </View>

          <View style={[
            styles.card,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant
          ]}>
            <Text style={[styles.cardTitle, tc.color_text]}>{t('shipParcel.whatIsIt')}</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {TYPES.map(value => ({ value, label: t(`shipParcel.types.${value}`) })).map(kind => {
                const selected = kind.value === type;
                return (
                  <Pressable
                    key={kind.value}
                    onPress={() => setType(kind.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={[
                      styles.chip,
                      selected ? tc.borderColor_primary : tc.borderColor_border,
                      selected ? tc.backgroundColor_primaryLight : tc.backgroundColor_surface
                    ]}
                  >
                    <Text style={[{ fontSize: 14 }, selected ? tc.color_primary : tc.color_text]}>{kind.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {field(t('shipParcel.weight'), weight, value => setWeight(value.replace(/[^0-9.]/g, '')), { placeholder: t('shipParcel.weightPlaceholder') })}
            {field(t('shipParcel.notes'), notes, setNotes, { placeholder: t('shipParcel.notesPlaceholder') })}
          </View>

          <View style={[
            styles.card,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant
          ]}>
            <Text style={[styles.cardTitle, tc.color_text]}>{t('shipParcel.handedOverBy')}</Text>
            <View style={styles.row}>
              {field(t('shipParcel.name'), senderName, setSenderName)}
              {field(t('shipParcel.mobile'), senderPhone, setSenderPhone, { phone: true })}
            </View>
            <Text style={[styles.cardTitle, tc.color_text]}>{t('shipParcel.receivedBy')}</Text>
            <View style={styles.row}>
              {field(t('shipParcel.name'), recipientName, setRecipientName)}
              {field(t('shipParcel.mobile'), recipientPhone, setRecipientPhone, { phone: true })}
            </View>
            <Text style={[{ fontSize: 12 }, tc.color_textSec]}>
              {t('shipParcel.youGetADeliveryCode')}
            </Text>
          </View>

          <View style={[
            styles.card,
            styles.switchRow,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant
          ]}>
            <Text style={[{ flex: 1, fontSize: 15 }, tc.color_text]}>{t('shipParcel.payFromMyWallet')}</Text>
            <Switch value={useWallet} onValueChange={setUseWallet} accessibilityLabel={t('shipParcel.payFromMyWallet')} trackColor={{ false: tk.border, true: tk.primary }} />
          </View>

          {error ? <Text style={tc.color_error} accessibilityLiveRegion="polite">{error}</Text> : null}
          <Pressable onPress={next} disabled={busy} accessibilityRole="button" style={[styles.primary, tc.backgroundColor_primary]}>
            {busy ? <ActivityIndicator color={tk.textOnPrimary} /> : (
              <Text style={[{ fontSize: 16, fontWeight: '700' }, tc.color_textOnPrimary]}>{t('shipParcel.findDriversOnThisRoute')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
      <RideDatePicker visible={showDate} selectedDate={date} onSelect={setDate} onClose={() => setShowDate(false)} />
      <ClockTimePicker
        visible={showTime}
        initialTime={time}
        onConfirm={value => { setTime(value); setShowTime(false); }}
        onDismiss={() => setShowTime(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 },
  row: { flexDirection: 'row', gap: 10 },
  picker: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, justifyContent: 'center' },
  parcelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  primary: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
