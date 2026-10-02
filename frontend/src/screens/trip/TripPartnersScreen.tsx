/**
 * screens/trip/TripPartnersScreen.tsx
 *
 * Trips (UC-T01, UC-T02): the user's own trips, a search for public trips
 * ranked by how well they fit, and a way in with an invite code.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { BackButton } from '../../components/BackButton';
import { Icon } from '../../components/Icon';
import { tripService, tripDates, TRIP_INTERESTS, type Trip } from '../../services/tripService';
import { errorHandler } from '../../utils/errorHandler';
import type { RootStackParamList } from '../../navigation/types';
import { money, moneyInput } from '../../utils/region';
import { useTranslation } from 'react-i18next';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function TripPartnersScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const { c } = useApp();
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
    <Pressable key={item._id} onPress={onPress} accessibilityRole="button" style={[styles.tripCard, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }} numberOfLines={1}>{item.title}</Text>
        <Text style={{ fontSize: 13, color: c.textSec }} numberOfLines={1}>
          {item.destinations.map(d => d.name).join(', ')} · {tripDates(item)}
        </Text>
        <Text style={{ fontSize: 12, color: c.textSec }}>
          {t('tripPartners.going', { count: item.members.length, max: item.maxGroupSize })}{item.budgetPerPerson ? t('tripPartners.about', { amount: money(item.budgetPerPerson) }) : ''}
        </Text>
      </View>
      {right}
    </Pressable>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">{t('tripPartners.trips')}</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => navigation.navigate('PlanTrip')} accessibilityRole="button" style={[styles.primary, { backgroundColor: c.primary }]}>
          <Icon name="plus" size={20} color={c.textOnPrimary} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.textOnPrimary }}>{t('tripPartners.planATrip')}</Text>
        </Pressable>

        <Text style={[styles.section, { color: c.text }]} accessibilityRole="header">{t('tripPartners.yourTrips')}</Text>
        {mine === null ? <ActivityIndicator color={c.primary} /> : mine.length === 0 ? (
          <Text style={{ fontSize: 14, color: c.textSec }}>{t('tripPartners.tripsYouPlanOrJoin')}</Text>
        ) : (
          mine.map(item =>
            card(item, () => navigation.navigate('TripDetail', { tripId: item._id }), item.pendingRequests ? (
              <View style={[styles.badge, { backgroundColor: c.primary }]} accessibilityLabel={`${item.pendingRequests} join requests`}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: c.textOnPrimary }}>{item.pendingRequests}</Text>
              </View>
            ) : (
              <Icon name="chevron-right" size={20} color={c.textSec} />
            )),
          )
        )}

        <View style={styles.row}>
          <TextInput
            value={code}
            onChangeText={value => setCode(value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
            placeholder={t('tripPartners.haveAnInviteCode')}
            placeholderTextColor={c.textSec}
            autoCapitalize="characters"
            maxLength={20}
            accessibilityLabel={t('tripPartners.inviteCode')}
            style={[styles.input, { flex: 1, borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
          />
          <Pressable onPress={openCode} disabled={code.length < 6} accessibilityRole="button" style={[styles.smallBtn, { backgroundColor: code.length >= 6 ? c.primary : c.border }]}>
            <Text style={{ fontWeight: '700', color: code.length >= 6 ? c.textOnPrimary : c.textSec }}>{t('tripPartners.open')}</Text>
          </Pressable>
        </View>

        <Text style={[styles.section, { color: c.text }]} accessibilityRole="header">{t('tripPartners.findTravelPartners')}</Text>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <TextInput value={destination} onChangeText={setDestination} placeholder={t('tripPartners.whereToOptional')} placeholderTextColor={c.textSec} accessibilityLabel={t('tripPartners.destination')} style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]} />
          <TextInput value={maxBudget} onChangeText={value => setMaxBudget(moneyInput(value))} keyboardType="decimal-pad" placeholder={t('tripPartners.budgetPerPersonUsOptional')} placeholderTextColor={c.textSec} accessibilityLabel={t('tripPartners.budgetPerPerson')} style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]} />
          <View style={styles.chips}>
            {TRIP_INTERESTS.map(i => {
              const on = interests.includes(i);
              return (
                <Pressable key={i} onPress={() => setInterests(l => (on ? l.filter(x => x !== i) : [...l, i]))} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={[styles.chip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primaryLight : c.bg }]}>
                  <Text style={{ fontSize: 13, color: on ? c.primary : c.text }}>{cap(i)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={search} disabled={searching} accessibilityRole="button" style={[styles.primary, { backgroundColor: c.primary }]}>
            {searching ? <ActivityIndicator color={c.textOnPrimary} /> : <Text style={{ fontSize: 15, fontWeight: '700', color: c.textOnPrimary }}>{t('tripPartners.searchTrips')}</Text>}
          </Pressable>
        </View>

        {results === null ? null : results.length === 0 ? (
          <Text style={{ fontSize: 14, color: c.textSec }}>{t('tripPartners.noOpenTripsMatchYet')}</Text>
        ) : (
          results.map(item =>
            card(item, () => navigation.navigate('TripDetail', { tripId: item._id }), (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: c.primary }}>{item.compatibility}%</Text>
                <Text style={{ fontSize: 11, color: c.textSec }}>{t('tripPartners.match')}</Text>
                {typeof item.organizer === 'object' && item.organizer.stats?.totalRatingsAsOrganizer ? (
                  <Text style={{ fontSize: 11, color: c.textSec }} accessibilityLabel={t('tripPartners.organiserRated', { rating: item.organizer.stats.avgRatingAsOrganizer?.toFixed(1) })}>{t('tripPartners.organiser', { rating: item.organizer.stats.avgRatingAsOrganizer?.toFixed(1) })}</Text>
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
