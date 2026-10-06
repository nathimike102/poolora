/**
 * screens/trip/TripPartnersScreen.tsx
 *
 * Trips (UC-T01, UC-T02): the user's own trips, a search for public trips
 * ranked by how well they fit, and a way in with an invite code.
 */

import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { ActivityIndicator } from '../../components/Themed';
import { Text, TextInput } from '../../components/Text';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import { PlaceField } from '../../components/PlaceField';
import { Icon } from '../../components/Icon';
import { tripService, tripDates, TRIP_INTERESTS, type Trip } from '../../services/tripService';
import { errorHandler } from '../../utils/errorHandler';
import type { RootStackParamList } from '../../navigation/types';
import { money, moneyInput } from '../../utils/region';
import { useTranslation } from 'react-i18next';
import { tc, tk } from '../../theme/themed';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function TripPartnersScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [mine, setMine] = useState<Trip[] | null>(null);
  const [destination, setDestination] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [maxBudget, setMaxBudget] = useState('');
  const [results, setResults] = useState<Trip[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [code, setCode] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      tripService.mine().then(item => active && setMine(item)).catch(() => active && setMine([]));
      return () => { active = false; };
    }, []),
  );

  const search = async () => {
    setSearching(true);
    try {
      setResults(await tripService.search({ destination: destination.trim() || undefined, interests, maxBudget: maxBudget ? Number(maxBudget) : undefined }));
    } catch (e) {
      Alert.alert(t('tripPartners.searchFailed'), errorHandler.process(e).message);
    } finally {
      setSearching(false);
    }
  };

  const openCode = async () => {
    try {
      const trip = await tripService.byInvite(code);
      navigation.navigate('TripDetail', { tripId: trip._id, code: code.trim().toUpperCase() });
      setCode('');
    } catch {
      Alert.alert(t('tripPartners.codeNotFound'), t('tripPartners.checkTheCodeWithThe'));
    }
  };

  const card = (item: Trip, onPress: () => void, right?: React.ReactNode) => (
    <Pressable key={item._id} onPress={onPress} accessibilityRole="button" style={[
      styles.tripCard,
      tc.backgroundColor_surfaceVariant,
      tc.borderColor_surfaceVariant
    ]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[{ fontSize: 15, fontWeight: '700' }, tc.color_text]} numberOfLines={1}>{item.title}</Text>
        <Text style={[{ fontSize: 13 }, tc.color_textSec]} numberOfLines={1}>
          {item.destinations.map(d => d.name).join(', ')} · {tripDates(item)}
        </Text>
        <Text style={[{ fontSize: 12 }, tc.color_textSec]}>
          {t('tripPartners.going', { count: item.members.length, max: item.maxGroupSize })}{item.budgetPerPerson ? t('tripPartners.about', { amount: money(item.budgetPerPerson) }) : ''}
        </Text>
      </View>
      {right}
    </Pressable>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      <ScreenHeader title={t('tripPartners.trips')} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => navigation.navigate('PlanTrip')} accessibilityRole="button" style={[styles.primary, tc.backgroundColor_primary]}>
          <Icon name="plus" size={20} color={tk.textOnPrimary} />
          <Text style={[{ fontSize: 16, fontWeight: '700' }, tc.color_textOnPrimary]}>{t('tripPartners.planATrip')}</Text>
        </Pressable>

        <Text style={[styles.section, tc.color_text]} accessibilityRole="header">{t('tripPartners.yourTrips')}</Text>
        {mine === null ? <ActivityIndicator color={tk.primary} /> : mine.length === 0 ? (
          <Text style={[{ fontSize: 14 }, tc.color_textSec]}>{t('tripPartners.tripsYouPlanOrJoin')}</Text>
        ) : (
          mine.map(item =>
            card(item, () => navigation.navigate('TripDetail', { tripId: item._id }), item.pendingRequests ? (
              <View style={[styles.badge, tc.backgroundColor_primary]} accessibilityLabel={`${item.pendingRequests} join requests`}>
                <Text style={[{ fontSize: 12, fontWeight: '700' }, tc.color_textOnPrimary]}>{item.pendingRequests}</Text>
              </View>
            ) : (
              <Icon name="chevron-right" size={20} color={tk.textSec} />
            )),
          )
        )}

        <View style={styles.row}>
          <TextInput
            value={code}
            onChangeText={value => setCode(value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
            placeholder={t('tripPartners.haveAnInviteCode')}
            placeholderTextColor={tk.textSec}
            autoCapitalize="characters"
            maxLength={20}
            accessibilityLabel={t('tripPartners.inviteCode')}
            style={[
              styles.input,
              { flex: 1 },
              tc.borderColor_surfaceVariant,
              tc.color_text,
              tc.backgroundColor_surfaceVariant
            ]}
          />
          <Pressable onPress={openCode} disabled={code.length < 6} accessibilityRole="button" style={[styles.smallBtn, code.length >= 6 ? tc.backgroundColor_primary : tc.backgroundColor_border]}>
            <Text style={[{ fontWeight: '700' }, code.length >= 6 ? tc.color_textOnPrimary : tc.color_textSec]}>{t('tripPartners.open')}</Text>
          </Pressable>
        </View>

        <Text style={[styles.section, tc.color_text]} accessibilityRole="header">{t('tripPartners.findTravelPartners')}</Text>
        <View style={[
          styles.card,
          tc.backgroundColor_surfaceVariant,
          tc.borderColor_surfaceVariant
        ]}>
          <PlaceField label={t('tripPartners.destination')} value={destination} onChange={setDestination} placeholder={t('tripPartners.whereToOptional')} />
          <TextInput value={maxBudget} onChangeText={value => setMaxBudget(moneyInput(value))} keyboardType="decimal-pad" placeholder={t('tripPartners.budgetPerPersonUsOptional')} placeholderTextColor={tk.textSec} accessibilityLabel={t('tripPartners.budgetPerPerson')} style={[
            styles.input,
            tc.borderColor_border,
            tc.color_text,
            tc.backgroundColor_surface
          ]} />
          <View style={styles.chips}>
            {TRIP_INTERESTS.map(i => {
              const on = interests.includes(i);
              return (
                <Pressable key={i} onPress={() => setInterests(l => (on ? l.filter(x => x !== i) : [...l, i]))} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={[
                  styles.chip,
                  on ? tc.borderColor_primary : tc.borderColor_border,
                  on ? tc.backgroundColor_primaryLight : tc.backgroundColor_surface
                ]}>
                  <Text style={[{ fontSize: 13 }, on ? tc.color_primary : tc.color_text]}>{cap(i)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={search} disabled={searching} accessibilityRole="button" style={[styles.primary, tc.backgroundColor_primary]}>
            {searching ? <ActivityIndicator color={tk.textOnPrimary} /> : <Text style={[{ fontSize: 15, fontWeight: '700' }, tc.color_textOnPrimary]}>{t('tripPartners.searchTrips')}</Text>}
          </Pressable>
        </View>

        {results === null ? null : results.length === 0 ? (
          <Text style={[{ fontSize: 14 }, tc.color_textSec]}>{t('tripPartners.noOpenTripsMatchYet')}</Text>
        ) : (
          results.map(item =>
            card(item, () => navigation.navigate('TripDetail', { tripId: item._id }), (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[{ fontSize: 18, fontWeight: '800' }, tc.color_primary]}>{item.compatibility}%</Text>
                <Text style={[{ fontSize: 11 }, tc.color_textSec]}>{t('tripPartners.match')}</Text>
                {typeof item.organizer === 'object' && item.organizer.stats?.totalRatingsAsOrganizer ? (
                  <Text style={[{ fontSize: 11 }, tc.color_textSec]} accessibilityLabel={t('tripPartners.organiserRated', { rating: item.organizer.stats.avgRatingAsOrganizer?.toFixed(1) })}>{t('tripPartners.organiser', { rating: item.organizer.stats.avgRatingAsOrganizer?.toFixed(1) })}</Text>
                ) : null}
              </View>
            )),
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  section: { fontSize: 17, fontWeight: '700', marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  tripCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 12, justifyContent: 'center' },
  primary: { minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  smallBtn: { minHeight: 48, borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center' },
  badge: { minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
