/**
 * screens/driver/EditRideScreen.tsx
 *
 * Change a published ride (UC-D08): move the departure by up to 2 hours,
 * add seats, or change the price by up to 20% while nobody has booked.
 * Allowed until 4 hours before departure. Booked riders are told, and a new
 * departure time lets them cancel for a full refund.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { BackButton } from '../../components/BackButton';
import { Icon } from '../../components/Icon';
import type { RootStackParamList } from '../../navigation/types';
import { rideService } from '../../services/rideService';
import type { Ride } from '../../types/api';
import { errorHandler } from '../../utils/errorHandler';

const STEP_MINS = 15;
const MAX_SHIFT_MINS = 120;
const MAX_PRICE_CHANGE = 0.2;
const EDIT_CUTOFF_HOURS = 4;

function timeLabel(d: Date): string {
  return d.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function EditRideScreen() {
  const { rideId } = useRoute<RouteProp<RootStackParamList, 'EditRide'>>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [ride, setRide] = useState<Ride | null>(null);
  const [shiftMins, setShiftMins] = useState(0);
  const [seats, setSeats] = useState(0);
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      rideService
        .getRide(rideId)
        .then(r => {
          setRide(r);
          setSeats(r.seats ?? 0);
          setPrice(String(r.pricePerSeat));
          setShiftMins(0);
        })
        .catch(() => Alert.alert('Could not load the ride', 'Check your connection and try again.'));
    }, [rideId]),
  );

  if (!ride) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.primary} accessibilityLabel="Loading ride" />
      </View>
    );
  }

  const original = new Date(ride.scheduledDeparture);
  const departure = new Date(original.getTime() + shiftMins * 60_000);
  const hoursLeft = (original.getTime() - Date.now()) / 3_600_000;
  const tooLate = hoursLeft < EDIT_CUTOFF_HOURS;
  const booked = (ride.seats ?? 0) - (ride.availableSeats ?? 0);
  const priceLocked = booked > 0;
  const priceNum = Number(price);
  const minPrice = Math.ceil(ride.pricePerSeat * (1 - MAX_PRICE_CHANGE));
  const maxPrice = Math.floor(ride.pricePerSeat * (1 + MAX_PRICE_CHANGE));
  const priceValid = priceLocked || (Number.isFinite(priceNum) && priceNum >= minPrice && priceNum <= maxPrice);
  const changed = shiftMins !== 0 || seats !== ride.seats || (!priceLocked && priceNum !== ride.pricePerSeat);

  const save = async () => {
    setSaving(true);
    try {
      await rideService.updateRide(rideId, {
        ...(shiftMins !== 0 ? { departureTime: departure.toISOString() } : {}),
        ...(seats !== ride.seats ? { totalSeats: seats } : {}),
        ...(!priceLocked && priceNum !== ride.pricePerSeat ? { pricePerSeat: priceNum } : {}),
      });
      Alert.alert(
        'Ride updated',
        booked > 0 ? 'Your riders have been told about the change.' : 'Riders searching now see the new details.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      Alert.alert('Not changed', errorHandler.process(error).message);
    } finally {
      setSaving(false);
    }
  };

  const stepper = (label: string, value: string, onMinus: () => void, onPlus: () => void, minusDisabled: boolean, plusDisabled: boolean) => (
    <View style={styles.stepper}>
      <Pressable onPress={onMinus} disabled={minusDisabled} accessibilityRole="button" accessibilityLabel={`Less ${label}`}
        style={[styles.stepBtn, { borderColor: c.border, opacity: minusDisabled ? 0.4 : 1 }]}>
        <Icon name="minus" size={20} color={c.text} />
      </Pressable>
      <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: c.text }} accessibilityLiveRegion="polite">{value}</Text>
      <Pressable onPress={onPlus} disabled={plusDisabled} accessibilityRole="button" accessibilityLabel={`More ${label}`}
        style={[styles.stepBtn, { borderColor: c.border, opacity: plusDisabled ? 0.4 : 1 }]}>
        <Icon name="plus" size={20} color={c.text} />
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">Change ride</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {tooLate ? (
          <View style={[styles.note, { backgroundColor: c.errorLight }]}>
            <Text style={{ color: c.error, fontSize: 14 }}>
              Rides can be changed until {EDIT_CUTOFF_HOURS} hours before departure. If you cannot go, cancel the ride; your riders are refunded in full.
            </Text>
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.label, { color: c.textSec }]}>Departure</Text>
          {stepper(
            'time',
            timeLabel(departure),
            () => setShiftMins(m => m - STEP_MINS),
            () => setShiftMins(m => m + STEP_MINS),
            tooLate || shiftMins <= -MAX_SHIFT_MINS || departure.getTime() - STEP_MINS * 60_000 <= Date.now(),
            tooLate || shiftMins >= MAX_SHIFT_MINS,
          )}
          <Text style={[styles.help, { color: c.textSec }]}>
            Up to 2 hours earlier or later. {booked > 0 ? 'Booked riders can cancel for a full refund if the new time does not suit them.' : ''}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.label, { color: c.textSec }]}>Seats</Text>
          {stepper('seats', `${seats} seats`, () => setSeats(n => n - 1), () => setSeats(n => n + 1), tooLate || seats <= (ride.seats ?? 1), tooLate || seats >= 8)}
          <Text style={[styles.help, { color: c.textSec }]}>You can add seats. Riders who booked keep theirs.</Text>
        </View>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.label, { color: c.textSec }]}>Price per seat (₹)</Text>
          <TextInput
            value={price}
            onChangeText={t => setPrice(t.replace(/[^0-9]/g, ''))}
            editable={!priceLocked && !tooLate}
            keyboardType="number-pad"
            accessibilityLabel="Price per seat in rupees"
            style={[styles.input, { borderColor: priceValid ? c.border : c.error, color: c.text, opacity: priceLocked ? 0.5 : 1 }]}
          />
          <Text style={[styles.help, { color: priceValid ? c.textSec : c.error }]}>
            {priceLocked ? 'The price is fixed once someone has booked or asked for a seat.' : `Between ₹${minPrice} and ₹${maxPrice} (up to 20% change).`}
          </Text>
        </View>

        <Pressable
          onPress={save}
          disabled={!changed || !priceValid || saving || tooLate}
          accessibilityRole="button"
          style={[styles.save, { backgroundColor: changed && priceValid && !tooLate ? c.primary : c.border }]}
        >
          {saving ? <ActivityIndicator color={c.textOnPrimary} /> : (
            <Text style={{ fontSize: 16, fontWeight: '700', color: changed && priceValid && !tooLate ? c.textOnPrimary : c.textSec }}>Save changes</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  content: { padding: 20, gap: 16 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  label: { fontSize: 12, fontWeight: '600' },
  help: { fontSize: 13 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 16 },
  note: { borderRadius: 12, padding: 12 },
  save: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
