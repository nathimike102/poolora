/**
 * screens/driver/EditRideScreen.tsx
 *
 * Change a published ride (UC-D08): move the departure by up to 2 hours,
 * add seats, or change the price by up to 20% while nobody has booked.
 * Allowed until 4 hours before departure. Booked riders are told, and a new
 * departure time lets them cancel for a full refund.
 */

import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { ActivityIndicator } from '../../components/Themed';
import { Text, TextInput } from '../../components/Text';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import { Icon } from '../../components/Icon';
import type { RootStackParamList } from '../../navigation/types';
import { rideService } from '../../services/rideService';
import type { Ride } from '../../types/api';
import { errorHandler } from '../../utils/errorHandler';
import { money, moneyInput, REGION } from '../../utils/region';
import { useTranslation } from 'react-i18next';
import { tc, tk } from '../../theme/themed';

const STEP_MINS = 15;
const MAX_SHIFT_MINS = 120;
const MAX_PRICE_CHANGE = 0.2;
const EDIT_CUTOFF_HOURS = 4;

function timeLabel(d: Date): string {
  return d.toLocaleString(REGION.dateLocale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function EditRideScreen() {
  const { rideId } = useRoute<RouteProp<RootStackParamList, 'EditRide'>>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
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
        .catch(() => Alert.alert(t('editRide.couldNotLoadTheRide'), t('editRide.checkYourConnectionAndTry')));
    }, [rideId, t]),
  );

  if (!ride) {
    return (
      <View style={[styles.root, styles.center, tc.backgroundColor_surface]}>
        <ActivityIndicator color={tk.primary} accessibilityLabel={t('editRide.loadingRide')} />
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
        t('editRide.rideUpdated'),
        booked > 0 ? t('editRide.yourRidersHaveBeenTold') : t('editRide.ridersSearchingNowSeeThe'),
        [{ text: t('editRide.ok'), onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      Alert.alert(t('editRide.notChanged'), errorHandler.process(error).message);
    } finally {
      setSaving(false);
    }
  };

  const stepper = (label: string, value: string, onMinus: () => void, onPlus: () => void, minusDisabled: boolean, plusDisabled: boolean) => (
    <View style={styles.stepper}>
      <Pressable onPress={onMinus} disabled={minusDisabled} accessibilityRole="button" accessibilityLabel={t('editRide.less', { what: label })}
        style={[styles.stepBtn, { opacity: minusDisabled ? 0.4 : 1 }, tc.borderColor_border]}>
        <Icon name="minus" size={20} color={tk.text} />
      </Pressable>
      <Text style={[{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' }, tc.color_text]} accessibilityLiveRegion="polite">{value}</Text>
      <Pressable onPress={onPlus} disabled={plusDisabled} accessibilityRole="button" accessibilityLabel={t('editRide.more', { what: label })}
        style={[styles.stepBtn, { opacity: plusDisabled ? 0.4 : 1 }, tc.borderColor_border]}>
        <Icon name="plus" size={20} color={tk.text} />
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      <ScreenHeader title={t('editRide.changeRide')} />
      <ScrollView contentContainerStyle={styles.content}>
        {tooLate ? (
          <View style={[styles.note, tc.backgroundColor_errorLight]}>
            <Text style={[{ fontSize: 14 }, tc.color_error]}>
              Rides can be changed until {EDIT_CUTOFF_HOURS} hours before departure. If you cannot go, cancel the ride; your riders are refunded in full.
            </Text>
          </View>
        ) : null}

        <View style={[
          styles.card,
          tc.backgroundColor_surfaceVariant,
          tc.borderColor_surfaceVariant
        ]}>
          <Text style={[styles.label, tc.color_textSec]}>{t('editRide.departure')}</Text>
          {stepper(
            t('editRide.what.time'),
            timeLabel(departure),
            () => setShiftMins(m => m - STEP_MINS),
            () => setShiftMins(m => m + STEP_MINS),
            tooLate || shiftMins <= -MAX_SHIFT_MINS || departure.getTime() - STEP_MINS * 60_000 <= Date.now(),
            tooLate || shiftMins >= MAX_SHIFT_MINS,
          )}
          <Text style={[styles.help, tc.color_textSec]}>
            {booked > 0 ? t('editRide.timeHelpBooked') : t('editRide.timeHelp')}
          </Text>
        </View>

        <View style={[
          styles.card,
          tc.backgroundColor_surfaceVariant,
          tc.borderColor_surfaceVariant
        ]}>
          <Text style={[styles.label, tc.color_textSec]}>{t('editRide.seats')}</Text>
          {stepper(t('editRide.what.seats'), t('editRide.seatsValue', { count: seats }), () => setSeats(n => n - 1), () => setSeats(n => n + 1), tooLate || seats <= (ride.seats ?? 1), tooLate || seats >= 8)}
          <Text style={[styles.help, tc.color_textSec]}>{t('editRide.youCanAddSeatsRiders')}</Text>
        </View>

        <View style={[
          styles.card,
          tc.backgroundColor_surfaceVariant,
          tc.borderColor_surfaceVariant
        ]}>
          <Text style={[styles.label, tc.color_textSec]}>{t('editRide.pricePerSeatUs')}</Text>
          <TextInput
            value={price}
            onChangeText={t => setPrice(moneyInput(t))}
            editable={!priceLocked && !tooLate}
            keyboardType="decimal-pad"
            accessibilityLabel={t('editRide.pricePerSeatInUs')}
            style={[
              styles.input,
              { opacity: priceLocked ? 0.5 : 1 },
              priceValid ? tc.borderColor_border : tc.borderColor_error,
              tc.color_text
            ]}
          />
          <Text style={[styles.help, priceValid ? tc.color_textSec : tc.color_error]}>
            {priceLocked ? t('editRide.priceLocked') : t('editRide.priceRange', { min: money(minPrice), max: money(maxPrice) })}
          </Text>
        </View>

        <Pressable
          onPress={save}
          disabled={!changed || !priceValid || saving || tooLate}
          accessibilityRole="button"
          style={[styles.save, changed && priceValid && !tooLate ? tc.backgroundColor_primary : tc.backgroundColor_border]}
        >
          {saving ? <ActivityIndicator color={tk.textOnPrimary} /> : (
            <Text style={[
              { fontSize: 16, fontWeight: '700' },
              changed && priceValid && !tooLate ? tc.color_textOnPrimary : tc.color_textSec
            ]}>{t('editRide.saveChanges')}</Text>
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
