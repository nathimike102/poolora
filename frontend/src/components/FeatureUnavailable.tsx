/**
 * components/FeatureUnavailable.tsx
 *
 * Shown for features that are planned but not built yet, instead of a mock UI
 * with placeholder people and data.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../context/AppContext';
import { BackButton } from './BackButton';
import { Icon, type IconName } from './Icon';

interface FeatureUnavailableProps {
  title: string;
  description: string;
  icon: IconName;
}

export function FeatureUnavailable({ title, description, icon }: FeatureUnavailableProps) {
  const navigation = useNavigation();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>
      <View style={styles.body}>
        <View style={[styles.iconWrap, { backgroundColor: c.primaryLight }]}>
          <Icon name={icon} size={40} color={c.primary} />
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>{title}</Text>
        <Text style={[styles.description, { color: c.textSec }]}>{description}</Text>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          style={[styles.button, { backgroundColor: c.primary }]}
        >
          <Text style={[styles.buttonText, { color: c.textOnPrimary }]}>Go back</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 12 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 64 },
  iconWrap: { width: 80, height: 80, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  description: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  button: { marginTop: 24, minHeight: 48, paddingHorizontal: 28, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
