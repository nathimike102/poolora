/**
 * screens/shared/WalletScreen.tsx
 *
 * The Poolora wallet: balance, topping up (paid through Paynow on the
 * Payment screen), withdrawing to EcoCash, OneMoney or InnBucks, and recent
 * activity. Refunds and drivers' earnings land here, so withdrawing is how
 * money gets back to a mobile money account. A person sends each withdrawal,
 * so it shows as waiting until then; a waiting one can be cancelled.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import type { RootStackParamList } from '../../navigation/types';
import { BackButton } from '../../components/BackButton';
import { Radius, Spacing, Typography } from '../../theme';
import { walletService } from '../../services/walletService';
import { errorHandler } from '../../utils/errorHandler';
import { realPhone } from '../../utils/phone';
import { formatPhone, money, moneyInput, nationalDigits, REGION } from '../../utils/region';
import type { Transaction, Withdrawal } from '../../types/api';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TOP_UPS = [5, 10, 20, 50];
const MIN_TOP_UP = 1;
const MAX_TOP_UP = 500;
const MIN_WITHDRAWAL = 2;
const CHANNELS: Array<{ id: Withdrawal['channel']; label: string }> = [
  { id: 'ecocash', label: 'EcoCash' },
  { id: 'onemoney', label: 'OneMoney' },
  { id: 'innbucks', label: 'InnBucks' },
];
const CHANNEL_LABEL: Record<Withdrawal['channel'], string> = { ecocash: 'EcoCash', onemoney: 'OneMoney', innbucks: 'InnBucks' };
const MONEY_IN = new Set<Transaction['type']>(['topup', 'refund', 'coin_conversion', 'merge_in']);

function withdrawalLine(w: Withdrawal): string {
  switch (w.status) {
    case 'pending': return 'Waiting to be sent, usually within one working day';
    case 'paid': return `Sent${w.payoutReference ? `, reference ${w.payoutReference}` : ''}`;
    case 'rejected': return `Not sent, back in your wallet${w.note ? `: ${w.note}` : ''}`;
    default: return 'Cancelled, back in your wallet';
  }
}

export function WalletScreen() {
  const navigation = useNavigation<Nav>();
  const { c, user } = useApp();
  const insets = useSafeAreaInsets();
  const ownPhone = realPhone(user?.phone);

  const [balance, setBalance] = useState<number | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [activity, setActivity] = useState<Transaction[]>([]);
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [topUp, setTopUp] = useState('10');
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState<Withdrawal['channel']>(ownPhone && /^\+26371/.test(ownPhone) ? 'onemoney' : 'ecocash');
  const [payNumber, setPayNumber] = useState(ownPhone ? `0${nationalDigits(ownPhone)}` : '');
  const [sending, setSending] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [wallet, list, tx] = await Promise.all([
        walletService.getBalance(),
        walletService.withdrawals(),
        walletService.getTransactions(1, 15),
      ]);
      setBalance(wallet.balance);
      setWithdrawals(list);
      setActivity(tx.data.items);
    } catch (e) {
      setLoadError(errorHandler.process(e).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const topUpAmount = Number(topUp);
  const topUpOk = topUpAmount >= MIN_TOP_UP && topUpAmount <= MAX_TOP_UP;
  const amountNum = Number(amount);
  const numberOk = REGION.mobilePattern.test(nationalDigits(payNumber));
  const pending = withdrawals.find(w => w.status === 'pending');
  // Below the minimum, the whole balance can still be withdrawn (small refunds must not get stuck)
  const wholeSmallBalance = balance !== null && balance > 0 && balance < MIN_WITHDRAWAL && amountNum === Math.round(balance * 100) / 100;
  const canWithdraw = !pending && numberOk && (amountNum >= MIN_WITHDRAWAL || wholeSmallBalance) && balance !== null && amountNum <= balance;

  const withdraw = () => {
    Alert.alert(
      `Withdraw ${money(amountNum)}?`,
      `It leaves your wallet now and is sent to ${CHANNEL_LABEL[channel]} ${payNumber}, usually within one working day. You can cancel until it is sent.`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Withdraw',
          onPress: async () => {
            setWithdrawError('');
            setSending(true);
            try {
              await walletService.withdraw({ amount: amountNum, channel, payNumber });
              setAmount('');
              await load();
            } catch (e) {
              setWithdrawError(errorHandler.process(e).message);
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );
  };

  const cancel = async (w: Withdrawal) => {
    try {
      await walletService.cancelWithdrawal(w._id);
      await load();
    } catch (e) {
      Alert.alert('Could not cancel', errorHandler.process(e).message);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text accessibilityRole="header" style={[styles.headerTitle, { color: c.text }]}>Wallet</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['2xl'] }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={[styles.card, { backgroundColor: c.primary, borderColor: c.primary }]}>
          <Text style={{ fontSize: Typography.base, color: c.textOnPrimary, opacity: 0.85 }}>Balance</Text>
          {balance === null && !loadError ? (
            <ActivityIndicator color={c.textOnPrimary} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
          ) : (
            <Text style={{ fontSize: 36, fontWeight: '800', color: c.textOnPrimary, marginTop: 4 }} accessibilityLiveRegion="polite">
              {balance === null ? 'Unavailable' : money(balance)}
            </Text>
          )}
          <Text style={{ fontSize: 13, color: c.textOnPrimary, opacity: 0.85, marginTop: 6 }}>Refunds and earnings arrive here. Pay for rides with it, or withdraw it.</Text>
        </View>
        {loadError ? (
          <View style={[styles.notice, { backgroundColor: c.errorLight }]}>
            <Text style={{ color: c.text }}>{loadError}</Text>
            <Pressable onPress={load} accessibilityRole="button" style={styles.linkBtn}><Text style={{ color: c.primary, fontWeight: '600' }}>Try again</Text></Pressable>
          </View>
        ) : null}

        {/* Top up */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>Top up</Text>
          <View style={styles.chips}>
            {TOP_UPS.map(v => (
              <Pressable
                key={v}
                onPress={() => setTopUp(String(v))}
                accessibilityRole="radio"
                accessibilityState={{ checked: topUpAmount === v }}
                style={[styles.chip, { borderColor: topUpAmount === v ? c.primary : c.border, backgroundColor: topUpAmount === v ? c.primaryLight : 'transparent' }]}
              >
                <Text style={{ fontWeight: '700', color: c.text }}>{money(v)}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={topUp}
            onChangeText={t => setTopUp(moneyInput(t))}
            keyboardType="decimal-pad"
            accessibilityLabel="Top-up amount in US dollars"
            style={[styles.input, { borderColor: topUpOk || !topUp ? c.border : c.error, color: c.text }]}
          />
          <Text style={{ fontSize: 12, color: c.textSec }}>{money(MIN_TOP_UP)} to {money(MAX_TOP_UP)}, by EcoCash, OneMoney, InnBucks or card.</Text>
          <Pressable
            onPress={() => navigation.navigate('Payment', { amount: topUpAmount, summary: 'Poolora wallet top-up' })}
            disabled={!topUpOk}
            accessibilityRole="button"
            accessibilityState={{ disabled: !topUpOk }}
            style={[styles.btn, { backgroundColor: c.primary, opacity: topUpOk ? 1 : 0.5 }]}
          >
            <Text style={{ color: c.textOnPrimary, fontWeight: '700', fontSize: 16 }}>Top up {topUpOk ? money(topUpAmount) : ''}</Text>
          </Pressable>
        </View>

        {/* Withdraw */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>Withdraw to mobile money</Text>
          {pending ? (
            <Text style={{ fontSize: 14, color: c.textSec }}>You have a withdrawal waiting to be sent. You can make another once it is done.</Text>
          ) : (
            <>
              <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Send to">
                {CHANNELS.map(ch => (
                  <Pressable
                    key={ch.id}
                    onPress={() => setChannel(ch.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: channel === ch.id }}
                    style={[styles.chip, { borderColor: channel === ch.id ? c.primary : c.border, backgroundColor: channel === ch.id ? c.primaryLight : 'transparent' }]}
                  >
                    <Text style={{ fontWeight: '700', color: c.text }}>{ch.label}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={payNumber}
                onChangeText={setPayNumber}
                keyboardType="phone-pad"
                placeholder="0771 234 567"
                placeholderTextColor={c.textSec}
                accessibilityLabel={`${CHANNEL_LABEL[channel]} number`}
                style={[styles.input, { borderColor: numberOk || !payNumber ? c.border : c.error, color: c.text }]}
              />
              <TextInput
                value={amount}
                onChangeText={t => setAmount(moneyInput(t))}
                keyboardType="decimal-pad"
                placeholder={`Amount, at least ${money(MIN_WITHDRAWAL)}, or all of a smaller balance`}
                placeholderTextColor={c.textSec}
                accessibilityLabel="Amount to withdraw in US dollars"
                style={[styles.input, { borderColor: c.border, color: c.text }]}
              />
              {balance !== null && balance > 0 ? (
                <Pressable onPress={() => setAmount(String(Math.floor(balance * 100) / 100))} accessibilityRole="button" style={styles.linkBtn}>
                  <Text style={{ color: c.primary, fontWeight: '600' }}>Withdraw all ({money(balance)})</Text>
                </Pressable>
              ) : null}
              {withdrawError ? <Text style={{ color: c.error }}>{withdrawError}</Text> : null}
              <Pressable
                onPress={withdraw}
                disabled={!canWithdraw || sending}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canWithdraw || sending, busy: sending }}
                style={[styles.btn, { borderWidth: 1.5, borderColor: c.primary, opacity: canWithdraw ? 1 : 0.5 }]}
              >
                {sending ? <ActivityIndicator color={c.primary} /> : <Text style={{ color: c.primary, fontWeight: '700', fontSize: 16 }}>Withdraw</Text>}
              </Pressable>
            </>
          )}
          {withdrawals.slice(0, 5).map(w => (
            <View key={w._id} style={[styles.item, { borderColor: c.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600', color: c.text }}>{money(w.amount)} to {CHANNEL_LABEL[w.channel]} {formatPhone(w.payNumber)}</Text>
                <Text style={{ fontSize: 12, color: c.textSec }}>{withdrawalLine(w)}</Text>
              </View>
              {w.status === 'pending' ? (
                <Pressable onPress={() => cancel(w)} accessibilityRole="button" accessibilityLabel={`Cancel the ${money(w.amount)} withdrawal`} style={styles.linkBtn}>
                  <Text style={{ color: c.error, fontWeight: '600' }}>Cancel</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>

        {/* Activity */}
        {activity.length ? (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Recent activity</Text>
            {activity.map(t => {
              const moneyIn = MONEY_IN.has(t.type);
              return (
                <View key={t._id} style={[styles.item, { borderColor: c.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text }} numberOfLines={2}>{t.description}</Text>
                    <Text style={{ fontSize: 12, color: c.textSec }}>
                      {new Date(t.createdAt).toLocaleDateString(REGION.dateLocale, { day: 'numeric', month: 'short' })}{t.status === 'pending' ? ' · processing' : ''}
                    </Text>
                  </View>
                  <Text style={{ fontWeight: '700', color: moneyIn ? c.success : c.text }}>{moneyIn ? '+' : '−'}{money(t.amount)}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontSize: Typography['2xl'], fontWeight: Typography.bold },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.xl, gap: 10 },
  cardTitle: { fontSize: Typography.lg, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: Radius.full, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 12, minHeight: 48, fontSize: 16 },
  btn: { minHeight: 50, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  notice: { borderRadius: Radius.md, padding: Spacing.md },
  linkBtn: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
});
