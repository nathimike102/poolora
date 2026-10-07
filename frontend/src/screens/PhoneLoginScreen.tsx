/**
 * screens/PhoneLoginScreen.tsx
 *
 * Phone number input screen — sends OTP then navigates to OTP verification.
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Text, TextInput } from '../components/Text';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path } from '../components/ThemedSvg';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../components/BackButton';
import { GradientButton } from '../components/GradientButton';
import { Typography, Spacing, Radius, Shadow } from '../theme';
import { sendOtpToBackend } from '../services/authService';
import { errorHandler } from '../utils/errorHandler';
import type { RootStackParamList } from '../navigation/types';
import { MARKETS } from '../utils/region';
import { countryByCode, HOME_COUNTRY, nationalDigitsFor, toE164For, type Country } from '../utils/countries';
import { useLocationCountry } from '../services/locationCountry';
import { CountryPicker } from '../components/CountryPicker';
import { useTranslation } from 'react-i18next';
import { tc, tk } from '../theme/themed';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'PhoneLogin'>;

export function PhoneLoginScreen() {
  const navigation = useNavigation<NavProp>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);

  // The calling code starts on the country the phone is in, until one is picked
  const here = useLocationCountry();
  const [picked, setPicked] = useState<Country>();
  const country = picked ?? countryByCode(here.code) ?? HOME_COUNTRY;

  const e164 = toE164For(country, phone);
  const isValid = e164 !== null;
  const placeholder = MARKETS[country.code]?.phonePlaceholder ?? t('login.phonePlaceholder');

  const handleSendOtp = async () => {
    if (!isValid || sending) return;
    setSending(true);
    try {
      await sendOtpToBackend(e164!);
      navigation.navigate('OTP', { phone: e164! });
    } catch (error) {
      Alert.alert(t('login.sendFailed'), errorHandler.process(error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}
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
        <Text style={[styles.title, tc.color_text]}>
          {t('login.enterPhone')}
        </Text>

        {/* Phone input */}
        <View
          style={[
            styles.phoneContainer,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_border,
            Shadow.sm
          ]}
        >
          <Text style={[styles.phoneLabel, tc.color_textSec]}>
            {t('login.mobileNumber')}
          </Text>
          <View style={styles.phoneRow}>
            <View style={styles.prefixRow}>
              <CountryPicker value={country} suggested={[here.code, HOME_COUNTRY.code]} onChange={c => { setPicked(c); setPhone(''); }} />
              <View style={[styles.divider, tc.backgroundColor_border]} />
            </View>

            <TextInput
              value={phone}
              onChangeText={val => setPhone(nationalDigitsFor(country, val).slice(0, 14))}
              keyboardType="phone-pad"
              maxLength={15}
              placeholder={placeholder}
              placeholderTextColor={tk.textSec}
              style={[styles.phoneInput, tc.color_text]}
              autoFocus
            />
          </View>
        </View>

        {/* Info note */}
        <View style={[styles.infoNote, tc.backgroundColor_primaryLight]}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill={tk.primary}>
            <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </Svg>
          <Text style={[styles.infoText, tc.color_primary]}>
            {t('login.otpInfo')}
          </Text>
        </View>

        {/* CTA */}
        <View style={styles.cta}>
          <GradientButton
            label={sending ? '' : t('login.sendOtp')}
            onPress={handleSendOtp}
            disabled={!isValid || sending}
            loading={sending}
            colorStart={tk.primary}
            colorEnd={tk.primaryDark}
            disabledColor={tk.border}
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
