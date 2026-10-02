/**
 * LanguageScreen.tsx
 *
 * Settings → Language (UC-X03). The app changes at once; the choice is kept
 * on the phone and on the account, so pushes and messages follow it. Only
 * languages native speakers have reviewed are listed.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../context/AppContext';
import { BackButton } from '../../components/BackButton';
import { Icon } from '../../components/Icon';
import { changeLanguage } from '../../i18n';
import { offeredLanguages, type LanguageCode } from '../../i18n/languages';
import { userService } from '../../services/userService';

export function LanguageScreen() {
  const navigation = useNavigation();
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const [saving, setSaving] = useState<LanguageCode | null>(null);

  const choose = async (code: LanguageCode) => {
    if (code === i18n.language || saving) return;
    setSaving(code);
    await changeLanguage(code);
    try {
      await userService.updateMyProfile({ language: code });
    } catch {
      Alert.alert(t('language.title'), t('language.saveFailed'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '700', color: c.text }}>{t('language.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={{ fontSize: 14, color: c.textSec, lineHeight: 21 }}>{t('language.intro')}</Text>
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]} accessibilityRole="radiogroup">
          {offeredLanguages().map((language, i) => {
            const selected = i18n.language === language.code;
            return (
              <Pressable
                key={language.code}
                onPress={() => choose(language.code)}
                style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.border }]}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLanguage={language.code}
              >
                <View style={s.flex1}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: c.text }}>{language.nativeName}</Text>
                  {language.nativeName !== language.name ? <Text style={{ fontSize: 13, color: c.textSec }}>{language.name}</Text> : null}
                </View>
                {saving === language.code ? (
                  <ActivityIndicator color={c.primary} />
                ) : selected ? (
                  <Icon name="check-circle" size={22} color={c.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1 },
  body: { padding: 20, gap: 14, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 16, paddingVertical: 10 },
});
