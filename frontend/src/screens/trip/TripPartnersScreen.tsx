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

type Nav = NativeStackNavigationProp<RootStackParamList>;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function TripPartnersScreen() {
  const navigation = useNavigation<Nav>();
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
      tripService.mine().then(t => active && setMine(t)).catch(() => active && setMine([]));
      return () => { active = false; };
    }, []),
  );

  const search = async () => {
    setSearching(true);
    try {
      setResults(await tripService.search({ destination: destination.trim() || undefined, interests, maxBudget: maxBudget ? Number(maxBudget) : undefined }));
    } catch (e) {
      Alert.alert('Search failed', errorHandler.process(e).message);
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
      Alert.alert('Code not found', 'Check the code with the person who shared it.');
    }
  };

  const card = (t: Trip, onPress: () => void, right?: React.ReactNode) => (
    <Pressable key={t._id} onPress={onPress} accessibilityRole="button" style={[styles.tripCard, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }} numberOfLines={1}>{t.title}</Text>
        <Text style={{ fontSize: 13, color: c.textSec }} numberOfLines={1}>
          {t.destinations.map(d => d.name).join(', ')} · {tripDates(t)}
        </Text>
        <Text style={{ fontSize: 12, color: c.textSec }}>
          {t.members.length} of {t.maxGroupSize} going{t.budgetPerPerson ? ` · about ₹${t.budgetPerPerson.toLocaleString('en-IN')} each` : ''}
        </Text>
      </View>
      {right}
    </Pressable>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">Trips</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => navigation.navigate('PlanTrip')} accessibilityRole="button" style={[styles.primary, { backgroundColor: c.primary }]}>
          <Icon name="plus" size={20} color={c.textOnPrimary} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.textOnPrimary }}>Plan a trip</Text>
        </Pressable>

        <Text style={[styles.section, { color: c.text }]} accessibilityRole="header">Your trips</Text>
        {mine === null ? <ActivityIndicator color={c.primary} /> : mine.length === 0 ? (
          <Text style={{ fontSize: 14, color: c.textSec }}>Trips you plan or join appear here.</Text>
        ) : (
          mine.map(t =>
            card(t, () => navigation.navigate('TripDetail', { tripId: t._id }), t.pendingRequests ? (
              <View style={[styles.badge, { backgroundColor: c.primary }]} accessibilityLabel={`${t.pendingRequests} join requests`}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: c.textOnPrimary }}>{t.pendingRequests}</Text>
              </View>
            ) : (
              <Icon name="chevron-right" size={20} color={c.textSec} />
            )),
          )
        )}

        <View style={styles.row}>
          <TextInput
            value={code}
            onChangeText={t => setCode(t.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
            placeholder="Have an invite code?"
            placeholderTextColor={c.textSec}
            autoCapitalize="characters"
            maxLength={20}
            accessibilityLabel="Invite code"
            style={[styles.input, { flex: 1, borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
          />
          <Pressable onPress={openCode} disabled={code.length < 6} accessibilityRole="button" style={[styles.smallBtn, { backgroundColor: code.length >= 6 ? c.primary : c.border }]}>
            <Text style={{ fontWeight: '700', color: code.length >= 6 ? c.textOnPrimary : c.textSec }}>Open</Text>
          </Pressable>
        </View>

        <Text style={[styles.section, { color: c.text }]} accessibilityRole="header">Find travel partners</Text>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <TextInput value={destination} onChangeText={setDestination} placeholder="Where to? (optional)" placeholderTextColor={c.textSec} accessibilityLabel="Destination" style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]} />
          <TextInput value={maxBudget} onChangeText={t => setMaxBudget(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="Budget per person, ₹ (optional)" placeholderTextColor={c.textSec} accessibilityLabel="Budget per person" style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]} />
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
            {searching ? <ActivityIndicator color={c.textOnPrimary} /> : <Text style={{ fontSize: 15, fontWeight: '700', color: c.textOnPrimary }}>Search trips</Text>}
          </Pressable>
        </View>

        {results === null ? null : results.length === 0 ? (
          <Text style={{ fontSize: 14, color: c.textSec }}>No open trips match yet. Plan your own and others can find it.</Text>
        ) : (
          results.map(t =>
            card(t, () => navigation.navigate('TripDetail', { tripId: t._id }), (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: c.primary }}>{t.compatibility}%</Text>
                <Text style={{ fontSize: 11, color: c.textSec }}>match</Text>
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
