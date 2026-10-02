/**
 * screens/EmailSignupScreen.tsx
 *
 * Email registration screen.
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

import { useApp } from '../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../components/BackButton';
import { GradientButton } from '../components/GradientButton';
import { Typography, Spacing, Radius, Shadow } from '../theme';
import { signUpWithEmail } from '../services/authService';
import type { RootStackParamList } from '../navigation/types';
import { useTranslation } from 'react-i18next';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'EmailSignup'>;

export function EmailSignupScreen() {
  const navigation = useNavigation<NavProp>();
  const { c, finishSignIn } = useApp();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.includes('@') &&
    password.length >= 6 &&
    password === confirmPassword;

  const getErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  };

  const handleSignUp = async () => {
    if (!isValid || loading) return;
    if (password !== confirmPassword) {
      Alert.alert(t('login.error'), t('login.mismatchBody'));
      return;
    }
    setLoading(true);
    try {
      const displayName = `${firstName.trim()} ${lastName.trim()}`;
      const credential = await signUpWithEmail(email.trim(), password, displayName);
      // A new account has no profile yet, but profile setup needs the backend session
      await finishSignIn(credential.user);
      navigation.navigate('ProfileSetup');
    } catch (error) {
      Alert.alert(t('login.signUpFailed'), getErrorMessage(error, t('login.unableCreate')));
    } finally {
      setLoading(false);
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
          {t('login.createAccount')}
        </Text>

        {/* First Name */}
        <View
          style={[
            styles.inputContainer,
            { backgroundColor: c.surface, borderColor: c.border },
            Shadow.sm,
          ]}
        >
          <Text style={[styles.inputLabel, { color: c.textSec }]}>{t('login.firstNameLabel')}</Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder={t('login.firstName')}
            placeholderTextColor={c.textSec}
            autoCapitalize="words"
            style={[styles.input, { color: c.text }]}
          />
        </View>

        {/* Last Name */}
        <View
          style={[
            styles.inputContainer,
            { backgroundColor: c.surface, borderColor: c.border },
            Shadow.sm,
          ]}
        >
          <Text style={[styles.inputLabel, { color: c.textSec }]}>{t('login.lastNameLabel')}</Text>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            placeholder={t('login.lastName')}
            placeholderTextColor={c.textSec}
            autoCapitalize="words"
            style={[styles.input, { color: c.text }]}
          />
        </View>

        {/* Email */}
        <View
          style={[
            styles.inputContainer,
            { backgroundColor: c.surface, borderColor: c.border },
            Shadow.sm,
          ]}
        >
          <Text style={[styles.inputLabel, { color: c.textSec }]}>{t('login.emailLabel')}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder={t('login.emailPlaceholder')}
            placeholderTextColor={c.textSec}
            style={[styles.input, { color: c.text }]}
          />
        </View>

        {/* Password */}
        <View
          style={[
            styles.inputContainer,
            { backgroundColor: c.surface, borderColor: c.border },
            Shadow.sm,
          ]}
        >
          <Text style={[styles.inputLabel, { color: c.textSec }]}>{t('login.passwordLabel')}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder={t('login.newPassword')}
            placeholderTextColor={c.textSec}
            style={[styles.input, { color: c.text }]}
          />
        </View>

        {/* Confirm Password */}
        <View
          style={[
            styles.inputContainer,
            { backgroundColor: c.surface, borderColor: c.border },
            Shadow.sm,
          ]}
        >
          <Text style={[styles.inputLabel, { color: c.textSec }]}>{t('login.confirmLabel')}</Text>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder={t('login.confirmPlaceholder')}
            placeholderTextColor={c.textSec}
            style={[styles.input, { color: c.text }]}
          />
        </View>

        {/* Password mismatch hint */}
        {confirmPassword.length > 0 && password !== confirmPassword && (
          <Text style={[styles.errorHint, { color: c.error }]}>
            {t('login.mismatch')}
          </Text>
        )}

        {/* Sign Up button */}
        <View style={styles.cta}>
          <GradientButton
            label={loading ? '' : t('login.createAccount')}
            onPress={handleSignUp}
            disabled={!isValid || loading}
            loading={loading}
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
    gap: Spacing.lg,
  },
  title: {
    fontSize: Typography['5xl'],
    fontWeight: Typography.extrabold,
    marginBottom: Spacing.sm,
  },

  // Input
  inputContainer: {
    borderRadius: Radius.xl,
    borderWidth: 2,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  inputLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    marginBottom: 2,
  },
  input: {
    fontSize: Typography.xl,
    fontWeight: Typography.medium,
    height: 44,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },

  errorHint: {
    fontSize: Typography.sm,
    marginTop: -Spacing.sm,
  },

  // CTA
  cta: {
    marginTop: Spacing.md,
  },
});
