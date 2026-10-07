/**
 * screens/shared/PhoneNumberScreen.tsx
 *
 * Adding a phone number to the account, or changing it. Every account needs
 * one: riders and drivers call each other on it, and the safety team calls
 * it during an SOS. People who signed in with Google or email add it here.
 * The number is proved with a 6-digit code before it is saved.
 */

import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { CountryPicker } from '../../components/CountryPicker';
import { GradientButton } from '../../components/GradientButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Text, TextInput } from '../../components/Text';
import { useLocationCountry } from '../../services/locationCountry';
import { userService } from '../../services/userService';
import { countryByCode, HOME_COUNTRY, nationalDigitsFor, toE164For, type Country } from '../../utils/countries';
import { errorHandler } from '../../utils/errorHandler';
import { formatPhone, MARKETS } from '../../utils/region';
import { Radius, Spacing, Typography } from '../../theme';
import { tc, tk } from '../../theme/themed';

const RESEND_SECONDS = 30;

export function PhoneNumberScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const here = useLocationCountry();
  const [picked, setPicked] = useState<Country>();
  const country = picked ?? countryByCode(here.code) ?? HOME_COUNTRY;
  const [number, setNumber] = useState('');
  const e164 = toE164For(country, number);

  // Set once the code has been sent: the number it was sent to
  const [sentTo, setSentTo] = useState<string>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const send = async () => {
    const phone = sentTo ?? e164;
    if (!phone || busy) return;
    setBusy(true);
    try {
      await userService.sendPhoneCode(phone);
      setSentTo(phone);
      setCode('');
      setWait(RESEND_SECONDS);
    } catch (error) {
      Alert.alert(t('phoneNumber.sendFailed'), errorHandler.process(error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!sentTo || code.length !== 6 || busy) return;
    setBusy(true);
    try {
      await userService.confirmPhone(sentTo, code);
      Alert.alert(t('phoneNumber.saved'), t('phoneNumber.savedBody', { phone: formatPhone(sentTo) }));
      navigation.goBack();
    } catch (error) {
      Alert.alert(t('phoneNumber.confirmFailed'), errorHandler.process(error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]} behavior="padding">
      <ScreenHeader title={t('phoneNumber.title')} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={[styles.lead, tc.color_textSec]}>{t('phoneNumber.why')}</Text>

        {!sentTo ? (
          <>
            <View style={[styles.field, tc.backgroundColor_surfaceVariant, tc.borderColor_border]}>
              <Text style={[styles.label, tc.color_textSec]}>{t('login.mobileNumber')}</Text>
              <View style={styles.row}>
                <CountryPicker value={country} suggested={[here.code, HOME_COUNTRY.code]} onChange={c => { setPicked(c); setNumber(''); }} />
                <View style={[styles.divider, tc.backgroundColor_border]} />
                <TextInput
                  value={number}
                  onChangeText={v => setNumber(nationalDigitsFor(country, v).slice(0, 14))}
                  keyboardType="phone-pad"
                  maxLength={15}
                  placeholder={MARKETS[country.code]?.phonePlaceholder ?? t('login.phonePlaceholder')}
                  placeholderTextColor={tk.textSec}
                  accessibilityLabel={t('login.mobileNumber')}
                  style={[styles.input, tc.color_text]}
                  autoFocus
                />
              </View>
            </View>
            <GradientButton
              label={busy ? '' : t('phoneNumber.sendCode')}
              onPress={send}
              disabled={!e164 || busy}
              loading={busy}
              colorStart={tk.primary}
              colorEnd={tk.primaryDark}
              disabledColor={tk.border}
            />
          </>
        ) : (
          <>
            <Text style={[styles.sent, tc.color_text]}>{t('login.codeSent', { phone: formatPhone(sentTo) })}</Text>
            <TextInput
              value={code}
              onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="••••••"
              placeholderTextColor={tk.textSec}
              accessibilityLabel={t('phoneNumber.codeLabel')}
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              style={[styles.code, tc.backgroundColor_surfaceVariant, tc.color_text]}
              autoFocus
            />
            <GradientButton
              label={busy ? '' : t('phoneNumber.save')}
              onPress={confirm}
              disabled={code.length !== 6 || busy}
              loading={busy}
              colorStart={tk.primary}
              colorEnd={tk.primaryDark}
              disabledColor={tk.border}
            />
            <View style={styles.links}>
              <Pressable onPress={send} disabled={wait > 0 || busy} accessibilityRole="button" hitSlop={8}>
                <Text style={[styles.link, wait > 0 ? tc.color_textSec : tc.color_primary]}>
                  {wait > 0 ? t('phoneNumber.resendIn', { seconds: wait }) : t('phoneNumber.resend')}
                </Text>
              </Pressable>
              <Pressable onPress={() => setSentTo(undefined)} disabled={busy} accessibilityRole="button" hitSlop={8}>
                <Text style={[styles.link, tc.color_primary]}>{t('phoneNumber.otherNumber')}</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: Spacing['2xl'], paddingTop: Spacing.md, paddingBottom: Spacing['2xl'], gap: Spacing.xl },
  lead: { fontSize: Typography.lg, lineHeight: 22 },
  field: { borderRadius: Radius.xl, borderWidth: 2, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  label: { fontSize: Typography.xs, fontWeight: Typography.semibold, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { width: 1, height: 24 },
  input: { flex: 1, fontSize: Typography['2xl'], fontWeight: '600', letterSpacing: 1, height: 48, paddingHorizontal: 0, paddingVertical: 0 },
  sent: { fontSize: Typography.lg },
  code: { fontSize: 28, fontWeight: '700', letterSpacing: 12, textAlign: 'center', height: 64, borderRadius: Radius.xl },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
  link: { fontSize: Typography.lg, fontWeight: Typography.semibold },
});
