import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, Share } from 'react-native';
import { ActivityIndicator } from '../../components/Themed';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Text } from '../../components/Text';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { bookingService } from '../../services/bookingService';
import { userService } from '../../services/userService';
import type { Booking, EarningsStatement } from '../../types/api';
import { errorHandler } from '../../utils/errorHandler';
import { Icon } from '../../components/Icon';
import Svg, { Path, Defs, LinearGradient as SvgGrad, Stop, Polyline, Line } from '../../components/ThemedSvg';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Shadow } from '../../theme';
import { money, REGION } from '../../utils/region';
import { useTranslation } from 'react-i18next';

import { tc, tk, useThemeColor, type AnyColor } from '../../theme/themed';

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

/** 'YYYY-MM' for a month offset from now, in the phone's calendar */
function monthKey(offset: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(REGION.dateLocale, { month: 'long', year: 'numeric' });
}


/**
 * A month's statement (UC-D09): fares, platform fees and earnings, shared as
 * a spreadsheet or emailed to the address on the profile.
 */
function MonthlyStatement() {
  const [offset, setOffset] = useState(0);
  const { t } = useTranslation();
  const [statement, setStatement] = useState<EarningsStatement | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<'share' | 'email' | null>(null);
  const month = monthKey(offset);

  useEffect(() => {
    let active = true;
    setStatement(null);
    setFailed(false);
    userService
      .getStatement(month)
      .then(s => active && setStatement(s))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [month]);

  const share = async () => {
    setBusy('share');
    try {
      const csv = await userService.getStatementCsv(month);
      await Share.share({ title: t('earnings.shareTitle', { month }), message: csv });
    } catch (error) {
      Alert.alert(t('earnings.couldNotShare'), errorHandler.process(error).message);
    } finally {
      setBusy(null);
    }
  };

  const email = async () => {
    setBusy('email');
    try {
      const { to } = await userService.emailStatement(month);
      Alert.alert(t('earnings.statementSent'), `We emailed the ${monthLabel(month)} statement to ${to}.`);
    } catch (error) {
      Alert.alert(t('earnings.notSent'), errorHandler.process(error).message);
    } finally {
      setBusy(null);
    }
  };

  const empty = statement && statement.lines.length === 0;
  return (
    <View style={[
      styles.chartCard,
      { gap: 12 },
      tc.backgroundColor_surfaceVariant,
      tc.borderColor_surfaceVariant
    ]}>
      <View style={styles.monthRow}>
        <Pressable onPress={() => setOffset(o => o - 1)} accessibilityRole="button" accessibilityLabel={t('earnings.previousMonth')} style={styles.monthBtn}>
          <Icon name="chevron-left" size={22} color={tk.text} />
        </Pressable>
        <Text style={[{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700' }, tc.color_text]} accessibilityLiveRegion="polite">
          {monthLabel(month)}
        </Text>
        <Pressable
          onPress={() => setOffset(o => Math.min(0, o + 1))}
          disabled={offset === 0}
          accessibilityRole="button"
          accessibilityLabel={t('earnings.nextMonth')}
          accessibilityState={{ disabled: offset === 0 }}
          style={styles.monthBtn}
        >
          <Icon name="chevron-right" size={22} color={offset === 0 ? tk.border : tk.text} />
        </Pressable>
      </View>

      {failed ? (
        <Text style={[{ fontSize: 14 }, tc.color_textSec]}>{t('earnings.weCouldntLoadThisMonths')}</Text>
      ) : !statement ? (
        <ActivityIndicator color={tk.primary} />
      ) : empty ? (
        <Text style={[{ fontSize: 14 }, tc.color_textSec]}>{t('earnings.noTripsOrCancellationFees')}</Text>
      ) : (
        <View style={{ gap: 6 }}>
          {[
            [t('earnings.lines.trips'), String(statement.totals.trips)],
            [t('earnings.lines.fares'), money(statement.totals.fare)],
            [t('earnings.lines.fees'), `−${money(statement.totals.platformFee)}`],
          ].map(([label, value]) => (
            <View key={label} style={styles.lineRow}>
              <Text style={[{ fontSize: 14 }, tc.color_textSec]}>{label}</Text>
              <Text style={[{ fontSize: 14 }, tc.color_text]}>{value}</Text>
            </View>
          ))}
          <View style={[styles.lineRow, { borderTopWidth: 1, paddingTop: 6 }, tc.borderTopColor_border]}>
            <Text style={[{ fontSize: 15, fontWeight: '700' }, tc.color_text]}>{t('earnings.yourEarnings')}</Text>
            <Text style={[{ fontSize: 15, fontWeight: '800' }, tc.color_success]}>{money(statement.totals.earnings)}</Text>
          </View>
        </View>
      )}

      {statement && !empty ? (
        <View style={styles.lineRow}>
          <Pressable onPress={share} disabled={busy !== null} accessibilityRole="button" style={[styles.stmtBtn, tc.borderColor_primary]}>
            {busy === 'share' ? <ActivityIndicator color={tk.primary} /> : (
              <>
                <Icon name="share-variant-outline" size={18} color={tk.primary} />
                <Text style={[{ fontSize: 14, fontWeight: '700' }, tc.color_primary]}>{t('earnings.shareSpreadsheet')}</Text>
              </>
            )}
          </Pressable>
          <Pressable onPress={email} disabled={busy !== null} accessibilityRole="button" style={[styles.stmtBtn, tc.borderColor_primary]}>
            {busy === 'email' ? <ActivityIndicator color={tk.primary} /> : (
              <>
                <Icon name="email-outline" size={18} color={tk.primary} />
                <Text style={[{ fontSize: 14, fontWeight: '700' }, tc.color_primary]}>{t('earnings.emailItToMe')}</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

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
      time: new Date(from).toLocaleDateString(REGION.dateLocale, { weekday: 'short' }),
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
  color: AnyColor;
  borderColor: AnyColor;
}) {
  // The labels are text, so the chart resolves their colour (and re-renders alone)
  const labelColor = useThemeColor(borderColor);
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
          <Text key={i} style={[styles.xLabel, { color: labelColor }]}>
            {d.time}
          </Text>
        ))}
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export function EarningsScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
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
              rider: b.rider?.name ?? t('common.rider'),
              route: [b.pickup?.address, b.dropoff?.address].filter(Boolean).join(' to '),
              time: new Date(b.updatedAt).toLocaleString(REGION.dateLocale, { dateStyle: 'medium', timeStyle: 'short' }),
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
    }, [t]),
  );

  const stats = summary?.[period];
  const periodLabel = period === 'today' ? 'Today' : period === 'week' ? t('earnings.last7Days') : t('earnings.last4Weeks');

  return (
    <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title={t('earnings.earnings')} noBack={!navigation.canGoBack()} />

        {/* Period tabs */}
        <View style={[styles.periodBar, tc.backgroundColor_surfaceVariant]} accessibilityRole="tablist">
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
                <View style={[styles.periodTab, active && tc.backgroundColor_surfaceVariant]}>
                  <Text style={[styles.periodText, active ? tc.color_text : tc.color_textSec]}>
                    {p === 'today' ? t('earnings.period.today') : p === 'week' ? t('earnings.period.week') : t('earnings.period.month')}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {loadError ? (
          <View style={styles.section}>
            <View style={[
              styles.chartCard,
              { alignItems: 'center' },
              tc.backgroundColor_surfaceVariant,
              tc.borderColor_surfaceVariant
            ]}>
              <Text style={[{ fontSize: 15, fontWeight: '600' }, tc.color_text]}>{t('earnings.weCouldntLoadYourEarnings')}</Text>
              <Text style={[{ fontSize: 13, marginTop: 4 }, tc.color_textSec]}>{t('earnings.pullBackToThisScreen')}</Text>
            </View>
          </View>
        ) : (
          <>
            {/* ── Earnings card ────────────────────────────── */}
            <View style={styles.cardWrap}>
              <View style={[
                styles.earningsCard,
                tc.backgroundColor_surfaceVariant,
                tc.borderColor_surfaceVariant
              ]}>
                <Text style={[{ fontSize: 12, marginBottom: 4 }, tc.color_textSec]}>
                  {periodLabel.toUpperCase()}
                </Text>
                {loading || !stats ? (
                  <View style={[styles.skeleton, tc.backgroundColor_surfaceVariant]} />
                ) : (
                  <Text style={[{ fontSize: 36, fontWeight: '800' }, tc.color_text]}>
                    {money(stats.earnings)}
                  </Text>
                )}

                <View style={styles.statsRow}>
                  <View style={styles.statCol}>
                    <Text style={[{ fontSize: 22, fontWeight: '800' }, tc.color_primary]}>{stats?.rides ?? 0}</Text>
                    <Text style={[{ fontSize: 12 }, tc.color_textSec]}>{t('earnings.completedRides')}</Text>
                  </View>
                  <View style={[styles.statDivider, tc.backgroundColor_border]} />
                  <View style={styles.statCol}>
                    <Text style={[{ fontSize: 22, fontWeight: '800' }, tc.color_primary]}>
                      {money(stats?.rides ? Math.round(stats.earnings / stats.rides) : 0)}
                    </Text>
                    <Text style={[{ fontSize: 12 }, tc.color_textSec]}>{t('earnings.averagePerRide')}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ── Chart ────────────────────────────────────── */}
            {stats && stats.rides > 0 && (
              <View style={styles.section}>
                <View style={[
                  styles.chartCard,
                  tc.backgroundColor_surfaceVariant,
                  tc.borderColor_surfaceVariant
                ]}>
                  <Text style={[{ fontSize: 15, fontWeight: '700', marginBottom: 4 }, tc.color_text]}>
                    {t('earnings.earningsOverTime')}
                  </Text>
                  <MiniChart data={stats.chart} color={tk.primary} borderColor={tk.textSec} />
                </View>
              </View>
            )}

            {/* ── Recent completed rides ───────────────────── */}
            <View style={styles.section}>
              <Text style={[{ fontSize: 16, fontWeight: '700', marginBottom: 12 }, tc.color_text]}>
                {t('earnings.recentCompletedRides')}
              </Text>
              <View style={[
                styles.txList,
                tc.backgroundColor_surfaceVariant,
                tc.borderColor_surfaceVariant
              ]}>
                {recent.length === 0 && !loading ? (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={[{ textAlign: 'center' }, tc.color_textSec]}>
                      {t('earnings.completedRidesAndWhatYou')}
                    </Text>
                  </View>
                ) : (
                  recent.map((t, i) => (
                    <View key={t.id}>
                      {i > 0 && <View style={[styles.txDivider, tc.backgroundColor_border]} />}
                      <View style={styles.txRow}>
                        <View style={[styles.txIcon, tc.backgroundColor_successLight]}>
                          <Icon name="car" size={22} color={tk.success} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[{ fontSize: 14, fontWeight: '600' }, tc.color_text]}>{t.rider}</Text>
                          {t.route ? <Text style={[{ fontSize: 12 }, tc.color_textSec]}>{t.route}</Text> : null}
                          <Text style={[{ fontSize: 11 }, tc.color_textSec]}>{t.time}</Text>
                        </View>
                        <Text style={[{ fontSize: 16, fontWeight: '700' }, tc.color_success]}>
                          +{money(t.amount)}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* ── Monthly statement ────────────────────────── */}
            <View style={styles.section}>
              <Text style={[{ fontSize: 16, fontWeight: '700', marginBottom: 12 }, tc.color_text]}>{t('earnings.monthlyStatement')}</Text>
              <MonthlyStatement />
            </View>

            {/* ── Lifetime ─────────────────────────────────── */}
            {lifetime && (
              <View style={[styles.section, { marginBottom: 8 }]}>
                <View style={[styles.payoutCard, tc.backgroundColor_primaryLight]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[{ fontSize: 14, fontWeight: '700' }, tc.color_text]}>{t('earnings.allTimeEarnings')}</Text>
                    <Text style={[{ fontSize: 22, fontWeight: '800' }, tc.color_primary]}>
                      {money(lifetime.earnings)}
                    </Text>
                    <Text style={[{ fontSize: 12 }, tc.color_textSec]}>
                      {lifetime.rides === 1 ? t('earnings.fromOne') : t('earnings.fromMany', { count: lifetime.rides })}
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

  /* Period */
  periodBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 4,
  },
  periodTab: { height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  periodText: { fontSize: 13, fontWeight: '600' },

  /* Earnings card */
  cardWrap: { paddingHorizontal: 20, marginTop: 16 },
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

  /* Statement */
  monthRow: { flexDirection: 'row', alignItems: 'center' },
  monthBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  stmtBtn: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1.5,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
