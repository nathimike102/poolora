/**
 * screens/ProfileSetupScreen.tsx
 *
 * Post-auth profile setup screen for new users.
 * Collects photo, name, phone, email, and date of birth.
 * All users default to Rider role — no role selection.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Platform,
  ActionSheetIOS,
  KeyboardAvoidingView,
  Pressable,
} from 'react-native';
import { Text, TextInput } from '../components/Text';
import Svg, { Path } from '../components/ThemedSvg';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from '../components/Icon';
import { realPhone } from '../utils/phone';
import { useApp } from '../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientButton } from '../components/GradientButton';
import { Typography, Spacing, Radius, Shadow } from '../theme';
import { getCurrentUserFromState, verifyOtpWithBackend } from '../services/authService';
import { userService } from '../services/userService';
import { errorHandler } from '../utils/errorHandler';
import type { User as ApiUser } from '../types/api';
import type { RootStackParamList } from '../navigation/types';
import { logger } from '../utils/logger';
import { formatPhone } from '../utils/region';
import { clearProfileDraft, loadProfileDraft, saveProfileDraft } from '../utils/profileDraft';
import { pickProfilePhoto } from '../utils/profilePhoto';
import { useTranslation } from 'react-i18next';

import { tc, tk } from '../theme/themed';

// ─── Main Screen ───────────────────────────────────────────────────────────────

export function ProfileSetupScreen() {
  const {
    setRole,
    setUser,
    firebaseUser
  } = useApp();
  const { t } = useTranslation();
  // Set when a new phone number was just verified and has no account yet
  const pendingSignup = useRoute<RouteProp<RootStackParamList, 'ProfileSetup'>>().params;
  const insets = useSafeAreaInsets();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  // The chosen picture's bytes, uploaded once the account exists. A Google
  // picture has none: the backend already took it from the sign-in.
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Google and email sign-ins already own an email; a new phone account does not
  const emailLocked = !pendingSignup && !!firebaseUser?.email;

  // Back from a restart: Android killed the app while the camera or gallery was
  // open. Put the form back, then the photo the person picked before it died.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const draft = await loadProfileDraft();
      if (cancelled || !draft) return;
      setFirstName(draft.firstName);
      setLastName(draft.lastName);
      setEmail(draft.email);
      if (draft.dob) setDob(new Date(draft.dob));
      if (draft.photoUri) setPhotoUri(draft.photoUri);
      if (Platform.OS !== 'android') return;
      try {
        const pending = await ImagePicker.getPendingResultAsync();
        if (!cancelled && pending && 'assets' in pending && !pending.canceled && pending.assets[0]) {
          setPhotoUri(pending.assets[0].uri);
          setPhotoBase64(pending.assets[0].base64 ?? null);
        }
      } catch (error) {
        logger.warn('Could not recover the picked photo', { error });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Saved just before leaving the app for the camera or gallery
  const saveDraft = useCallback(
    () =>
      saveProfileDraft({
        pendingSignup: pendingSignup ? { phone: pendingSignup.phone, otp: pendingSignup.otp } : undefined,
        firstName,
        lastName,
        email,
        dob: dob?.toISOString() ?? null,
        photoUri,
      }),
    [pendingSignup, firstName, lastName, email, dob, photoUri],
  );

  // Pre-fill from Firebase user
  useEffect(() => {
    // A newly verified phone is a new account: nothing from another sign-in
    // left on this phone belongs in it.
    if (pendingSignup?.phone) {
      setPhone(pendingSignup.phone);
      return;
    }
    if (firebaseUser) {
      if (firebaseUser.displayName) {
        const parts = firebaseUser.displayName.split(' ');
        setFirstName(parts[0] ?? '');
        setLastName(parts.slice(1).join(' '));
      }
      if (firebaseUser.phoneNumber) {
        setPhone(firebaseUser.phoneNumber);
      }
      if (firebaseUser.email) {
        setEmail(firebaseUser.email);
      }
      if (firebaseUser.photoURL) {
        setPhotoUri(firebaseUser.photoURL);
      }
      return;
    }
    // Phone sign-in goes through the backend, so prefill from its user.
    const backendUser = getCurrentUserFromState();
    if (backendUser?.phone) setPhone(backendUser.phone);
    if (backendUser?.email) setEmail(backendUser.email);
  }, [firebaseUser, pendingSignup?.phone]);

  // Google and email sign-ups add their number on its own screen; read it back on return
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  useFocusEffect(
    useCallback(() => {
      if (pendingSignup) return;
      userService.getMyProfile()
        .then(p => {
          const number = realPhone(p.phone);
          if (number) setPhone(number);
        })
        .catch(() => undefined);
    }, [pendingSignup]),
  );

  // A phone number is required: people are called on it, by riders, drivers and the safety team
  const isValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    dob !== null &&
    !!realPhone(phone);

  // ── Photo picker (WhatsApp-style: camera or gallery) ──────────────────────

  const choose = useCallback(async (source: 'camera' | 'library') => {
    // Android may stop the app while the camera or gallery is open
    await saveDraft();
    const picked = await pickProfilePhoto(source);
    if (picked) {
      setPhotoUri(picked.uri);
      setPhotoBase64(picked.base64);
    }
  }, [saveDraft]);
  const openCamera = useCallback(() => choose('camera'), [choose]);
  const openGallery = useCallback(() => choose('library'), [choose]);

  const handlePickPhoto = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('setup.cancel'), t('setup.takePhoto'), t('setup.fromGallery')],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) openCamera();
          if (buttonIndex === 2) openGallery();
        },
      );
    } else {
      // Android — use Alert as action sheet
      Alert.alert(t('setup.photoTitle'), t('setup.chooseOption'), [
        { text: t('setup.takePhoto'), onPress: openCamera },
        { text: t('setup.fromGallery'), onPress: openGallery },
        { text: t('setup.cancel'), style: 'cancel' },
      ]);
    }
  }, [openCamera, openGallery, t]);

  // ── Date picker ───────────────────────────────────────────────────────────

  const handleDateChange = useCallback(
    (_event: DateTimePickerEvent, selectedDate?: Date) => {
      setShowDatePicker(Platform.OS === 'ios'); // iOS keeps open; Android auto-closes
      if (selectedDate) {
        setDob(selectedDate);
      }
    },
    [],
  );

  const formatDate = (date: Date) => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  // ── Continue ──────────────────────────────────────────────────────────────

  const handleContinue = useCallback(async () => {
    if (!isValid) return;
    if (submitting) return;

    setSubmitting(true);
    try {
      // Prepare user data
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      
      let saved: ApiUser;
      if (pendingSignup) {
        // Creates the account and signs in with the code verified on the last screen
        const result = await verifyOtpWithBackend(
          pendingSignup.phone,
          pendingSignup.otp,
          fullName,
          email || undefined,
          dob?.toISOString(),
        );
        if ('needsProfile' in result) throw new Error(t('setup.notCreated'));
        saved = result.user;
      } else {
        // Already signed in (Google or email) but the account has no name yet
        saved = await userService.updateMyProfile({
          name: fullName,
          email: email || undefined,
          dateOfBirth: dob?.toISOString(),
        });
      }

      logger.info('Profile setup completed');
      await clearProfileDraft();

      // The account exists now; a failed upload must not undo the sign-up
      if (photoBase64) {
        try {
          await userService.setPhoto(photoBase64);
        } catch (error) {
          logger.warn('Profile photo upload failed', { error });
          Alert.alert(t('setup.photoTitle'), t('setup.photoFailed'));
        }
      }

      // Save profile info to context
      setUser({
        id: saved?._id ?? saved?.id ?? getCurrentUserFromState()?._id ?? firebaseUser?.uid ?? '',
        name: fullName,
        phone,
        avatarUrl: photoUri ?? undefined,
        isVerified: true,
      });

      // Default all new users to rider
      setRole('rider');
    } catch (error) {
      logger.error('Failed to submit profile', { error });
      Alert.alert(t('setup.saveFailed'), errorHandler.process(error).message);
    } finally {
      setSubmitting(false);
    }
  }, [isValid, submitting, firstName, lastName, phone, email, dob, photoUri, photoBase64, firebaseUser, setUser, setRole, pendingSignup, t]);

  // Siham is for adults: the picker stops at 18 years ago (the API checks too)
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - 18);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Title */}
        <Text style={[styles.title, tc.color_text]}>
          {t('setup.title')}
        </Text>

        {/* ── Profile Photo ──────────────────────────────────────────── */}
        <View style={styles.avatarSection}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('setup.addPhoto')}
            onPress={handlePickPhoto}
            activeOpacity={0.7}
            style={[
              styles.avatarContainer,
              tc.backgroundColor_primaryLight,
              tc.borderColor_border,
              Shadow.sm
            ]}
          >
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} />
            ) : (
              <Svg width={40} height={40} viewBox="0 0 24 24" fill={tk.primary}>
                <Path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </Svg>
            )}
            {/* Camera badge */}
            <View
              style={[
                styles.cameraBadge,
                tc.backgroundColor_primary,
              ]}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="white">
                <Path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z" />
                <Path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
              </Svg>
            </View>
          </TouchableOpacity>
          <Text style={[styles.avatarHint, tc.color_textSec]}>
            {t('setup.tapPhoto')}
          </Text>
        </View>

        {/* ── First Name ─────────────────────────────────────────────── */}
        <View
          style={[
            styles.inputContainer,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant,
            Shadow.sm
          ]}
        >
          <Text style={[styles.inputLabel, tc.color_textSec]}>{t('login.firstNameLabel')}</Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder={t('login.firstName')}
            placeholderTextColor={tk.textSec}
            autoCapitalize="words"
            style={[styles.input, tc.color_text]}
          />
        </View>

        {/* ── Last Name ──────────────────────────────────────────────── */}
        <View
          style={[
            styles.inputContainer,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant,
            Shadow.sm
          ]}
        >
          <Text style={[styles.inputLabel, tc.color_textSec]}>{t('login.lastNameLabel')}</Text>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            placeholder={t('login.lastName')}
            placeholderTextColor={tk.textSec}
            autoCapitalize="words"
            style={[styles.input, tc.color_text]}
          />
        </View>

        {/* ── Phone Number (read-only) ────────────────────────────────── */}
        <View
          style={[
            styles.inputContainer,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_border,
            Shadow.sm
          ]}
        >
          <Text style={[styles.inputLabel, tc.color_textSec]}>{t('setup.phoneLabel')}</Text>
          {pendingSignup ? (
            // Just verified at sign-in
            <TextInput
              value={phone ? formatPhone(phone) : ''}
              editable={false}
              style={[styles.input, tc.color_textSec]}
            />
          ) : (
            <Pressable
              onPress={() => navigation.navigate('PhoneNumber')}
              accessibilityRole="button"
              accessibilityLabel={realPhone(phone) ? t('setup.changePhone', { phone: formatPhone(phone) }) : t('setup.addPhone')}
              style={styles.phoneButton}
            >
              <Text style={[styles.input, styles.phoneButtonText, realPhone(phone) ? tc.color_text : tc.color_primary]}>
                {realPhone(phone) ? formatPhone(phone) : t('setup.addPhone')}
              </Text>
              <Icon name="chevron-right" size={22} color={tk.textSec} />
            </Pressable>
          )}
        </View>

        {/* ── Email ──────────────────────────────────────────────────── */}
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
            placeholder={t('login.emailPlaceholder')}
            placeholderTextColor={tk.textSec}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!emailLocked}
            style={[
              styles.input,
              emailLocked ? tc.color_textSec : tc.color_text,
            ]}
          />
        </View>

        {/* ── Date of Birth ──────────────────────────────────────────── */}
        <TouchableOpacity accessibilityRole="button"
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.7}
          style={[
            styles.inputContainer,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant,
            Shadow.sm
          ]}
        >
          <Text style={[styles.inputLabel, tc.color_textSec]}>{t('setup.dobLabel')}</Text>
          <View style={styles.dateRow}>
            <Text
              style={[
                styles.dateText,
                dob ? tc.color_text : tc.color_textSec,
              ]}
            >
              {dob ? formatDate(dob) : t('setup.dobPlaceholder')}
            </Text>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill={tk.textSec}>
              <Path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7v-5z" />
            </Svg>
          </View>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={dob ?? maxDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={maxDate}
            onChange={handleDateChange}
          />
        )}

        {/* ── Continue CTA ────────────────────────────────────────────── */}
        <View style={styles.cta}>
          <GradientButton
            label={submitting ? t('setup.saving') : t('setup.continue')}
            onPress={handleContinue}
            disabled={!isValid || submitting}
            colorStart={tk.primary}
            colorEnd={tk.primaryDark}
            disabledColor={tk.border}
            height={54}
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
  scrollContent: {
    flexGrow: 1,
    padding: Spacing['2xl'],
    gap: Spacing.lg,
  },
  title: {
    fontSize: Typography['5xl'],
    fontWeight: Typography.extrabold,
    marginBottom: Spacing.xs,
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarHint: {
    fontSize: Typography.sm,
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
  phoneButton: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  phoneButtonText: { flex: 1, height: undefined },

  // Date row
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  dateText: {
    fontSize: Typography.xl,
    fontWeight: Typography.medium,
  },

  // CTA
  cta: {
    marginTop: Spacing.xl,
  },
});
