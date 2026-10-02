/**
 * ImpactScreen.tsx
 *
 * What sharing rides has saved (UC-R11): CO₂, kilometres and trips, all time
 * and this month, the last six months as bars, and how it is worked out. The
 * figure is an estimate and the screen always says so.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { BackButton } from '../../components/BackButton';
import { Icon } from '../../components/Icon';
import { userService } from '../../services/userService';
import type { Impact } from '../../types/api';
import { errorHandler } from '../../utils/errorHandler';
import { formatKg, formatKm, monthLabel, petrolLitres } from '../../utils/carbon';

const BAR_HEIGHT = 120;

export function ImpactScreen() {
  const navigation = useNavigation();
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const [impact, setImpact] = useState<Impact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMethod, setShowMethod] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError(null);
      userService
        .getImpact()
        .then(i => { if (active) setImpact(i); })
        .catch(e => { if (active) setError(errorHandler.process(e).message); });
      return () => { active = false; };
    }, []),
  );

  const all = impact?.allTime;
  const peak = Math.max(...(impact?.months.map(m => m.co2SavedKg) ?? [0]), 0.1);
  const litres = all ? petrolLitres(all.co2SavedKg) : 0;

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '700', color: c.text }}>Your impact</Text>
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {!impact && !error ? <ActivityIndicator color={c.primary} /> : null}
        {error ? (
          <View style={[s.banner, { backgroundColor: c.errorLight }]}>
            <Icon name="alert-circle-outline" size={22} color={c.error} />
            <Text style={{ flex: 1, color: c.text }}>Could not load your impact. {error}</Text>
          </View>
        ) : null}

        {all && all.trips === 0 ? (
          <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Icon name="leaf" size={28} color={c.success} />
            <Text style={[s.cardTitle, { color: c.text }]}>Nothing counted yet</Text>
            <Text style={{ color: c.textSec, lineHeight: 21 }}>
              Every trip you share, as a rider or a driver, saves the CO₂ of someone driving alone. Your savings appear here after your first completed trip.
            </Text>
          </View>
        ) : null}

        {all && all.trips > 0 ? (
          <>
            <View
              style={[s.hero, { backgroundColor: c.successLight }]}
              accessible
              accessibilityLabel={`About ${formatKg(all.co2SavedKg)} of CO₂ saved by sharing, an estimate`}
            >
              <Icon name="leaf" size={28} color={c.success} />
              <Text style={[s.heroValue, { color: c.text }]}>{formatKg(all.co2SavedKg)}</Text>
              <Text style={{ color: c.text, fontWeight: '600' }}>of CO₂ saved by sharing, an estimate</Text>
              {litres >= 1 ? (
                <Text style={{ color: c.textSec }}>About what burning {litres} {litres === 1 ? 'litre' : 'litres'} of petrol gives off</Text>
              ) : null}
            </View>

            <View style={s.row}>
              <View style={[s.tile, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={[s.tileValue, { color: c.text }]}>{formatKm(all.kmShared)}</Text>
                <Text style={{ color: c.textSec }}>shared</Text>
              </View>
              <View style={[s.tile, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={[s.tileValue, { color: c.text }]}>{all.trips}</Text>
                <Text style={{ color: c.textSec }}>{all.trips === 1 ? 'trip shared' : 'trips shared'}</Text>
              </View>
            </View>

            <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={[s.cardTitle, { color: c.text }]}>This month</Text>
              <Text style={{ color: c.textSec }}>
                {impact!.thisMonth.trips > 0
                  ? `${formatKg(impact!.thisMonth.co2SavedKg)} saved over ${impact!.thisMonth.trips} ${impact!.thisMonth.trips === 1 ? 'trip' : 'trips'}`
                  : 'No shared trips yet this month'}
              </Text>
              <View style={s.chart} accessibilityLabel="CO₂ saved in each of the last six months">
                {impact!.months.map(m => (
                  <View
                    key={m.month}
                    style={s.barCol}
                    accessible
                    accessibilityLabel={`${monthLabel(m.month)}: ${formatKg(m.co2SavedKg)}`}
                  >
                    <View style={[s.barTrack, { height: BAR_HEIGHT }]}>
                      <View
                        style={{
                          height: m.co2SavedKg > 0 ? Math.max(4, (m.co2SavedKg / peak) * BAR_HEIGHT) : 0,
                          backgroundColor: c.success,
                          borderTopLeftRadius: 4,
                          borderTopRightRadius: 4,
                        }}
                      />
                    </View>
                    <Text style={{ color: c.textSec, fontSize: 12 }}>{monthLabel(m.month)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : null}

        {impact ? (
          <Pressable
            onPress={() => setShowMethod(v => !v)}
            style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}
            accessibilityRole="button"
            accessibilityState={{ expanded: showMethod }}
          >
            <View style={[s.row, { alignItems: 'center', justifyContent: 'space-between' }]}>
              <Text style={[s.cardTitle, { color: c.text }]}>How we count</Text>
              <Icon name={showMethod ? 'chevron-up' : 'chevron-down'} size={22} color={c.textSec} />
            </View>
            {showMethod ? (
              <Text style={{ color: c.textSec, lineHeight: 21 }}>
                For each shared trip we measure the rider's part of the route. Had they driven it alone, an average car gives off about {impact.method.baselineKgPerKm} kg of CO₂ a km. Sharing, they are only responsible for their seats' part of the car they rode in, worked out from that car's size and how many people were in it. The difference is the saving, and it counts for both the rider and the driver.{'\n\n'}
                It is an estimate. We count one car per booking, however many seats it has; we leave out the driver's small detour to the pickup; and we assume the rider would otherwise have driven. If you would have taken a kombi or a bus, you saved less than this.
              </Text>
            ) : null}
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1 },
  body: { padding: 20, gap: 14, paddingBottom: 40 },
  banner: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: 14 },
  hero: { borderRadius: 18, padding: 20, gap: 6, alignItems: 'flex-start' },
  heroValue: { fontSize: 36, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 16, gap: 2 },
  tileValue: { fontSize: 22, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  chart: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 4 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { width: '70%', justifyContent: 'flex-end' },
});
