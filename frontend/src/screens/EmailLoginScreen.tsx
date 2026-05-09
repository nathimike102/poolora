/**
 * screens/EmailLoginScreen.tsx
 *
 * Email + password login screen.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
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
import { signInWithEmail, sendPasswordReset } from '../services/authService';
import type { RootStackParamList } from '../navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'EmailLogin'>;

export function EmailLoginScreen() {
  const navigation = useNavigation<NavProp>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid = email.includes('@') && password.length >= 6;

  const handleLogin = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      navigation.navigate('ProfileSetup');
    } catch (err: any) {
      Alert.alert('Login Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.includes('@')) {
      Alert.alert('Enter Email', 'Please enter your email address first.');
      return;
    }
    try {
      await sendPasswordReset(email.trim());
      Alert.alert('Email Sent', 'A password reset link has been sent to your email.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
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
          Login with Email
        </Text>

        {/* Email input */}
        <View
          style={[
            styles.inputContainer,
            { backgroundColor: c.surface, borderColor: c.border },
            Shadow.sm,
          ]}
        >
          <Text style={[styles.inputLabel, { color: c.textSec }]}>EMAIL</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="you@example.com"
            placeholderTextColor={c.textSec}
            style={[styles.input, { color: c.text }]}
          />
        </View>

        {/* Password input */}
        <View
          style={[
            styles.inputContainer,
            { backgroundColor: c.surface, borderColor: c.border },
            Shadow.sm,
          ]}
        >
          <Text style={[styles.inputLabel, { color: c.textSec }]}>PASSWORD</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Enter your password"
            placeholderTextColor={c.textSec}
            style={[styles.input, { color: c.text }]}
          />
        </View>

        {/* Forgot Password */}
        <TouchableOpacity
          onPress={handleForgotPassword}
          style={styles.forgotRow}
        >
          <Text style={[styles.forgotText, { color: c.primary }]}>
            Forgot Password?
          </Text>
        </TouchableOpacity>

        {/* Login button */}
        <GradientButton
          label={loading ? '' : 'Login'}
          onPress={handleLogin}
          disabled={!isValid || loading}
          loading={loading}
          colorStart={c.primary}
          colorEnd={c.primaryDark}
          disabledColor={c.border}
        />

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
          <Text style={[styles.dividerLabel, { color: c.textSec }]}>
            Don't have an account?
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
        </View>

        {/* Create Account */}
        <TouchableOpacity
          style={[
            styles.signupButton,
            { borderColor: c.border, backgroundColor: c.surface },
            Shadow.sm,
          ]}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('EmailSignup')}
        >
          <Text style={[styles.signupLabel, { color: c.primary }]}>
            Create Account
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
