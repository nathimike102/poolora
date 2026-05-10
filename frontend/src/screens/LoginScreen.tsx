/**
 * screens/LoginScreen.tsx
 *
 * Redesigned login screen showing sign-in method selection.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RidePoolLogo } from '../components/RidePoolLogo';
import { Typography, Spacing, Radius, Shadow } from '../theme';
import { firebaseLoginWithBackend, signInWithGoogle } from '../services/authService';
import { logger } from '../utils/logger';
import type { RootStackParamList } from '../navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export function LoginScreen() {
  const navigation = useNavigation<NavProp>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    try {
      // First, sign in with Firebase
      const firebaseUser = await signInWithGoogle();
      
      // Get Firebase ID token
      const firebaseToken = await firebaseUser.user.getIdToken();
      
      // Then, exchange Firebase token for backend JWT
      await firebaseLoginWithBackend(firebaseToken);
      
      logger.info('Google sign-in successful');
      navigation.navigate('ProfileSetup');
    } catch (err: any) {
      if (err.message !== 'Sign-in was cancelled.') {
        logger.error('Google sign-in failed', { error: err });
        Alert.alert('Google Sign-In Error', err.message || 'Please try again');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <RidePoolLogo size={64} backgroundColor={c.primary} />
        <Text style={[styles.headline, { color: c.text }]}>
          Welcome to Sanchari
        </Text>
        <Text style={[styles.subheading, { color: c.textSec }]}>
          Choose how you want to continue
        </Text>
      </View>

      {/* ── Login Options ─────────────────────────────────────────────── */}
      <View style={styles.body}>
        {/* Continue with Google */}
        <TouchableOpacity
          style={[
            styles.googleButton,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
            },
            Shadow.sm,
          ]}
          activeOpacity={0.7}
          onPress={handleGoogleSignIn}
          disabled={googleLoading}
        >
          {googleLoading ? (
            <ActivityIndicator size="small" color={c.primary} />
          ) : (
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </Svg>
          )}
          <Text style={[styles.googleLabel, { color: c.text }]}>
            {googleLoading ? 'Signing in...' : 'Continue with Google'}
          </Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
          <Text style={[styles.dividerLabel, { color: c.textSec }]}>OR</Text>
          <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
        </View>

        {/* Continue with Phone */}
        <TouchableOpacity
          style={[
            styles.optionButton,
            {
              borderColor: c.border,
              backgroundColor: c.surface,
            },
            Shadow.sm,
          ]}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('PhoneLogin')}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill={c.primary}>
            <Path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1.003 1.003 0 011.01-.24c1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.1.31.03.66-.25 1.02l-2.2 2.2z" />
          </Svg>
          <Text style={[styles.optionLabel, { color: c.text }]}>
            Continue with Phone Number
          </Text>
        </TouchableOpacity>

        {/* Continue with Email */}
        <TouchableOpacity
          style={[
            styles.optionButton,
            {
              borderColor: c.border,
              backgroundColor: c.surface,
            },
            Shadow.sm,
          ]}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('EmailLogin')}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill={c.primary}>
            <Path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
          </Svg>
          <Text style={[styles.optionLabel, { color: c.text }]}>
            Continue with Email
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Terms ─────────────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <Text style={[styles.terms, { color: c.textSec }]}>
          By continuing, you agree to our{' '}
          <Text style={[styles.termsLink, { color: c.primary }]}>
            Terms of Service
          </Text>
          {' '}and{' '}
          <Text style={[styles.termsLink, { color: c.primary }]}>
            Privacy Policy
          </Text>
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing['2xl'],
  },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: Spacing['6xl'],
    paddingBottom: Spacing['4xl'],
    gap: Spacing.sm,
  },
  headline: {
    fontSize: Typography['6xl'],
    fontWeight: Typography.extrabold,
    lineHeight: Typography['6xl'] * Typography.tight,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
  subheading: {
    fontSize: Typography.lg,
    textAlign: 'center',
  },

  // Body
  body: {
    flex: 1,
    gap: Spacing.lg,
  },

  // Google button
  googleButton: {
    height: 56,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  googleLabel: {
    fontSize: Typography.xl,
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
    fontWeight: Typography.semibold,
  },

  // Option buttons (Phone, Email)
  optionButton: {
    height: 56,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  optionLabel: {
    fontSize: Typography.xl,
    fontWeight: Typography.semibold,
  },

  // Footer
  footer: {
    paddingVertical: Spacing['2xl'],
  },
  terms: {
    textAlign: 'center',
    fontSize: Typography.sm,
    lineHeight: Typography.sm * Typography.normal,
  },
  termsLink: {
    fontWeight: Typography.semibold,
  },
});
