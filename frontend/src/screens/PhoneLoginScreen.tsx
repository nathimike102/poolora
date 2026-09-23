/**
 * screens/PhoneLoginScreen.tsx
 *
 * Phone number input screen — sends OTP then navigates to OTP verification.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../components/BackButton';
import { GradientButton } from '../components/GradientButton';
import { Typography, Spacing, Radius, Shadow } from '../theme';
import { sendOtpToBackend } from '../services/authService';
import { errorHandler } from '../utils/errorHandler';
import type { RootStackParamList } from '../navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'PhoneLogin'>;

export function PhoneLoginScreen() {
  const navigation = useNavigation<NavProp>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);

  const isValid = phone.length === 10;

  const handleSendOtp = async () => {
    if (!isValid || sending) return;
    setSending(true);
    try {
      await sendOtpToBackend(`+91${phone}`);
      navigation.navigate('OTP', { phone });
    } catch (error) {
      Alert.alert('Could not send code', errorHandler.process(error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <BackButton />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <Text style={[styles.title, { color: c.text }]}>
          Enter your phone number
        </Text>

        {/* Phone input */}
        <View
          style={[
            styles.phoneContainer,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
            },
            Shadow.sm,
          ]}
        >
          <Text style={[styles.phoneLabel, { color: c.textSec }]}>
            MOBILE NUMBER
          </Text>
          <View style={styles.phoneRow}>
            <View style={styles.prefixRow}>
              <Text style={[styles.dialCode, { color: c.text }]}>+91</Text>
              <View style={[styles.divider, { backgroundColor: c.border }]} />
            </View>

            <TextInput
              value={phone}
              onChangeText={val => setPhone(val.replace(/\D/g, '').slice(0, 10))}
              keyboardType="phone-pad"
              maxLength={10}
              placeholder="98765 43210"
              placeholderTextColor={c.textSec}
              style={[styles.phoneInput, { color: c.text }]}
              autoFocus
            />
          </View>
        </View>

        {/* Info note */}
        <View style={[styles.infoNote, { backgroundColor: c.primaryLight }]}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill={c.primary}>
            <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </Svg>
          <Text style={[styles.infoText, { color: c.primary }]}>
            A 6-digit OTP will be sent to this number
          </Text>
        </View>

        {/* CTA */}
        <View style={styles.cta}>
          <GradientButton
            label={sending ? '' : 'Send OTP'}
            onPress={handleSendOtp}
            disabled={!isValid || sending}
            loading={sending}
            colorStart={c.primary}
            colorEnd={c.primaryDark}
            disabledColor={c.border}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.sm,
    paddingBottom: Spacing['2xl'],
    gap: Spacing.xl,
  },
  title: {
    fontSize: Typography['5xl'],
    fontWeight: Typography.extrabold,
    marginBottom: Spacing.sm,
  },

  // Phone input container
  phoneContainer: {
    borderRadius: Radius.xl,
    borderWidth: 2,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  phoneLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    marginBottom: 2,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  prefixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  flagEmoji: {
    fontSize: 18,
  },
  dialCode: {
    fontSize: Typography.xl,
    fontWeight: Typography.semibold,
  },
  divider: {
    width: 1,
    height: 24,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: 'transparent',
    fontSize: Typography['2xl'],
    fontWeight: Typography.semibold as unknown as '600',
    letterSpacing: 1,
    height: 48,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },

  // Info note
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: Spacing.lg,
    borderRadius: Radius['3xl'],
  },
  infoText: {
    flex: 1,
    fontSize: Typography.base,
    lineHeight: Typography.base * Typography.normal,
  },

  // CTA area
  cta: {
    marginTop: Spacing.lg,
  },
});
