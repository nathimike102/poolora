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
import { useTranslation } from 'react-i18next';

const BAR_HEIGHT = 120;

export function ImpactScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
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
        <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '700', color: c.text }}>{t('impact.yourImpact')}</Text>
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {!impact && !error ? <ActivityIndicator color={c.primary} /> : null}
        {error ? (
          <View style={[s.banner, { backgroundColor: c.errorLight }]}>
            <Icon name="alert-circle-outline" size={22} color={c.error} />
            <Text style={{ flex: 1, color: c.text }}>{t('impact.loadFailed', { error })}</Text>
          </View>
        ) : null}

        {all && all.trips === 0 ? (
          <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Icon name="leaf" size={28} color={c.success} />
            <Text style={[s.cardTitle, { color: c.text }]}>{t('impact.nothingCountedYet')}</Text>
            <Text style={{ color: c.textSec, lineHeight: 21 }}>
              {t('impact.everyTripYouShareAs')}
            </Text>
          </View>
        ) : null}

        {all && all.trips > 0 ? (
          <>
            <View
              style={[s.hero, { backgroundColor: c.successLight }]}
              accessible
              accessibilityLabel={t('impact.heroLabel', { amount: formatKg(all.co2SavedKg) })}
            >
              <Icon name="leaf" size={28} color={c.success} />
              <Text style={[s.heroValue, { color: c.text }]}>{formatKg(all.co2SavedKg)}</Text>
              <Text style={{ color: c.text, fontWeight: '600' }}>{t('impact.ofCoSavedBySharing')}</Text>
              {litres >= 1 ? (
                <Text style={{ color: c.textSec }}>{litres === 1 ? t('impact.litresOne') : t('impact.litresMany', { count: litres })}</Text>
              ) : null}
            </View>

            <View style={s.row}>
              <View style={[s.tile, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={[s.tileValue, { color: c.text }]}>{formatKm(all.kmShared)}</Text>
                <Text style={{ color: c.textSec }}>{t('impact.shared')}</Text>
              </View>
              <View style={[s.tile, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={[s.tileValue, { color: c.text }]}>{all.trips}</Text>
                <Text style={{ color: c.textSec }}>{all.trips === 1 ? 'trip shared' : 'trips shared'}</Text>
              </View>
            </View>

            <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={[s.cardTitle, { color: c.text }]}>{t('impact.thisMonth')}</Text>
              <Text style={{ color: c.textSec }}>
                {impact!.thisMonth.trips > 0
                  ? impact!.thisMonth.trips === 1
                    ? t('impact.monthOne', { amount: formatKg(impact!.thisMonth.co2SavedKg) })
                    : t('impact.monthMany', { amount: formatKg(impact!.thisMonth.co2SavedKg), count: impact!.thisMonth.trips })
                  : t('impact.monthNone')}
              </Text>
              <View style={s.chart} accessibilityLabel={t('impact.coSavedInEachOf')}>
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
              <Text style={[s.cardTitle, { color: c.text }]}>{t('impact.howWeCount')}</Text>
              <Icon name={showMethod ? 'chevron-up' : 'chevron-down'} size={22} color={c.textSec} />
            </View>
            {showMethod ? (
              <Text style={{ color: c.textSec, lineHeight: 21 }}>
                {t('impact.method1', { kg: impact.method.baselineKgPerKm })}{'\n\n'}{t('impact.method2')}
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
