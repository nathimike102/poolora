/**
 * WorkScreen.tsx
 *
 * Profile → Work (UC-C02). Staff of a company with a Siham programme
 * confirm a work email to join it; the link goes to that address, so only
 * someone who can read the company's mail can join.
 */

import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { ActivityIndicator } from '../../components/Themed';
import { Text, TextInput } from '../../components/Text';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Icon } from '../../components/Icon';
import { userService } from '../../services/userService';
import type { WorkStatus } from '../../types/api';
import { errorHandler } from '../../utils/errorHandler';
import { money, REGION } from '../../utils/region';
import { tc, tk } from '../../theme/themed';

export function WorkScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<WorkStatus | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState(false);

  const load = useCallback(() => {
    userService.getWork()
      .then(s => {
        setStatus(s);
        setChanging(false);
      })
      .catch(error => Alert.alert(t('work.couldNotLoad'), errorHandler.process(error).message));
  }, [t]);
  useFocusEffect(load);

  const send = async () => {
    if (!email.includes('@') || busy) return;
    setBusy(true);
    try {
      await userService.joinWork(email.trim());
      setEmail('');
      load();
    } catch (error) {
      Alert.alert(t('work.notSent'), errorHandler.process(error).message);
    } finally {
      setBusy(false);
    }
  };

  const leave = () => {
    if (!status?.work) return;
    Alert.alert(t('work.leaveTitle', { company: status.work.organisation.name }), t('work.leaveBody'), [
      { text: t('work.cancel'), style: 'cancel' },
      {
        text: t('work.leave'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await userService.leaveWork();
            load();
          } catch (error) {
            Alert.alert(t('work.notSent'), errorHandler.process(error).message);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const showForm = status && (!status.pending || changing) && !status.work;

  return (
    <View style={[s.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      <ScreenHeader title={t('work.title')} />

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={[{ fontSize: 14, lineHeight: 21 }, tc.color_textSec]}>{t('work.intro')}</Text>
        {!status ? <ActivityIndicator color={tk.primary} /> : null}

        {status?.work ? (
          <View style={[s.card, tc.backgroundColor_surfaceVariant, tc.borderColor_surfaceVariant]}>
            <View style={s.row}>
              <Icon name="briefcase-check-outline" size={24} color={tk.success} />
              <Text style={[s.cardTitle, tc.color_text]}>{t('work.memberTitle', { company: status.work.organisation.name })}</Text>
            </View>
            <Text style={tc.color_textSec}>
              {t('work.memberBody', {
                email: status.work.email,
                date: new Date(status.work.since).toLocaleDateString(REGION.dateLocale, { day: 'numeric', month: 'short', year: 'numeric' }),
              })}
            </Text>
            {status.work.contribution ? (
              <Text style={[{ lineHeight: 20 }, tc.color_text]}>
                {t('work.pays', {
                  company: status.work.organisation.name,
                  percent: status.work.contribution.sharePercent,
                  trips: status.work.contribution.weekdaysOnly ? t('work.tripsWeekday') : t('work.tripsAll'),
                  sites: status.work.contribution.sites.join(', '),
                })}{' '}
                {status.work.contribution.monthlyCapUsd > 0
                  ? t('work.capUsed', { used: money(status.work.contribution.usedThisMonth), cap: money(status.work.contribution.monthlyCapUsd) })
                  : t('work.noCap')}
              </Text>
            ) : (
              <Text style={tc.color_textSec}>{t('work.paysNothing', { company: status.work.organisation.name })}</Text>
            )}
            {status.work.organisation.contributionPaused ? <Text style={tc.color_warning}>{t('work.paused', { company: status.work.organisation.name })}</Text> : null}
            {!status.work.organisation.active ? <Text style={tc.color_warning}>{t('work.suspended')}</Text> : null}
            <Pressable onPress={leave} disabled={busy} accessibilityRole="button" style={s.link}>
              <Text style={[{ fontWeight: '600' }, tc.color_error]}>{t('work.leave')}</Text>
            </Pressable>
          </View>
        ) : null}

        {status?.pending && !status.work && !changing ? (
          <View style={[s.card, tc.backgroundColor_primaryLight, tc.borderColor_primaryLight]} accessibilityLiveRegion="polite">
            <View style={s.row}>
              <Icon name="email-check-outline" size={24} color={tk.primary} />
              <Text style={[s.cardTitle, tc.color_text]}>{t('work.sentTitle')}</Text>
            </View>
            <Text style={[{ lineHeight: 20 }, tc.color_text]}>{t('work.sentBody', { email: status.pending.email })}</Text>
            <Pressable onPress={() => setChanging(true)} accessibilityRole="button" style={s.link}>
              <Text style={[{ fontWeight: '600' }, tc.color_primary]}>{t('work.sendAgain')}</Text>
            </Pressable>
          </View>
        ) : null}

        {showForm ? (
          <View style={[s.card, tc.backgroundColor_surfaceVariant, tc.borderColor_surfaceVariant]}>
            <Text style={[s.cardTitle, tc.color_text]}>{t('work.emailLabel')}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t('work.emailPlaceholder')}
              placeholderTextColor={tk.textSec}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              accessibilityLabel={t('work.emailLabel')}
              style={[s.input, tc.borderColor_border, tc.color_text, tc.backgroundColor_surface]}
            />
            <Pressable
              onPress={send}
              disabled={!email.includes('@') || busy}
              accessibilityRole="button"
              style={[s.submit, email.includes('@') ? tc.backgroundColor_primary : tc.backgroundColor_border]}
            >
              {busy ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>{t('work.send')}</Text>}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1 },
  body: { padding: 20, gap: 14, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  submit: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
