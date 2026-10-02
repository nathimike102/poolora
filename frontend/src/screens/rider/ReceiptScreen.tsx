/**
 * screens/rider/ReceiptScreen.tsx
 *
 * The receipt for one booking (UC-R04 step 11): the trip, what was paid and
 * how, any refund, and the service fee included in the fare. It can be
 * emailed to the address on the profile or shared as text.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Share } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { BackButton } from '../../components/BackButton';
import { Icon } from '../../components/Icon';
import type { RootStackParamList } from '../../navigation/types';
import { bookingService } from '../../services/bookingService';
import type { Receipt } from '../../types/api';
import { errorHandler } from '../../utils/errorHandler';
import { money, REGION } from '../../utils/region';
import { formatKg } from '../../utils/carbon';
import { useTranslation } from 'react-i18next';



export function ReceiptScreen() {
  const { bookingId } = useRoute<RouteProp<RootStackParamList, 'Receipt'>>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { c } = useApp();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<{ receipt: Receipt; text: string } | null>(null);
  const [error, setError] = useState('');
  const [emailing, setEmailing] = useState(false);

  useEffect(() => {
    bookingService
      .getReceipt(bookingId)
      .then(setData)
      .catch(e => setError(errorHandler.process(e).message));
  }, [bookingId]);

  const email = async () => {
    setEmailing(true);
    try {
      const result = await bookingService.emailReceipt(bookingId);
      Alert.alert(t('receipt.receiptSent'), result.to ? `We emailed it to ${result.to}.` : 'Check your inbox.');
    } catch (e) {
      Alert.alert(t('receipt.notSent'), errorHandler.process(e).message);
    } finally {
      setEmailing(false);
    }
  };

  const r = data?.receipt;
  const row = (label: string, value: string, strong = false) => (
    <View style={styles.row} key={label}>
      <Text style={{ fontSize: 14, color: c.textSec, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: strong ? 17 : 14, fontWeight: strong ? '800' : '600', color: c.text }}>{value}</Text>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">{t('receipt.receipt')}</Text>
        <View style={{ width: 44 }} />
      </View>
      {!r ? (
        <View style={styles.center}>
          {error ? <Text style={{ color: c.textSec, textAlign: 'center', padding: 24 }}>{error}</Text> : <ActivityIndicator color={c.primary} accessibilityLabel={t('receipt.loadingReceipt')} />}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: c.textSec }}>{r.receiptNumber} · {t(`receipt.status.${r.status}`)}</Text>
            <Text style={{ fontSize: 17, fontWeight: '700', color: c.text, marginTop: 6 }}>{r.trip.from}</Text>
            <Text style={{ fontSize: 13, color: c.textSec, marginVertical: 2 }}>{t('receipt.to')}</Text>
            <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>{r.trip.to}</Text>
            <Text style={{ fontSize: 13, color: c.textSec, marginTop: 8 }}>
              {new Date(r.trip.departure).toLocaleString(REGION.dateLocale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {' · '}{t('receipt.driver', { name: r.driver.name })}{r.driver.vehicle ? ` · ${r.driver.vehicle}` : ''}
            </Text>
          </View>
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            {row(t('receipt.seats'), `${r.trip.seats} × ${money(r.pricePerSeat)}`)}
            {row(t('receipt.fare'), money(r.fare))}
            {r.serviceFee ? row(t('receipt.serviceFee'), money(r.serviceFee)) : null}
            {r.companyPaid ? row(t('receipt.companyPaid', { company: r.company ?? t('receipt.yourCompany') }), `− ${money(r.companyPaid)}`) : null}
            {r.refunded ? row(t('receipt.refunded'), `− ${money(r.refunded)}`) : null}
            <View style={[styles.divider, { backgroundColor: c.border }]} />
            {row(t('receipt.totalPaid'), money(r.paid), true)}
            {row(t('receipt.paidBy'), r.paymentMethod)}
          </View>
          {r.co2SavedKg ? (
            <Pressable
              onPress={() => navigation.navigate('Impact')}
              accessibilityRole="button"
              accessibilityLabel={t('receipt.savedLabel', { amount: formatKg(r.co2SavedKg) })}
              style={[styles.card, { backgroundColor: c.successLight, borderColor: c.successLight, flexDirection: 'row', alignItems: 'center', gap: 10 }]}
            >
              <Icon name="leaf" size={22} color={c.success} />
              <Text style={{ flex: 1, color: c.text }}>{t('receipt.saved', { amount: formatKg(r.co2SavedKg) })}</Text>
              <Icon name="chevron-right" size={20} color={c.textSec} />
            </Pressable>
          ) : null}
          {r.status === 'no_show' ? (
            <Text style={{ fontSize: 13, color: c.textSec }}>
              {t('receipt.theDriverWaitedAtThe')}
            </Text>
          ) : null}
          <Pressable onPress={email} disabled={emailing} accessibilityRole="button" style={[styles.action, { backgroundColor: c.primary }]}>
            {emailing ? <ActivityIndicator color={c.textOnPrimary} /> : (
              <>
                <Icon name="email-outline" size={18} color={c.textOnPrimary} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: c.textOnPrimary }}>{t('receipt.emailMeACopy')}</Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={() => data && Share.share({ message: data.text })}
            accessibilityRole="button"
            style={[styles.action, { borderWidth: 1.5, borderColor: c.border }]}
          >
            <Icon name="share-variant" size={18} color={c.text} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>{t('receipt.share')}</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  content: { padding: 20, gap: 16 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 12 },
  divider: { height: 1, marginVertical: 6 },
  action: { minHeight: 52, borderRadius: 12, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
});
