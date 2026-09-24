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

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const STATUS: Record<Receipt['status'], string> = {
  completed: 'Trip completed',
  confirmed: 'Seat confirmed',
  cancelled: 'Booking cancelled',
  no_show: 'Marked as a no-show',
};

export function ReceiptScreen() {
  const { bookingId } = useRoute<RouteProp<RootStackParamList, 'Receipt'>>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { c } = useApp();
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
      Alert.alert('Receipt sent', result.to ? `We emailed it to ${result.to}.` : 'Check your inbox.');
    } catch (e) {
      Alert.alert('Not sent', errorHandler.process(e).message);
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
        <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">Receipt</Text>
        <View style={{ width: 44 }} />
      </View>
      {!r ? (
        <View style={styles.center}>
          {error ? <Text style={{ color: c.textSec, textAlign: 'center', padding: 24 }}>{error}</Text> : <ActivityIndicator color={c.primary} accessibilityLabel="Loading receipt" />}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: c.textSec }}>{r.receiptNumber} · {STATUS[r.status]}</Text>
            <Text style={{ fontSize: 17, fontWeight: '700', color: c.text, marginTop: 6 }}>{r.trip.from}</Text>
            <Text style={{ fontSize: 13, color: c.textSec, marginVertical: 2 }}>to</Text>
            <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>{r.trip.to}</Text>
            <Text style={{ fontSize: 13, color: c.textSec, marginTop: 8 }}>
              {new Date(r.trip.departure).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {' · '}Driver {r.driver.name}{r.driver.vehicle ? ` · ${r.driver.vehicle}` : ''}
            </Text>
          </View>
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            {row('Seats', `${r.trip.seats} × ${inr(r.pricePerSeat)}`)}
            {row('Fare', inr(r.fare))}
            {r.serviceFee ? row('Includes Poolora service fee', inr(r.serviceFee)) : null}
            {r.refunded ? row('Refunded', `− ${inr(r.refunded)}`) : null}
            <View style={[styles.divider, { backgroundColor: c.border }]} />
            {row('Total paid', inr(r.paid), true)}
            {row('Paid by', r.paymentMethod)}
          </View>
          {r.status === 'no_show' ? (
            <Text style={{ fontSize: 13, color: c.textSec }}>
              The driver waited at the pickup and reported that you did not come, so the fare was not refunded. If that is wrong, raise a dispute from My rides.
            </Text>
          ) : null}
          <Pressable onPress={email} disabled={emailing} accessibilityRole="button" style={[styles.action, { backgroundColor: c.primary }]}>
            {emailing ? <ActivityIndicator color={c.textOnPrimary} /> : (
              <>
                <Icon name="email-outline" size={18} color={c.textOnPrimary} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: c.textOnPrimary }}>Email me a copy</Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={() => data && Share.share({ message: data.text })}
            accessibilityRole="button"
            style={[styles.action, { borderWidth: 1.5, borderColor: c.border }]}
          >
            <Icon name="share-variant" size={18} color={c.text} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>Share</Text>
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
