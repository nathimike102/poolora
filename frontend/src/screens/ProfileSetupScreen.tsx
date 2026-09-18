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
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Platform,
  ActionSheetIOS,
  KeyboardAvoidingView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { useApp } from '../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientButton } from '../components/GradientButton';
import { Typography, Spacing, Radius, Shadow } from '../theme';
import { submitKycToBackend } from '../services/authService';
import { logger } from '../utils/logger';

// ─── Main Screen ───────────────────────────────────────────────────────────────

export function ProfileSetupScreen() {
  const { c, setRole, setUser, firebaseUser } = useApp();
  const insets = useSafeAreaInsets();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill from Firebase user
  useEffect(() => {
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
    }
  }, [firebaseUser]);

  const isValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    dob !== null;

  // ── Photo picker (WhatsApp-style: camera or gallery) ──────────────────────

  const openCamera = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Camera access is required to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }, []);

  const openGallery = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Gallery access is required to choose a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }, []);

  const handlePickPhoto = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Gallery'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) openCamera();
          if (buttonIndex === 2) openGallery();
        },
      );
    } else {
      // Android — use Alert as action sheet
      Alert.alert('Profile Photo', 'Choose an option', [
        { text: 'Take Photo', onPress: openCamera },
        { text: 'Choose from Gallery', onPress: openGallery },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [openCamera, openGallery]);

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
      
      // Submit KYC data to backend
      await submitKycToBackend({
        name: fullName,
        phone,
        email: email || undefined,
        dateOfBirth: dob?.toISOString(),
        profilePhoto: photoUri,
      });

      logger.info('Profile setup completed');

      // Save profile info to context
      setUser({
        id: firebaseUser?.uid ?? '',
        name: fullName,
        phone,
        avatarUrl: photoUri ?? undefined,
        isVerified: true,
      });

      // Default all new users to rider
      setRole('rider');
    } catch (error) {
      logger.error('Failed to submit profile', { error });
      Alert.alert(
        'Setup Error',
        error instanceof Error ? error.message : 'Failed to save profile. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [isValid, submitting, firstName, lastName, phone, email, dob, photoUri, firebaseUser, setUser, setRole]);

  // Max date = 13 years ago (minimum age)
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - 13);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Title */}
        <Text style={[styles.title, { color: c.text }]}>
          Complete your profile
        </Text>

        {/* ── Profile Photo ──────────────────────────────────────────── */}
        <View style={styles.avatarSection}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Add profile photo"
            onPress={handlePickPhoto}
            activeOpacity={0.7}
            style={[
              styles.avatarContainer,
              {
                backgroundColor: c.primaryLight,
                borderColor: c.border,
              },
              Shadow.sm,
            ]}
          >
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} />
            ) : (
              <Svg width={40} height={40} viewBox="0 0 24 24" fill={c.primary}>
                <Path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </Svg>
            )}
            {/* Camera badge */}
            <View
              style={[
                styles.cameraBadge,
                { backgroundColor: c.primary },
              ]}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="white">
                <Path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z" />
                <Path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
              </Svg>
            </View>
          </TouchableOpacity>
          <Text style={[styles.avatarHint, { color: c.textSec }]}>
            Tap to add a photo
          </Text>
        </View>

        {/* ── First Name ─────────────────────────────────────────────── */}
        <View
          style={[
            styles.inputContainer,
            { backgroundColor: c.surface, borderColor: c.border },
            Shadow.sm,
          ]}
        >
          <Text style={[styles.inputLabel, { color: c.textSec }]}>FIRST NAME</Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor={c.textSec}
            autoCapitalize="words"
            style={[styles.input, { color: c.text }]}
          />
        </View>

        {/* ── Last Name ──────────────────────────────────────────────── */}
        <View
          style={[
            styles.inputContainer,
            { backgroundColor: c.surface, borderColor: c.border },
            Shadow.sm,
          ]}
        >
          <Text style={[styles.inputLabel, { color: c.textSec }]}>LAST NAME</Text>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
            placeholderTextColor={c.textSec}
            autoCapitalize="words"
            style={[styles.input, { color: c.text }]}
          />
        </View>

        {/* ── Phone Number (read-only) ────────────────────────────────── */}
        <View
          style={[
            styles.inputContainer,
            { backgroundColor: c.surfaceVariant, borderColor: c.border },
            Shadow.sm,
          ]}
        >
          <Text style={[styles.inputLabel, { color: c.textSec }]}>PHONE NUMBER</Text>
          <TextInput
            value={phone}
            editable={false}
            placeholder="Not available"
            placeholderTextColor={c.textDisabled}
            style={[styles.input, { color: c.textSec }]}
          />
        </View>

        {/* ── Email ──────────────────────────────────────────────────── */}
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
            placeholder="you@example.com"
            placeholderTextColor={c.textSec}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!firebaseUser?.email}
            style={[
              styles.input,
              { color: firebaseUser?.email ? c.textSec : c.text },
            ]}
          />
        </View>

        {/* ── Date of Birth ──────────────────────────────────────────── */}
        <TouchableOpacity accessibilityRole="button"
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.7}
          style={[
            styles.inputContainer,
            { backgroundColor: c.surface, borderColor: c.border },
            Shadow.sm,
          ]}
        >
          <Text style={[styles.inputLabel, { color: c.textSec }]}>DATE OF BIRTH</Text>
          <View style={styles.dateRow}>
            <Text
              style={[
                styles.dateText,
                { color: dob ? c.text : c.textSec },
              ]}
            >
              {dob ? formatDate(dob) : 'Select your date of birth'}
            </Text>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill={c.textSec}>
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
            label={submitting ? 'Saving Profile...' : 'Continue'}
            onPress={handleContinue}
            disabled={!isValid || submitting}
            colorStart={c.primary}
            colorEnd={c.primaryDark}
            disabledColor={c.border}
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
