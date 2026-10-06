/**
 * LanguageScreen.tsx
 *
 * Settings → Language (UC-X03). The app changes at once; the choice is kept
 * on the phone and on the account, so pushes and messages follow it. Only
 * languages native speakers have reviewed are listed.
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { ActivityIndicator } from '../../components/Themed';
import { Text } from '../../components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Icon } from '../../components/Icon';
import { changeLanguage } from '../../i18n';
import { offeredLanguages, type LanguageCode } from '../../i18n/languages';
import { userService } from '../../services/userService';
import { tc, tk } from '../../theme/themed';

export function LanguageScreen() {
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
    <View style={[s.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      <ScreenHeader title={t('language.title')} />
      <ScrollView contentContainerStyle={s.body}>
        <Text style={[{ fontSize: 14, lineHeight: 21 }, tc.color_textSec]}>{t('language.intro')}</Text>
        <View style={[s.card, tc.backgroundColor_surfaceVariant, tc.borderColor_surfaceVariant]} accessibilityRole="radiogroup">
          {offeredLanguages().map((language, i) => {
            const selected = i18n.language === language.code;
            return (
              <Pressable
                key={language.code}
                onPress={() => choose(language.code)}
                style={[s.row, i > 0 && [{ borderTopWidth: 1 }, tc.borderTopColor_border]]}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLanguage={language.code}
              >
                <View style={s.flex1}>
                  <Text style={[{ fontSize: 16, fontWeight: '600' }, tc.color_text]}>{language.nativeName}</Text>
                  {language.nativeName !== language.name ? <Text style={[{ fontSize: 13 }, tc.color_textSec]}>{language.name}</Text> : null}
                </View>
                {saving === language.code ? (
                  <ActivityIndicator color={tk.primary} />
                ) : selected ? (
                  <Icon name="check-circle" size={22} color={tk.primary} />
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
