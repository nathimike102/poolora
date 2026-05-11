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
import { walletService } from '../../services/walletService';
import { userService } from '../../services/userService';
import type { Transaction } from '../../types/api';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgGrad, Stop, Polyline, Line } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Shadow } from '../../theme';

type Period = 'today' | 'week' | 'month';

/* ── Data ──────────────────────────────────────────────────── */
const todayData = [
  { time: '7AM', amt: 0 },
  { time: '8AM', amt: 220 },
  { time: '9AM', amt: 0 },
  { time: '10AM', amt: 180 },
  { time: '12PM', amt: 0 },
  { time: '2PM', amt: 200 },
  { time: '5PM', amt: 247 },
  { time: '9PM', amt: 0 },
];

const weekData = [
  { time: 'Mon', amt: 650 },
  { time: 'Tue', amt: 820 },
  { time: 'Wed', amt: 940 },
  { time: 'Thu', amt: 760 },
  { time: 'Fri', amt: 1100 },
  { time: 'Sat', amt: 1350 },
  { time: 'Sun', amt: 847 },
];

const monthData = [
  { time: 'W1', amt: 4200 },
  { time: 'W2', amt: 5100 },
  { time: 'W3', amt: 4800 },
  { time: 'W4', amt: 6200 },
];

// Initial mock data as fallback
const initialPeriodStats = {
  today: { earnings: 847, rides: 4, km: 48.2 },
  week: { earnings: 6467, rides: 31, km: 388 },
  month: { earnings: 20300, rides: 124, km: 1520 },
};

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
  
  interface EarningsTransaction {
    id: string;
    type: 'bonus' | 'ride';
    rider: string;
    route: string;
    time: string;
    amount: number;
  }

  const [statsData, setStatsData] = useState(initialPeriodStats);
  const [transactionsData, setTransactionsData] = useState<EarningsTransaction[]>([]);
  const [balance, setBalance] = useState(6320);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      const fetchEarnings = async () => {
        try {
          setLoading(true);
          const [walletRes, txRes, userRes] = await Promise.all([
            walletService.getBalance().catch(() => null),
            walletService.getTransactions().catch(() => null),
            userService.getMyProfile().catch(() => null),
          ]);
          
          if (isActive) {
            let totalEarned = 847;
            let rides = 4;
            let currentBalance = 6320;
            
            if (walletRes) {
              totalEarned = walletRes.totalEarnings || walletRes.balance || 847;
              currentBalance = walletRes.balance || 0;
            }
            if (userRes) {
              rides = userRes.stats?.totalRidesAsDriver || 4;
            }
            if (txRes && txRes.data?.items) {
              setTransactionsData(txRes.data.items.map((tx: Transaction) => ({
                id: tx._id,
                rider: tx.relatedEntity ? 'Ride ID: ' + tx.relatedEntity.slice(-4) : 'User',
                route: tx.description || 'Ride payment',
                time: new Date(tx.createdAt).toLocaleString(),
                amount: tx.amount,
                type: tx.description.toLowerCase().includes('bonus') ? 'bonus' : 'ride'
              })));
            } else {
              setTransactionsData([]);
            }
            
            setBalance(currentBalance);
            
            setStatsData({
              today: { earnings: totalEarned, rides: rides, km: Math.round(rides * 12.5) },
              week: { earnings: totalEarned * 5, rides: rides * 5, km: Math.round(rides * 12.5 * 5) },
              month: { earnings: totalEarned * 20, rides: rides * 20, km: Math.round(rides * 12.5 * 20) },
            });
          }
        } catch (e) {
          console.error(e);
        } finally {
          if (isActive) setLoading(false);
        }
      };
      
      fetchEarnings();
      return () => { isActive = false; };
    }, [])
  );

  const stats = statsData[period];
  const chartData = { today: todayData, week: weekData, month: monthData }[period];

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Gradient header ──────────────────────────────── */}
        <LinearGradient
          colors={['#1A2E4A', c.primary]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.gradientHeader}
        >
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Earnings</Text>
            <Pressable style={styles.reportBtn}>
              <Svg width={16} height={16} viewBox="0 0 24 24">
                <Path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="white" />
              </Svg>
              <Text style={styles.reportText}>Report</Text>
            </Pressable>
          </View>

          {/* Period tabs */}
          <View style={styles.periodBar}>
            {(['today', 'week', 'month'] as Period[]).map(p => {
              const active = period === p;
              return (
                <Pressable key={p} onPress={() => setPeriod(p)} style={styles.flex1}>
                  <View
                    style={[
                      styles.periodTab,
                      active && styles.periodTabActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.periodText,
                        { color: active ? c.primary : 'rgba(255,255,255,0.8)' },
                      ]}
                    >
                      {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </LinearGradient>

        {/* ── Earnings card ────────────────────────────────── */}
        <View style={styles.cardWrap}>
          <View style={[styles.earningsCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={{ fontSize: 12, color: c.textSec, marginBottom: 4 }}>
              {period === 'today' ? "TODAY'S" : period === 'week' ? "THIS WEEK'S" : "THIS MONTH'S"} EARNINGS
            </Text>
            <Text style={{ fontSize: 36, fontWeight: '800', color: c.text }}>
              ₹{stats.earnings.toLocaleString()}
            </Text>
            <Text style={{ fontSize: 13, color: c.success }}>▲ 12% from last {period}</Text>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: c.primary }}>{stats.rides}</Text>
                <Text style={{ fontSize: 12, color: c.textSec }}>Rides</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: c.border }]} />
              <View style={styles.statCol}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: c.primary }}>{stats.km}</Text>
                <Text style={{ fontSize: 12, color: c.textSec }}>km driven</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: c.border }]} />
              <View style={styles.statCol}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: c.primary }}>
                  ₹{stats.rides ? Math.round(stats.earnings / stats.rides) : 0}
                </Text>
                <Text style={{ fontSize: 12, color: c.textSec }}>per ride</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Chart ────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={[styles.chartCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 4 }}>
              Earnings Trend
            </Text>
            <MiniChart data={chartData} color={c.primary} borderColor={c.border} />
          </View>
        </View>

        {/* ── Achievement ──────────────────────────────────── */}
        <View style={styles.section}>
          <LinearGradient
            colors={['#FFB300', '#FF8A50']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.achieveCard}
          >
            <Text style={{ fontSize: 36 }}>🏆</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: 'white' }}>5-Star Streak!</Text>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                All 4 rides today rated 5 stars. Keep it up!
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* ── Transactions ─────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 12 }}>
            Recent Transactions
          </Text>
          <View style={[styles.txList, { backgroundColor: c.surface, borderColor: c.border }]}>
            {transactionsData.length === 0 && !loading ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: c.textSec }}>No transactions found</Text>
              </View>
            ) : transactionsData.map((t, i) => (
              <View key={t.id}>
                {i > 0 && (
                  <View style={[styles.txDivider, { backgroundColor: c.border }]} />
                )}
                <View style={styles.txRow}>
                  <View
                    style={[
                      styles.txIcon,
                      { backgroundColor: t.type === 'bonus' ? c.warningLight : c.successLight },
                    ]}
                  >
                    <Text style={{ fontSize: 20 }}>{t.type === 'bonus' ? '🎁' : '🚗'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{t.rider}</Text>
                    <Text style={{ fontSize: 12, color: c.textSec }}>{t.route}</Text>
                    <Text style={{ fontSize: 11, color: c.textSec }}>{t.time}</Text>
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: c.success }}>
                    +₹{t.amount}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── Payout ───────────────────────────────────────── */}
        <View style={[styles.section, { marginBottom: 8 }]}>
          <View style={[styles.payoutCard, { backgroundColor: c.primaryLight }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>Available for Payout</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: c.primary }}>₹{balance.toLocaleString()}</Text>
              <Text style={{ fontSize: 12, color: c.textSec }}>Next auto-payout: March 1</Text>
            </View>
            <Pressable style={[styles.withdrawBtn, { backgroundColor: c.primary }]}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: 'white' }}>Withdraw</Text>
            </Pressable>
          </View>
        </View>
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
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  reportText: { fontSize: 13, color: 'white', fontWeight: '600' },

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
  achieveCard: { borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },

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
  withdrawBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
});
