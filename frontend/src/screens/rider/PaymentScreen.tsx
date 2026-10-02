/**
 * screens/rider/PaymentScreen.tsx
 *
 * Pays online through Paynow: a seat request, a parcel, or a wallet top-up.
 * The payer picks EcoCash, OneMoney, InnBucks or card, and US dollars or ZiG
 * when ZiG is offered. Then:
 * - EcoCash and OneMoney push a prompt to their phone to approve with the PIN
 * - InnBucks gives a code to enter or scan in the InnBucks app
 * - card opens Paynow's page in the browser
 * The screen then asks the backend where the payment stands every few
 * seconds. It never marks a payment paid on its own: only Paynow's answer,
 * checked by the backend, does.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput, ScrollView, Linking, AppState } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../../navigation/types';
import { BackButton } from '../../components/BackButton';
import { Icon, type IconName } from '../../components/Icon';
import { Radius, Spacing, Typography } from '../../theme';
import { bookingService } from '../../services/bookingService';
import { parcelService } from '../../services/parcelService';
import { paymentService } from '../../services/paymentService';
import { errorHandler } from '../../utils/errorHandler';
import { realPhone } from '../../utils/phone';
import { money, nationalDigits, REGION } from '../../utils/region';
import type { Charge, PayChannel, PayCurrency } from '../../types/api';
import { useTranslation } from 'react-i18next';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type PayRoute = RouteProp<RootStackParamList, 'Payment'>;

const POLL_MS = 4_000;
/** Stop asking on our own after this; the payer can still check again */
const POLL_FOR_MS = 5 * 60_000;

/** Names and help lines are in the catalogue under payment.methods */
const METHODS: Array<{ id: PayChannel; icon: IconName }> = [
  { id: 'ecocash', icon: 'cellphone' },
  { id: 'onemoney', icon: 'cellphone' },
  { id: 'innbucks', icon: 'qrcode' },
  { id: 'card', icon: 'credit-card-outline' },
];

/** EcoCash is on Econet (077, 078), OneMoney on NetOne (071) */
function suggestedChannel(phone?: string): PayChannel {
  return phone && /^\+26371/.test(phone) ? 'onemoney' : 'ecocash';
}

export function PaymentScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<PayRoute>();
  const { c, user } = useApp();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const ownPhone = realPhone(user?.phone);
  const purpose = params.parcelId ? 'parcel' : params.bookingId ? 'booking' : 'topup';

  const [channel, setChannel] = useState<PayChannel>(suggestedChannel(ownPhone));
  const [phone, setPhone] = useState(ownPhone ? `0${nationalDigits(ownPhone)}` : '');
  const [currency, setCurrency] = useState<PayCurrency>('USD');
  const [zwgRate, setZwgRate] = useState<number | null>(null);
  const [charge, setCharge] = useState<Charge | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [pollingStopped, setPollingStopped] = useState(false);
  const startedAt = useRef(0);

  useEffect(() => {
    paymentService
      .options()
      .then(o => {
        const zwg = o.currencies.find(x => x.code === 'ZWG');
        if (zwg?.enabled && zwg.zwgPerUsd) setZwgRate(zwg.zwgPerUsd);
      })
      .catch(() => undefined);
  }, []);

  const mobile = channel !== 'card';
  const phoneOk = !mobile || REGION.mobilePattern.test(nationalDigits(phone));
  const toPay = currency === 'ZWG' && zwgRate ? money(Math.round(params.amount * zwgRate * 100) / 100, 'ZWG') : money(params.amount);

  const pay = useCallback(async () => {
    setError('');
    setStarting(true);
    try {
      const input = { channel, phone: mobile ? phone : undefined, currency };
      const started = purpose === 'topup'
        ? await paymentService.topUp({ ...input, amount: params.amount })
        : await paymentService.start({ ...input, purpose, targetId: (params.parcelId ?? params.bookingId)! });
      startedAt.current = Date.now();
      setPollingStopped(false);
      setCharge(started);
      if (started.channel === 'card' && started.redirectUrl) {
        await Linking.openURL(started.redirectUrl).catch(() => setError(t('payment.cardFailed')));
      }
    } catch (e) {
      setError(errorHandler.process(e).message);
    } finally {
      setStarting(false);
    }
  }, [channel, mobile, phone, currency, purpose, params.amount, params.parcelId, params.bookingId, t]);

  const check = useCallback(async () => {
    if (!charge) return;
    try {
      setCharge(await paymentService.status(charge.reference));
    } catch {
      // Keep waiting; the next check may get through
    }
  }, [charge]);

  // Ask where the payment stands while it is pending
  useEffect(() => {
    if (charge?.status !== 'pending' || pollingStopped) return;
    const timer = setInterval(() => {
      if (Date.now() - startedAt.current > POLL_FOR_MS) {
        setPollingStopped(true);
        return;
      }
      check();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [charge?.status, pollingStopped, check]);

  // Coming back from the card page or the USSD prompt: check at once
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active' && charge?.status === 'pending') check();
    });
    return () => sub.remove();
  }, [charge?.status, check]);

  const cancelRequest = useCallback(async () => {
    setCancelling(true);
    try {
      if (params.parcelId) {
        await parcelService.cancel(params.parcelId, 'Sender cancelled before paying');
        navigation.goBack();
      } else if (params.bookingId) {
        await bookingService.cancelBooking(params.bookingId, 'Rider cancelled before paying');
        navigation.navigate('RiderTabs', { screen: 'MyRides' });
      }
    } catch (e) {
      setError(errorHandler.process(e).message);
    } finally {
      setCancelling(false);
    }
  }, [params.bookingId, params.parcelId, navigation]);

  // ── Paid ──────────────────────────────────────────────────────────
  if (charge?.status === 'paid') {
    const done = purpose === 'topup'
      ? { title: t('payment.topupDoneTitle'), body: t('payment.topupDoneBody', { amount: money(params.amount) }), cta: t('payment.backToWallet'), go: () => navigation.goBack() }
      : charge.creditedToWallet
        ? { title: t('payment.inWalletTitle'), body: t('payment.inWalletBody', { amount: money(charge.amountUsd) }), cta: t('payment.openWallet'), go: () => navigation.replace('Wallet') }
        : purpose === 'parcel'
          ? { title: t('payment.receivedTitle'), body: t('payment.parcelReceived'), cta: t('payment.trackParcel'), go: () => navigation.goBack() }
          : { title: t('payment.receivedTitle'), body: t('payment.rideReceived'), cta: t('payment.viewRides'), go: () => navigation.navigate('RiderTabs', { screen: 'MyRides' }) };
    return (
      <View style={[styles.centered, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        <View style={[styles.badge, { backgroundColor: c.success }]}>
          <Icon name="check" size={40} color="#FFFFFF" />
        </View>
        <Text style={[styles.title, { color: c.text }]} accessibilityLiveRegion="polite">{done.title}</Text>
        <Text style={[styles.body, { color: c.textSec }]}>{done.body}</Text>
        <Pressable onPress={done.go} accessibilityRole="button" style={[styles.primaryBtn, { backgroundColor: c.primary }]}>
          <Text style={[styles.primaryBtnText, { color: c.textOnPrimary }]}>{done.cta}</Text>
        </Pressable>
      </View>
    );
  }

  const waiting = charge?.status === 'pending';
  const failed = charge && (charge.status === 'failed' || charge.status === 'disputed');

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text accessibilityRole="header" style={[styles.headerTitle, { color: c.text }]}>{purpose === 'topup' ? t('payment.topupTitle') : t('payment.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 140 }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={{ fontSize: Typography.base, color: c.textSec }}>{t('payment.amountToPay')}</Text>
          <Text style={{ fontSize: 34, fontWeight: '800', color: c.text, marginTop: 4 }}>{waiting && charge ? money(charge.chargedAmount, charge.currency) : toPay}</Text>
          {currency === 'ZWG' && zwgRate && !waiting ? (
            <Text style={{ fontSize: Typography.base, color: c.textSec, marginTop: 4 }}>{t('payment.zwgRate', { amount: money(params.amount), rate: zwgRate })}</Text>
          ) : null}
          <Text style={{ fontSize: Typography.md, color: c.textSec, marginTop: 8 }}>{params.summary}</Text>
        </View>

        {waiting && charge ? (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.primary }]} accessibilityLiveRegion="polite">
            <View style={styles.row}>
              {pollingStopped ? <Icon name="timer-sand" size={22} color={c.textSec} /> : <ActivityIndicator color={c.primary} />}
              <Text style={{ flex: 1, fontSize: Typography.lg, fontWeight: '700', color: c.text }}>
                {pollingStopped ? t('payment.stillWaiting') : t('payment.waiting')}
              </Text>
            </View>
            <Text style={{ fontSize: Typography.md, color: c.text, lineHeight: 21, marginTop: 10 }}>
              {charge.instructionsKey ? t(charge.instructionsKey, { ...charge.instructionsVars, defaultValue: charge.instructions }) : charge.instructions}
            </Text>
            {charge.authorizationCode ? (
              <View style={[styles.codeBox, { backgroundColor: c.primaryLight }]}>
                <Text style={{ fontSize: 12, color: c.textSec }}>{t('payment.innbucksCode')}</Text>
                <Text selectable style={{ fontSize: 30, fontWeight: '800', letterSpacing: 4, color: c.text }} accessibilityLabel={t('payment.innbucksCodeLabel', { digits: charge.authorizationCode.split('').join(' ') })}>
                  {charge.authorizationCode}
                </Text>
                {charge.authorizationExpires ? <Text style={{ fontSize: 12, color: c.textSec }}>{t('payment.validUntil', { time: charge.authorizationExpires })}</Text> : null}
              </View>
            ) : null}
            {charge.channel === 'card' && charge.redirectUrl ? (
              <Pressable onPress={() => Linking.openURL(charge.redirectUrl!)} accessibilityRole="link" style={styles.linkBtn}>
                <Text style={{ color: c.primary, fontSize: Typography.md, fontWeight: '600' }}>{t('payment.cardAgain')}</Text>
              </Pressable>
            ) : null}
            <Text style={{ fontSize: 13, color: c.textSec, marginTop: 8 }}>
              {charge.channel === 'ecocash' || charge.channel === 'onemoney'
                ? t('payment.noPrompt')
                : t('payment.updatesSoon')}
            </Text>
            <Pressable onPress={() => { setPollingStopped(false); startedAt.current = Date.now(); check(); }} accessibilityRole="button" style={styles.linkBtn}>
              <Text style={{ color: c.primary, fontSize: Typography.md, fontWeight: '600' }}>{t('payment.checkAgain')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {zwgRate ? (
              <View style={[styles.seg, { borderColor: c.border }]} accessibilityRole="radiogroup" accessibilityLabel={t('payment.currency')}>
                {(['USD', 'ZWG'] as const).map(cur => (
                  <Pressable
                    key={cur}
                    onPress={() => setCurrency(cur)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: currency === cur }}
                    style={[styles.segBtn, currency === cur && { backgroundColor: c.primary }]}
                  >
                    <Text style={{ fontWeight: '700', color: currency === cur ? c.textOnPrimary : c.text }}>{cur === 'USD' ? t('payment.usd') : 'ZiG'}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, gap: 8 }]} accessibilityRole="radiogroup" accessibilityLabel={t('payment.payWith')}>
              <Text style={{ fontSize: Typography.lg, fontWeight: '700', color: c.text, marginBottom: 4 }}>{t('payment.payWith')}</Text>
              {METHODS.map(m => {
                const selected = channel === m.id;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => setChannel(m.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={[styles.methodRow, { borderColor: selected ? c.primary : c.border }]}
                  >
                    <Icon name={m.icon} size={22} color={c.textSec} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>{t(`payment.methods.${m.id}.label`)}</Text>
                      <Text style={{ fontSize: 12, color: c.textSec }}>{t(`payment.methods.${m.id}.sub`)}</Text>
                    </View>
                    <Icon name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={selected ? c.primary : c.textSec} />
                  </Pressable>
                );
              })}
              {mobile ? (
                <>
                  <Text style={{ fontSize: 13, color: c.textSec, marginTop: 8 }}>{channel === 'innbucks' ? t('payment.innbucksNumber') : t('payment.payFrom', { wallet: channel === 'ecocash' ? 'EcoCash' : 'OneMoney' })}</Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder="0771 234 567"
                    placeholderTextColor={c.textSec}
                    maxLength={14}
                    accessibilityLabel={t('payment.mobileLabel')}
                    style={[styles.input, { borderColor: phoneOk ? c.border : c.error, color: c.text }]}
                  />
                </>
              ) : null}
            </View>
          </>
        )}

        {failed && charge ? (
          <View style={[styles.notice, { backgroundColor: c.errorLight }]} accessibilityLiveRegion="polite">
            <Text style={{ color: c.text, fontSize: Typography.md, lineHeight: 20 }}>
              {charge.status === 'disputed'
                ? t('payment.disputed')
                : t('payment.notCharged', { reason: charge.failureReason ?? t('payment.notThrough') })}
            </Text>
          </View>
        ) : null}
        {error ? (
          <View style={[styles.notice, { backgroundColor: c.errorLight }]} accessibilityLiveRegion="polite">
            <Text style={{ color: c.text, fontSize: Typography.md, lineHeight: 20 }}>{error}</Text>
          </View>
        ) : null}

        {purpose !== 'topup' && !waiting ? (
          <Pressable onPress={cancelRequest} disabled={cancelling} accessibilityRole="button" style={styles.linkBtn}>
            <Text style={{ color: c.error, fontSize: Typography.md, fontWeight: '600' }}>{cancelling ? t('payment.cancelling') : t('payment.cancelInstead')}</Text>
          </Pressable>
        ) : null}
        <Text style={{ fontSize: Typography.base, color: c.textSec, lineHeight: 19 }}>
          {t('payment.secure')}
        </Text>
      </ScrollView>

      {!waiting ? (
        <View style={[styles.ctaBar, { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
          <Pressable
            onPress={pay}
            disabled={starting || !phoneOk}
            accessibilityRole="button"
            accessibilityState={{ busy: starting, disabled: starting || !phoneOk }}
            style={[styles.primaryBtn, { backgroundColor: c.primary, marginTop: 0, width: '100%', opacity: phoneOk ? 1 : 0.5 }]}
          >
            {starting ? (
              <ActivityIndicator color={c.textOnPrimary} />
            ) : (
              <Text style={[styles.primaryBtnText, { color: c.textOnPrimary }]}>{failed ? t('payment.tryAgain') : t('payment.pay', { amount: toPay })}</Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  badge: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: Typography['3xl'], fontWeight: Typography.bold, textAlign: 'center' },
  body: { fontSize: Typography.md, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: Typography['2xl'], fontWeight: Typography.bold },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: Radius.md, padding: 12, minHeight: 56 },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 12, minHeight: 48, fontSize: 16 },
  seg: { flexDirection: 'row', borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden' },
  segBtn: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  codeBox: { borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', gap: 4, marginTop: 12 },
  notice: { borderRadius: Radius.md, padding: Spacing.md },
  linkBtn: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  ctaBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.lg, borderTopWidth: 1 },
  primaryBtn: {
    minHeight: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing['2xl'],
  },
  primaryBtnText: { fontSize: Typography.xl, fontWeight: Typography.bold },
});
