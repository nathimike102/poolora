/**
 * screens/parcel/ShipParcelScreen.tsx
 *
 * Send a parcel with a driver who is already making the trip (UC-P01):
 * where it goes, when, what it is, and who hands it over and receives it.
 * The next screen lists rides on that route. The sender's parcels are
 * listed first so they can follow them.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Switch, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { BackButton } from '../../components/BackButton';
import { Icon } from '../../components/Icon';
import { PlaceField } from '../../components/PlaceField';
import { RideDatePicker } from '../../components/RideDatePicker';
import { ClockTimePicker } from '../../components/ClockTimePicker';
import { useCurrentPlace } from '../../hooks/useCurrentPlace';
import { geocodePlace } from '../../services/placesService';
import { parcelService, parcelStage, type Parcel, type ParcelType } from '../../services/parcelService';
import { realPhone } from '../../utils/phone';
import { errorHandler } from '../../utils/errorHandler';
import type { RootStackParamList } from '../../navigation/types';
import { toE164 } from '../../utils/region';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TYPES: Array<{ value: ParcelType; label: string }> = [
  { value: 'document', label: 'Documents' },
  { value: 'general', label: 'Package' },
  { value: 'fragile', label: 'Fragile' },
  { value: 'perishable', label: 'Food or perishable' },
];


export function ShipParcelScreen() {
  const navigation = useNavigation<Nav>();
  const { c, user } = useApp();
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
    if (from.trim().length < 3 || to.trim().length < 3) return setError('Choose where the parcel is picked up and where it goes.');
    if (!Number.isFinite(kg) || kg < 0.1 || kg > 50) return setError('The weight must be between 0.1 and 50 kg.');
    if (departure.getTime() <= Date.now()) return setError('Choose a time in the future.');
    if (senderName.trim().length < 2 || !sPhone) return setError('Add the name and 10-digit mobile of the person handing it over.');
    if (recipientName.trim().length < 2 || !rPhone) return setError('Add the name and 10-digit mobile of the person receiving it.');
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

  const field = (label: string, value: string, set: (t: string) => void, opts: { placeholder?: string; phone?: boolean } = {}) => (
    <View style={{ flex: 1 }}>
      <Text style={[styles.label, { color: c.textSec }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={set}
        placeholder={opts.placeholder}
        placeholderTextColor={c.textSec}
        keyboardType={opts.phone ? 'phone-pad' : 'default'}
        accessibilityLabel={label}
        style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
      />
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">Send a parcel</Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {mine && mine.length > 0 ? (
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={[styles.cardTitle, { color: c.text }]}>Your parcels</Text>
              {mine.slice(0, 5).map(p => (
                <Pressable
                  key={p._id}
                  onPress={() => navigation.navigate('ParcelTracking', { trackingNumber: p.trackingNumber })}
                  accessibilityRole="button"
                  style={styles.parcelRow}
                >
                  <Icon name="package-variant-closed" size={20} color={c.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }} numberOfLines={1}>
                      To {p.deliveryLocation.contactPerson}, {p.deliveryLocation.address.split(',')[0]}
                    </Text>
                    <Text style={{ fontSize: 12, color: c.textSec }}>{parcelStage(p).label}</Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={c.textSec} />
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <PlaceField label="Pick up from" value={from} onChange={setFrom} placeholder="Where the driver collects it" near={near} />
            <PlaceField label="Deliver to" value={to} onChange={setTo} placeholder="Where it goes" near={near} />
            <View style={styles.row}>
              <Pressable onPress={() => setShowDate(true)} accessibilityRole="button" style={[styles.picker, { borderColor: c.border, backgroundColor: c.bg }]}>
                <Icon name="calendar" size={18} color={c.primary} />
                <Text style={{ color: c.text }}>{date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
              </Pressable>
              <Pressable onPress={() => setShowTime(true)} accessibilityRole="button" style={[styles.picker, { borderColor: c.border, backgroundColor: c.bg }]}>
                <Icon name="clock-outline" size={18} color={c.primary} />
                <Text style={{ color: c.text }}>{time}</Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>What is it?</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {TYPES.map(t => {
                const selected = t.value === type;
                return (
                  <Pressable
                    key={t.value}
                    onPress={() => setType(t.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={[styles.chip, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primaryLight : c.bg }]}
                  >
                    <Text style={{ fontSize: 14, color: selected ? c.primary : c.text }}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {field('Weight (kg)', weight, t => setWeight(t.replace(/[^0-9.]/g, '')), { placeholder: 'Up to 50 kg' })}
            {field('Notes for the driver (optional)', notes, setNotes, { placeholder: 'Keep upright; ring the bell' })}
          </View>

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Handed over by</Text>
            <View style={styles.row}>
              {field('Name', senderName, setSenderName)}
              {field('Mobile', senderPhone, setSenderPhone, { phone: true })}
            </View>
            <Text style={[styles.cardTitle, { color: c.text }]}>Received by</Text>
            <View style={styles.row}>
              {field('Name', recipientName, setRecipientName)}
              {field('Mobile', recipientPhone, setRecipientPhone, { phone: true })}
            </View>
            <Text style={{ fontSize: 12, color: c.textSec }}>
              You get a delivery code to give the recipient. The driver needs it to hand the parcel over.
            </Text>
          </View>

          <View style={[styles.card, styles.switchRow, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={{ flex: 1, fontSize: 15, color: c.text }}>Pay from my wallet</Text>
            <Switch value={useWallet} onValueChange={setUseWallet} accessibilityLabel="Pay from my wallet" trackColor={{ false: c.border, true: c.primary }} />
          </View>

          {error ? <Text style={{ color: c.error }} accessibilityLiveRegion="polite">{error}</Text> : null}
          <Pressable onPress={next} disabled={busy} accessibilityRole="button" style={[styles.primary, { backgroundColor: c.primary }]}>
            {busy ? <ActivityIndicator color={c.textOnPrimary} /> : (
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.textOnPrimary }}>Find drivers on this route</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
      <RideDatePicker visible={showDate} selectedDate={date} onSelect={setDate} onClose={() => setShowDate(false)} />
      <ClockTimePicker
        visible={showTime}
        initialTime={time}
        onConfirm={t => { setTime(t); setShowTime(false); }}
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
