/**
 * screens/rider/PaymentScreen.tsx
 *
 * Opens Razorpay Checkout for a booking's order. The backend confirms the
 * payment through Razorpay's signed webhook, so this screen never marks a
 * payment as successful on its own: it only reports what Checkout returned.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import RazorpayCheckout, { type RazorpayError } from 'react-native-razorpay';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../../navigation/types';
import { BackButton } from '../../components/BackButton';
import { Icon } from '../../components/Icon';
import { Radius, Spacing, Typography } from '../../theme';
import { logger } from '../../utils/logger';
import { bookingService } from '../../services/bookingService';
import { realPhone } from '../../utils/phone';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type PayRoute = RouteProp<RootStackParamList, 'Payment'>;
type PayState = 'ready' | 'processing' | 'submitted' | 'cancelled' | 'failed';

/** Razorpay's code when the user closes Checkout without paying. */
const PAYMENT_CANCELLED = 2;

export function PaymentScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<PayRoute>();
  const { c, user } = useApp();
  const insets = useSafeAreaInsets();
  const [payState, setPayState] = useState<PayState>('ready');
  const [failureReason, setFailureReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const cancelRequest = useCallback(async () => {
    setCancelling(true);
    try {
      await bookingService.cancelBooking(params.bookingId, 'Rider cancelled before paying');
      navigation.navigate('RiderTabs', { screen: 'MyRides' });
    } catch {
      setFailureReason('The request could not be cancelled.');
      setPayState('failed');
    } finally {
      setCancelling(false);
    }
  }, [params.bookingId, navigation]);

  const pay = useCallback(async () => {
    setPayState('processing');
    try {
      await RazorpayCheckout.open({
        key: params.keyId,
        order_id: params.orderId,
        amount: Math.round(params.amount * 100),
        currency: 'INR',
        name: 'Poolora',
        description: params.summary,
        prefill: { name: user?.name, contact: realPhone(user?.phone) },
        theme: { color: c.primary },
      });
      setPayState('submitted');
    } catch (error) {
      const err = error as RazorpayError;
      if (err?.code === PAYMENT_CANCELLED) {
        setPayState('cancelled');
        return;
      }
      logger.warn('Razorpay checkout failed', { code: err?.code, bookingId: params.bookingId });
      setFailureReason(err?.description || 'The payment did not go through.');
      setPayState('failed');
    }
  }, [params, user, c.primary]);

  if (payState === 'submitted') {
    return (
      <View style={[styles.centered, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        <View style={[styles.badge, { backgroundColor: c.success }]}>
          <Icon name="check" size={40} color="#FFFFFF" />
        </View>
        <Text style={[styles.title, { color: c.text }]} accessibilityLiveRegion="polite">Payment received</Text>
        <Text style={[styles.body, { color: c.textSec }]}>
          Your request has been sent to the driver. We'll notify you when they confirm your seat. If they
          decline, the full amount is refunded to your original payment method.
        </Text>
        <Pressable
          onPress={() => navigation.navigate('RiderTabs', { screen: 'MyRides' })}
          accessibilityRole="button"
          style={[styles.primaryBtn, { backgroundColor: c.primary }]}
        >
          <Text style={[styles.primaryBtnText, { color: c.textOnPrimary }]}>View my rides</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text accessibilityRole="header" style={[styles.headerTitle, { color: c.text }]}>Payment</Text>
      </View>

      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={{ fontSize: Typography.base, color: c.textSec }}>Amount to pay</Text>
          <Text style={{ fontSize: 34, fontWeight: '800', color: c.text, marginTop: 4 }}>
            ₹{params.amount.toLocaleString('en-IN')}
          </Text>
          <Text style={{ fontSize: Typography.md, color: c.textSec, marginTop: 8 }}>{params.summary}</Text>
        </View>

        {payState === 'cancelled' && (
          <View style={[styles.notice, { backgroundColor: c.warningLight }]} accessibilityLiveRegion="polite">
            <Text style={{ color: c.text, fontSize: Typography.md, lineHeight: 20 }}>
              Payment was cancelled. The driver can't accept your request until you pay. Try again, or
              cancel the request.
            </Text>
            <Pressable
              onPress={cancelRequest}
              disabled={cancelling}
              accessibilityRole="button"
              style={styles.linkBtn}
            >
              <Text style={{ color: c.error, fontSize: Typography.md, fontWeight: '600' }}>
                {cancelling ? 'Cancelling' : 'Cancel request'}
              </Text>
            </Pressable>
          </View>
        )}
        {payState === 'failed' && (
          <View style={[styles.notice, { backgroundColor: c.errorLight }]} accessibilityLiveRegion="polite">
            <Text style={{ color: c.text, fontSize: Typography.md, lineHeight: 20 }}>
              {failureReason} You have not been charged. Try again or use a different payment method.
            </Text>
          </View>
        )}

        <Text style={{ fontSize: Typography.base, color: c.textSec, lineHeight: 19 }}>
          You'll pay securely with Razorpay using UPI, card or net banking. Poolora never sees your card
          details.
        </Text>
      </View>

      <View style={[styles.ctaBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        <Pressable
          onPress={pay}
          disabled={payState === 'processing'}
          accessibilityRole="button"
          accessibilityState={{ busy: payState === 'processing' }}
          style={[styles.primaryBtn, { backgroundColor: c.primary, marginTop: 0, width: '100%' }]}
        >
          {payState === 'processing' ? (
            <ActivityIndicator color={c.textOnPrimary} />
          ) : (
            <Text style={[styles.primaryBtnText, { color: c.textOnPrimary }]}>
              {payState === 'ready' ? `Pay ₹${params.amount.toLocaleString('en-IN')}` : 'Try again'}
            </Text>
          )}
        </Pressable>
      </View>
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
  notice: { borderRadius: Radius.md, padding: Spacing.md },
  linkBtn: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  ctaBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.lg, paddingBottom: Spacing['2xl'], borderTopWidth: 1 },
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
