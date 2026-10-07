/**
 * components/CountryPicker.tsx
 *
 * The calling-code button at sign-in and the searchable list it opens. It
 * starts on the country the phone is in; anyone can pick another.
 */

import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Icon } from './Icon';
import { Text, TextInput } from './Text';
import { COUNTRIES, countryByCode, flagOf, type Country } from '../utils/countries';
import { Radius, Spacing, Typography } from '../theme';
import { tc, tk } from '../theme/themed';

interface Props {
  value: Country;
  onChange: (country: Country) => void;
  /** Shown first: where the phone is, and where Siham runs */
  suggested?: (string | undefined)[];
}

export function CountryPicker({ value, onChange, suggested = [] }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const suggestedKey = suggested.join();
  const list = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, '');
    if (!q) {
      const first = [...new Set(suggestedKey.split(','))].map(code => countryByCode(code)).filter((c): c is Country => !!c);
      return [...first, ...COUNTRIES.filter(c => !first.includes(c))];
    }
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(q) || c.dial.slice(1).startsWith(q) || c.code.toLowerCase() === q);
  }, [query, suggestedKey]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('countryPicker.button', { country: value.name, dial: value.dial })}
        style={styles.button}
        hitSlop={8}
      >
        <Text style={styles.flag}>{flagOf(value.code)}</Text>
        <Text style={[styles.dial, tc.color_text]}>{value.dial}</Text>
        <Icon name="chevron-down" size={18} color={tk.textSec} />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={close}>
        <View style={[styles.sheet, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom }, tc.backgroundColor_surface]}>
          <View style={styles.header}>
            <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={t('countryPicker.close')} hitSlop={10}>
              <Icon name="close" size={24} color={tk.text} />
            </Pressable>
            <Text style={[styles.title, tc.color_text]} accessibilityRole="header">{t('countryPicker.title')}</Text>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('countryPicker.search')}
            placeholderTextColor={tk.textSec}
            autoFocus
            autoCorrect={false}
            style={[styles.search, tc.backgroundColor_surfaceVariant, tc.color_text]}
          />
          <FlatList
            data={list}
            keyExtractor={c => c.code}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            renderItem={({ item }) => {
              const on = item.code === value.code;
              return (
                <Pressable
                  onPress={() => {
                    onChange(item);
                    close();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={styles.flag}>{flagOf(item.code)}</Text>
                  <Text style={[styles.name, tc.color_text, on && styles.bold]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.rowDial, tc.color_textSec]}>{item.dial}</Text>
                </Pressable>
              );
            }}
            ListEmptyComponent={<Text style={[styles.empty, tc.color_textSec]}>{t('countryPicker.none')}</Text>}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flag: { fontSize: 22 },
  dial: { fontSize: Typography['2xl'], fontWeight: Typography.bold },
  sheet: { flex: 1, paddingHorizontal: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, marginBottom: Spacing.md },
  title: { fontSize: Typography['2xl'], fontWeight: Typography.bold },
  search: { minHeight: 48, borderRadius: Radius.xl, paddingHorizontal: Spacing.lg, fontSize: Typography.lg, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 52 },
  name: { flex: 1, fontSize: Typography.lg },
  bold: { fontWeight: Typography.bold },
  rowDial: { fontSize: Typography.lg },
  empty: { textAlign: 'center', marginTop: Spacing.xl, fontSize: Typography.lg },
});
