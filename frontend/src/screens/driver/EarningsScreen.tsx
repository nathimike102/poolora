import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { bookingService } from '../../services/bookingService';
import { userService } from '../../services/userService';
import type { Booking } from '../../types/api';
import { Icon } from '../../components/Icon';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgGrad, Stop, Polyline, Line } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Shadow } from '../../theme';

type Period = 'today' | 'week' | 'month';

/* ── Data ──────────────────────────────────────────────────── */
type Point = { time: string; amt: number };

interface PeriodSummary {
  earnings: number;
  rides: number;
  chart: Point[];
}

interface CompletedTrip {
  id: string;
  rider: string;
  route: string;
  time: string;
  amount: number;
}

const DAY_MS = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Builds period totals and chart buckets from real completed bookings. */
function summarise(bookings: Booking[], now = new Date()): Record<Period, PeriodSummary> {
  const today = startOfDay(now);
  const trips = bookings
    .filter(b => typeof b.driverEarnings === 'number')
    .map(b => ({ at: new Date(b.updatedAt).getTime(), amt: b.driverEarnings as number }));

  const sumIn = (from: number, to: number) =>
    trips.filter(t => t.at >= from && t.at < to).reduce((acc, t) => acc + t.amt, 0);
  const countIn = (from: number, to: number) => trips.filter(t => t.at >= from && t.at < to).length;
  const end = now.getTime() + 1;

  const hourBlocks = [0, 6, 10, 14, 18, 24];
  const todayChart = hourBlocks.slice(0, -1).map((h, k) => ({
    time: ['12AM', '6AM', '10AM', '2PM', '6PM'][k],
    amt: sumIn(today + h * 3_600_000, today + hourBlocks[k + 1] * 3_600_000),
  }));

  const weekChart = Array.from({ length: 7 }, (_, k) => {
    const from = today - (6 - k) * DAY_MS;
    return {
      time: new Date(from).toLocaleDateString([], { weekday: 'short' }),
      amt: sumIn(from, from + DAY_MS),
    };
  });

  const monthChart = Array.from({ length: 4 }, (_, k) => {
    const from = today - (27 - k * 7) * DAY_MS;
    return { time: `W${k + 1}`, amt: sumIn(from, from + 7 * DAY_MS) };
  });

  const weekStart = today - 6 * DAY_MS;
  const monthStart = today - 27 * DAY_MS;
  return {
    today: { earnings: sumIn(today, end), rides: countIn(today, end), chart: todayChart },
    week: { earnings: sumIn(weekStart, end), rides: countIn(weekStart, end), chart: weekChart },
    month: { earnings: sumIn(monthStart, end), rides: countIn(monthStart, end), chart: monthChart },
  };
}

/* ── Mini area chart (SVG) ────────────────────────────────── */
const CHART_W = 300;
const CHART_H = 100;
const CHART_PAD = 8;

function MiniChart({
  data,
  color,
  borderColor,
}: {
  data: { time: string; amt: number }[];
  color: string;
  borderColor: string;
}) {
  const maxV = Math.max(...data.map(d => d.amt), 1);
  const pts = data.map((d, i) => {
    const x = CHART_PAD + (i / (data.length - 1)) * (CHART_W - CHART_PAD * 2);
    const y = CHART_H - CHART_PAD - (d.amt / maxV) * (CHART_H - CHART_PAD * 2);
    return { x, y };
  });
  const line = pts.map(p => `${p.x},${p.y}`).join(' ');
  const areaPath = `M${pts[0].x},${CHART_H} ${pts.map(p => `L${p.x},${p.y}`).join(' ')} L${pts[pts.length - 1].x},${CHART_H} Z`;

  return (
    <View style={{ marginTop: 8 }}>
      <Svg width="100%" height={CHART_H + 24} viewBox={`0 0 ${CHART_W} ${CHART_H + 24}`}>
        <Defs>
          <SvgGrad id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="5%" stopColor={color} stopOpacity={0.2} />
            <Stop offset="95%" stopColor={color} stopOpacity={0} />
          </SvgGrad>
        </Defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const y = CHART_PAD + f * (CHART_H - CHART_PAD * 2);
          return (
            <Line
              key={f}
              x1={CHART_PAD}
              y1={y}
              x2={CHART_W - CHART_PAD}
              y2={y}
              stroke={borderColor}
              strokeDasharray="3,3"
              strokeWidth={0.8}
            />
          );
        })}

        {/* Area fill */}
        <Path d={areaPath} fill="url(#areaGrad)" />

        {/* Line */}
        <Polyline points={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />

        {/* X-axis labels */}
        {pts.map((p, i) => (
          <Svg key={i} x={p.x} y={CHART_H + 6}>
            <Path d="M0 0" />
          </Svg>
        ))}
      </Svg>

      {/* X labels (RN Text – positioned below) */}
      <View style={styles.xLabels}>
        {data.map((d, i) => (
          <Text key={i} style={[styles.xLabel, { color: borderColor }]}>
            {d.time}
          </Text>
        ))}
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export function EarningsScreen() {
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>('today');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [summary, setSummary] = useState<Record<Period, PeriodSummary> | null>(null);
  const [recent, setRecent] = useState<CompletedTrip[]>([]);
  const [lifetime, setLifetime] = useState<{ earnings: number; rides: number } | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      (async () => {
        setLoading(true);
        setLoadError(false);
        try {
          const [bookingsRes, profile] = await Promise.all([
            bookingService.getDriverBookings(1, 100, 'completed'),
            userService.getMyProfile().catch(() => null),
          ]);
          if (!isActive) return;
          const bookings = bookingsRes.data?.items ?? [];
          setSummary(summarise(bookings));
          setRecent(
            bookings.slice(0, 10).map(b => ({
              id: b._id,
              rider: b.rider?.name ?? 'Rider',
              route: [b.pickup?.address, b.dropoff?.address].filter(Boolean).join(' to '),
              time: new Date(b.updatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
              amount: b.driverEarnings ?? 0,
            })),
          );
          if (profile?.stats) {
            setLifetime({ earnings: profile.stats.totalEarnings, rides: profile.stats.totalRidesAsDriver });
          }
        } catch {
          if (isActive) setLoadError(true);
        } finally {
          if (isActive) setLoading(false);
        }
      })();
      return () => {
        isActive = false;
      };
    }, []),
  );

  const stats = summary?.[period];
  const periodLabel = period === 'today' ? 'Today' : period === 'week' ? 'Last 7 days' : 'Last 4 weeks';

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────── */}
        <LinearGradient
          colors={['#0B2447', c.primary]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.gradientHeader}
        >
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle} accessibilityRole="header">Earnings</Text>
          </View>

          {/* Period tabs */}
          <View style={styles.periodBar} accessibilityRole="tablist">
            {(['today', 'week', 'month'] as Period[]).map(p => {
              const active = period === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setPeriod(p)}
                  style={styles.flex1}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <View style={[styles.periodTab, active && styles.periodTabActive]}>
                    <Text style={[styles.periodText, { color: active ? c.primary : '#FFFFFF' }]}>
                      {p === 'today' ? 'Today' : p === 'week' ? '7 days' : '4 weeks'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </LinearGradient>

        {loadError ? (
          <View style={styles.section}>
            <View style={[styles.chartCard, { backgroundColor: c.surface, borderColor: c.border, alignItems: 'center' }]}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>We couldn't load your earnings</Text>
              <Text style={{ fontSize: 13, color: c.textSec, marginTop: 4 }}>Pull back to this screen to try again.</Text>
            </View>
          </View>
        ) : (
          <>
            {/* ── Earnings card ────────────────────────────── */}
            <View style={styles.cardWrap}>
              <View style={[styles.earningsCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={{ fontSize: 12, color: c.textSec, marginBottom: 4 }}>
                  {periodLabel.toUpperCase()}
                </Text>
                {loading || !stats ? (
                  <View style={[styles.skeleton, { backgroundColor: c.surfaceVariant }]} />
                ) : (
                  <Text style={{ fontSize: 36, fontWeight: '800', color: c.text }}>
                    ₹{stats.earnings.toLocaleString('en-IN')}
                  </Text>
                )}

                <View style={styles.statsRow}>
                  <View style={styles.statCol}>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: c.primary }}>{stats?.rides ?? 0}</Text>
                    <Text style={{ fontSize: 12, color: c.textSec }}>Completed rides</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: c.border }]} />
                  <View style={styles.statCol}>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: c.primary }}>
                      ₹{stats?.rides ? Math.round(stats.earnings / stats.rides) : 0}
                    </Text>
                    <Text style={{ fontSize: 12, color: c.textSec }}>Average per ride</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ── Chart ────────────────────────────────────── */}
            {stats && stats.rides > 0 && (
              <View style={styles.section}>
                <View style={[styles.chartCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 4 }}>
                    Earnings over time
                  </Text>
                  <MiniChart data={stats.chart} color={c.primary} borderColor={c.textSec} />
                </View>
              </View>
            )}

            {/* ── Recent completed rides ───────────────────── */}
            <View style={styles.section}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 12 }}>
                Recent completed rides
              </Text>
              <View style={[styles.txList, { backgroundColor: c.surface, borderColor: c.border }]}>
                {recent.length === 0 && !loading ? (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: c.textSec, textAlign: 'center' }}>
                      Completed rides and what you earned from them will appear here.
                    </Text>
                  </View>
                ) : (
                  recent.map((t, i) => (
                    <View key={t.id}>
                      {i > 0 && <View style={[styles.txDivider, { backgroundColor: c.border }]} />}
                      <View style={styles.txRow}>
                        <View style={[styles.txIcon, { backgroundColor: c.successLight }]}>
                          <Icon name="car" size={22} color={c.success} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{t.rider}</Text>
                          {t.route ? <Text style={{ fontSize: 12, color: c.textSec }}>{t.route}</Text> : null}
                          <Text style={{ fontSize: 11, color: c.textSec }}>{t.time}</Text>
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: c.success }}>
                          +₹{t.amount.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* ── Lifetime ─────────────────────────────────── */}
            {lifetime && (
              <View style={[styles.section, { marginBottom: 8 }]}>
                <View style={[styles.payoutCard, { backgroundColor: c.primaryLight }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>All-time earnings</Text>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: c.primary }}>
                      ₹{lifetime.earnings.toLocaleString('en-IN')}
                    </Text>
                    <Text style={{ fontSize: 12, color: c.textSec }}>
                      From {lifetime.rides} completed {lifetime.rides === 1 ? 'ride' : 'rides'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  /* Header */
  gradientHeader: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: 'white' },

  /* Period */
  periodBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 4,
  },
  periodTab: { height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  periodTabActive: { backgroundColor: 'white' },
  periodText: { fontSize: 13, fontWeight: '600' },

  /* Earnings card */
  cardWrap: { paddingHorizontal: 20, marginTop: -12 },
  skeleton: { height: 40, width: 160, borderRadius: 8, marginVertical: 2 },
  earningsCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    ...Shadow.md,
  },
  statsRow: { flexDirection: 'row', gap: 16, marginTop: 16 },
  statCol: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1 },

  /* Chart */
  section: { paddingHorizontal: 20, marginTop: 16 },
  chartCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  xLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  xLabel: { fontSize: 11 },

  /* Achievement */

  /* Transactions */
  txList: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  txDivider: { height: 1, marginLeft: 16 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  txIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  /* Payout */
  payoutCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
