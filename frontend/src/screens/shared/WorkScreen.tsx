/**
 * WorkScreen.tsx
 *
 * Profile → Work (UC-C02). Staff of a company with a Poolora programme
 * confirm a work email to join it; the link goes to that address, so only
 * someone who can read the company's mail can join.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../context/AppContext';
import { BackButton } from '../../components/BackButton';
import { Icon } from '../../components/Icon';
import { userService } from '../../services/userService';
import type { WorkStatus } from '../../types/api';
import { errorHandler } from '../../utils/errorHandler';
import { money, REGION } from '../../utils/region';

export function WorkScreen() {
  const navigation = useNavigation();
  const { c } = useApp();
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
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '700', color: c.text }}>{t('work.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 14, color: c.textSec, lineHeight: 21 }}>{t('work.intro')}</Text>
        {!status ? <ActivityIndicator color={c.primary} /> : null}

        {status?.work ? (
          <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={s.row}>
              <Icon name="briefcase-check-outline" size={24} color={c.success} />
              <Text style={[s.cardTitle, { color: c.text }]}>{t('work.memberTitle', { company: status.work.organisation.name })}</Text>
            </View>
            <Text style={{ color: c.textSec }}>
              {t('work.memberBody', {
                email: status.work.email,
                date: new Date(status.work.since).toLocaleDateString(REGION.dateLocale, { day: 'numeric', month: 'short', year: 'numeric' }),
              })}
            </Text>
            {status.work.contribution ? (
              <Text style={{ color: c.text, lineHeight: 20 }}>
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
              <Text style={{ color: c.textSec }}>{t('work.paysNothing', { company: status.work.organisation.name })}</Text>
            )}
            {status.work.organisation.contributionPaused ? <Text style={{ color: c.warning }}>{t('work.paused', { company: status.work.organisation.name })}</Text> : null}
            {!status.work.organisation.active ? <Text style={{ color: c.warning }}>{t('work.suspended')}</Text> : null}
            <Pressable onPress={leave} disabled={busy} accessibilityRole="button" style={s.link}>
              <Text style={{ color: c.error, fontWeight: '600' }}>{t('work.leave')}</Text>
            </Pressable>
          </View>
        ) : null}

        {status?.pending && !status.work && !changing ? (
          <View style={[s.card, { backgroundColor: c.primaryLight, borderColor: c.primaryLight }]} accessibilityLiveRegion="polite">
            <View style={s.row}>
              <Icon name="email-check-outline" size={24} color={c.primary} />
              <Text style={[s.cardTitle, { color: c.text }]}>{t('work.sentTitle')}</Text>
            </View>
            <Text style={{ color: c.text, lineHeight: 20 }}>{t('work.sentBody', { email: status.pending.email })}</Text>
            <Pressable onPress={() => setChanging(true)} accessibilityRole="button" style={s.link}>
              <Text style={{ color: c.primary, fontWeight: '600' }}>{t('work.sendAgain')}</Text>
            </Pressable>
          </View>
        ) : null}

        {showForm ? (
          <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[s.cardTitle, { color: c.text }]}>{t('work.emailLabel')}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t('work.emailPlaceholder')}
              placeholderTextColor={c.textSec}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              accessibilityLabel={t('work.emailLabel')}
              style={[s.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
            />
            <Pressable
              onPress={send}
              disabled={!email.includes('@') || busy}
              accessibilityRole="button"
              style={[s.submit, { backgroundColor: email.includes('@') ? c.primary : c.border }]}
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
