/**
 * screens/rider/ReceiptScreen.tsx
 *
 * The receipt for one booking (UC-R04 step 11): the trip, what was paid and
 * how, any refund, and the service fee included in the fare. It can be
 * emailed to the address on the profile or shared as text.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, Share } from 'react-native';
import { ActivityIndicator } from '../../components/Themed';
import { Text } from '../../components/Text';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import { Icon } from '../../components/Icon';
import type { RootStackParamList } from '../../navigation/types';
import { bookingService } from '../../services/bookingService';
import type { Receipt } from '../../types/api';
import { errorHandler } from '../../utils/errorHandler';
import { money, REGION } from '../../utils/region';
import { formatKg } from '../../utils/carbon';
import { useTranslation } from 'react-i18next';
import { tc, tk } from '../../theme/themed';



export function ReceiptScreen() {
  const { bookingId } = useRoute<RouteProp<RootStackParamList, 'Receipt'>>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
      <Text style={[{ fontSize: 14, flex: 1 }, tc.color_textSec]}>{label}</Text>
      <Text style={[{ fontSize: strong ? 17 : 14, fontWeight: strong ? '800' : '600' }, tc.color_text]}>{value}</Text>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      <ScreenHeader title={t('receipt.receipt')} />
      {!r ? (
        <View style={styles.center}>
          {error ? <Text style={[{ textAlign: 'center', padding: 24 }, tc.color_textSec]}>{error}</Text> : <ActivityIndicator color={tk.primary} accessibilityLabel={t('receipt.loadingReceipt')} />}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[
            styles.card,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant
          ]}>
            <Text style={[{ fontSize: 12, fontWeight: '600' }, tc.color_textSec]}>{r.receiptNumber} · {t(`receipt.status.${r.status}`)}</Text>
            <Text style={[{ fontSize: 17, fontWeight: '700', marginTop: 6 }, tc.color_text]}>{r.trip.from}</Text>
            <Text style={[{ fontSize: 13, marginVertical: 2 }, tc.color_textSec]}>{t('receipt.to')}</Text>
            <Text style={[{ fontSize: 17, fontWeight: '700' }, tc.color_text]}>{r.trip.to}</Text>
            <Text style={[{ fontSize: 13, marginTop: 8 }, tc.color_textSec]}>
              {new Date(r.trip.departure).toLocaleString(REGION.dateLocale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {' · '}{t('receipt.driver', { name: r.driver.name })}{r.driver.vehicle ? ` · ${r.driver.vehicle}` : ''}
            </Text>
          </View>
          <View style={[
            styles.card,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant
          ]}>
            {row(t('receipt.seats'), `${r.trip.seats} × ${money(r.pricePerSeat)}`)}
            {row(t('receipt.fare'), money(r.fare))}
            {r.serviceFee ? row(t('receipt.serviceFee'), money(r.serviceFee)) : null}
            {r.companyPaid ? row(t('receipt.companyPaid', { company: r.company ?? t('receipt.yourCompany') }), `− ${money(r.companyPaid)}`) : null}
            {r.refunded ? row(t('receipt.refunded'), `− ${money(r.refunded)}`) : null}
            <View style={[styles.divider, tc.backgroundColor_border]} />
            {row(t('receipt.totalPaid'), money(r.paid), true)}
            {row(t('receipt.paidBy'), r.paymentMethod)}
          </View>
          {r.co2SavedKg ? (
            <Pressable
              onPress={() => navigation.navigate('Impact')}
              accessibilityRole="button"
              accessibilityLabel={t('receipt.savedLabel', { amount: formatKg(r.co2SavedKg) })}
              style={[
                styles.card,
                { flexDirection: 'row', alignItems: 'center', gap: 10 },
                tc.backgroundColor_successLight,
                tc.borderColor_successLight
              ]}
            >
              <Icon name="leaf" size={22} color={tk.success} />
              <Text style={[{ flex: 1 }, tc.color_text]}>{t('receipt.saved', { amount: formatKg(r.co2SavedKg) })}</Text>
              <Icon name="chevron-right" size={20} color={tk.textSec} />
            </Pressable>
          ) : null}
          {r.status === 'no_show' ? (
            <Text style={[{ fontSize: 13 }, tc.color_textSec]}>
              {t('receipt.theDriverWaitedAtThe')}
            </Text>
          ) : null}
          <Pressable onPress={email} disabled={emailing} accessibilityRole="button" style={[styles.action, tc.backgroundColor_primary]}>
            {emailing ? <ActivityIndicator color={tk.textOnPrimary} /> : (
              <>
                <Icon name="email-outline" size={18} color={tk.textOnPrimary} />
                <Text style={[{ fontSize: 16, fontWeight: '700' }, tc.color_textOnPrimary]}>{t('receipt.emailMeACopy')}</Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={() => data && Share.share({ message: data.text })}
            accessibilityRole="button"
            style={[styles.action, { borderWidth: 1.5 }, tc.borderColor_border]}
          >
            <Icon name="share-variant" size={18} color={tk.text} />
            <Text style={[{ fontSize: 16, fontWeight: '700' }, tc.color_text]}>{t('receipt.share')}</Text>
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
