/**
 * screens/OTPScreen.tsx
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Animated,
  Keyboard,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../components/BackButton';
import { GradientButton } from '../components/GradientButton';
import { Typography, Spacing, Radius, Shadow } from '../theme';
import { sendOtp, confirmOtp, verifyOtpWithBackend } from '../services/authService';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import type { RootStackParamList } from '../navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'OTP'>;
type RouteType = RouteProp<RootStackParamList, 'OTP'>;

const OTP_LENGTH = 6;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function OTPScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const phone = route.params?.phone ?? '98765 43210';
  const [confirmation, setConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(
    route.params?.confirmation ?? null,
  );

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const inputs = useRef<(TextInput | null)[]>(Array(OTP_LENGTH).fill(null));

  const shakeAnims = useRef(
    Array(OTP_LENGTH).fill(null).map(() => new Animated.Value(0)),
  ).current;

  // Error message fade animation
  const errorOpacity = useRef(new Animated.Value(0)).current;

  // ── Timer countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          clearInterval(interval);
          setCanResend(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Error fade in/out ──────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(errorOpacity, {
      toValue: error ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [error, errorOpacity]);

  // ── Shake animation ───────────────────────────────────────────────────────
  const triggerShakeAnimation = useCallback(() => {
    Animated.sequence(
      shakeAnims.map(anim =>
        Animated.sequence([
          Animated.timing(anim, { toValue: 6, duration: 60, useNativeDriver: true }),
          Animated.timing(anim, { toValue: -6, duration: 60, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 4, duration: 60, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]),
      ),
    ).start();
  }, [shakeAnims]);

  // ── OTP entry ──────────────────────────────────────────────────────────────
  const handleChange = useCallback(
    (val: string, idx: number) => {
      if (!/^\d?$/.test(val)) return;
      const newOtp = [...otp];
      newOtp[idx] = val;
      setOtp(newOtp);
      setError(false);

      // Auto-advance focus
      if (val && idx < OTP_LENGTH - 1) {
        inputs.current[idx + 1]?.focus();
      }

      // Auto-verify when all filled
      if (newOtp.every(v => v) && newOtp.join('').length === OTP_LENGTH) {
        Keyboard.dismiss();
        handleVerifyOtp(newOtp.join(''));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [otp],
  );

  const handleKeyPress = useCallback(
    (key: string, idx: number) => {
      if (key === 'Backspace' && !otp[idx] && idx > 0) {
        inputs.current[idx - 1]?.focus();
      }
    },
    [otp],
  );

  // ── Verification — Firebase OTP confirm → Backend JWT ────────────────────
  const handleVerifyOtp = useCallback(
    async (code: string) => {
      if (!confirmation) {
        Alert.alert('Error', 'No verification session found. Please go back and resend OTP.');
        return;
      }
      setVerifying(true);
      try {
        // Step 1: Confirm OTP with Firebase
        await confirmOtp(confirmation, code);
        
        // Step 2: Verify with backend and get JWT tokens
        const fullNumber = `+91${phone}`;
        await verifyOtpWithBackend(fullNumber, code);
        
        // On success, navigate to profile setup for new users.
        // If user already exists, appContext will detect via onAuthStateChanged
        navigation.navigate('ProfileSetup');
      } catch (error) {
        setError(true);
        triggerShakeAnimation();
        setOtp(Array(OTP_LENGTH).fill(''));
        inputs.current[0]?.focus();
        // Show user-friendly error from authService
        Alert.alert('Verification Failed', getErrorMessage(error, 'Incorrect OTP. Please try again.'));
      } finally {
        setVerifying(false);
      }
    },
    [confirmation, navigation, triggerShakeAnimation, phone],
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
  body: {
    flexGrow: 1,
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.sm,
    paddingBottom: Spacing['2xl'],
  },

  // Icon
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: Radius['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },

  // Text
  title: {
    fontSize: Typography['5xl'],
    fontWeight: Typography.extrabold,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.lg,
    lineHeight: Typography.lg * 1.5,
    marginBottom: Spacing['4xl'],
  },
  phoneHighlight: {
    fontWeight: Typography.semibold,
  },

  // OTP boxes
  otpRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  otpBox: {
    width: 46,
    height: 54,
    borderRadius: Radius.lg,
    borderWidth: 2.5,
    fontSize: Typography['3xl'],
    fontWeight: Typography.bold,
    textAlign: 'center',
  },

  // Error
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  errorText: {
    fontSize: Typography.base,
  },

  // Resend
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['3xl'],
  },
  resendPrompt: {
    fontSize: Typography.md,
  },
  resendLink: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
  },

  // Demo hint
  demoHint: {
    textAlign: 'center',
    fontSize: Typography.sm,
    marginTop: Spacing.lg,
  },
});
