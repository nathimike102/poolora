/**
 * screens/EmailLoginScreen.tsx
 *
 * Email + password login screen.
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Text, TextInput } from '../components/Text';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useApp } from '../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../components/BackButton';
import { GradientButton } from '../components/GradientButton';
import { Typography, Spacing, Radius, Shadow } from '../theme';
import { signInWithEmail, sendPasswordReset } from '../services/authService';
import type { RootStackParamList } from '../navigation/types';
import { useTranslation } from 'react-i18next';

import { tc, tk } from '../theme/themed';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'EmailLogin'>;

export function EmailLoginScreen() {
  const navigation = useNavigation<NavProp>();
  const {
    finishSignIn
  } = useApp();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid = email.includes('@') && password.length >= 6;

  const getErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  };

  const handleLogin = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    try {
      const credential = await signInWithEmail(email.trim(), password);
      if ((await finishSignIn(credential.user)) === 'profile') navigation.navigate('ProfileSetup');
    } catch (error) {
      Alert.alert(t('login.loginFailed'), getErrorMessage(error, t('login.unableSignIn')));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.includes('@')) {
      Alert.alert(t('login.enterEmailTitle'), t('login.enterEmailBody'));
      return;
    }
    try {
      await sendPasswordReset(email.trim());
      Alert.alert(t('login.resetSentTitle'), t('login.resetSentBody'));
    } catch (error) {
      Alert.alert(t('login.error'), getErrorMessage(error, t('login.unableReset')));
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
          {t('login.emailTitle')}
        </Text>

        {/* Email input */}
        <View
          style={[
            styles.inputContainer,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant,
            Shadow.sm
          ]}
        >
          <Text style={[styles.inputLabel, tc.color_textSec]}>{t('login.emailLabel')}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder={t('login.emailPlaceholder')}
            placeholderTextColor={tk.textSec}
            style={[styles.input, tc.color_text]}
          />
        </View>

        {/* Password input */}
        <View
          style={[
            styles.inputContainer,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant,
            Shadow.sm
          ]}
        >
          <Text style={[styles.inputLabel, tc.color_textSec]}>{t('login.passwordLabel')}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder={t('login.passwordPlaceholder')}
            placeholderTextColor={tk.textSec}
            style={[styles.input, tc.color_text]}
          />
        </View>

        {/* Forgot Password */}
        <TouchableOpacity accessibilityRole="button"
          onPress={handleForgotPassword}
          style={styles.forgotRow}
        >
          <Text style={[styles.forgotText, tc.color_primary]}>
            {t('login.forgot')}
          </Text>
        </TouchableOpacity>

        {/* Login button */}
        <GradientButton
          label={loading ? '' : t('login.login')}
          onPress={handleLogin}
          disabled={!isValid || loading}
          loading={loading}
          colorStart={tk.primary}
          colorEnd={tk.primaryDark}
          disabledColor={tk.border}
        />

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, tc.backgroundColor_border]} />
          <Text style={[styles.dividerLabel, tc.color_textSec]}>
            {t('login.noAccount')}
          </Text>
          <View style={[styles.dividerLine, tc.backgroundColor_border]} />
        </View>

        {/* Create Account */}
        <TouchableOpacity accessibilityRole="button"
          style={[
            styles.signupButton,
            tc.borderColor_surfaceVariant,
            tc.backgroundColor_surfaceVariant,
            Shadow.sm
          ]}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('EmailSignup')}
        >
          <Text style={[styles.signupLabel, tc.color_primary]}>
            {t('login.createAccount')}
          </Text>
        </TouchableOpacity>
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

  // Forgot Password
  forgotRow: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: Spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerLabel: {
    fontSize: Typography.base,
  },

  // Signup button
  signupButton: {
    height: 56,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signupLabel: {
    fontSize: Typography.xl,
    fontWeight: Typography.semibold,
  },
});
