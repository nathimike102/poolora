/**
 * CarTrackerScreen.tsx
 *
 * A driver links the GPS tracker in their car. The tracker keeps the car
 * traceable during a ride even when every phone in it is off, and its panic
 * button raises an SOS. Riders see a "Tracked car" badge on the driver's
 * rides. Optional (decided 1 October 2026).
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { BackButton } from '../../components/BackButton';
import { Icon } from '../../components/Icon';
import { trackerService, type TrackerStatus } from '../../services/trackerService';
import { errorHandler } from '../../utils/errorHandler';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return i18n.t('carTracker.ago.now');
  if (mins < 60) return i18n.t('carTracker.ago.mins', { count: mins });
  const hours = Math.round(mins / 60);
  return hours < 48 ? i18n.t('carTracker.ago.hours', { count: hours }) : i18n.t('carTracker.ago.days', { count: Math.round(hours / 24) });
}

export function CarTrackerScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<TrackerStatus | null>(null);
  const [ids, setIds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    trackerService.status().then(setStatus).catch(error => Alert.alert(t('carTracker.couldNotLoad'), errorHandler.process(error).message));
  }, [t]);
  useFocusEffect(load);

  const link = async (vehicleId: string) => {
    setBusy(vehicleId);
    try {
      setStatus(await trackerService.link(vehicleId, ids[vehicleId] ?? ''));
    } catch (error) {
      Alert.alert(t('carTracker.notLinked'), errorHandler.process(error).message);
    } finally {
      setBusy(null);
    }
  };

  const unlink = (vehicleId: string) =>
    Alert.alert(t('carTracker.unlinkThisTracker'), t('carTracker.yourRidesLoseTheTracked'), [
      { text: t('carTracker.keepIt'), style: 'cancel' },
      {
        text: t('carTracker.unlink'),
        style: 'destructive',
        onPress: async () => {
          setBusy(vehicleId);
          try {
            setStatus(await trackerService.unlink(vehicleId));
          } catch (error) {
            Alert.alert(t('carTracker.notUnlinked'), errorHandler.process(error).message);
          } finally {
            setBusy(null);
          }
        },
      },
    ]);

  const gateway = status?.gateway;

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '700', color: c.text }}>{t('carTracker.carTracker')}</Text>
      </View>

      <ScrollView contentContainerStyle={s.body}>
        <Text style={{ fontSize: 14, color: c.textSec, lineHeight: 21 }}>
          {t('carTracker.aGpsTrackerInYour')}
        </Text>
        <View style={[s.note, { backgroundColor: c.primaryLight }]}>
          <Icon name="shield-lock-outline" size={20} color={c.primary} />
          <Text style={{ flex: 1, fontSize: 13, color: c.text, lineHeight: 19 }}>
            {t('carTracker.pooloraKeepsWhereYourCar')}
          </Text>
        </View>

        {!status ? <ActivityIndicator color={c.primary} /> : null}
        {status && !status.vehicles.length ? (
          <Text style={{ color: c.textSec }}>{t('carTracker.addYourCarInDriver')}</Text>
        ) : null}

        {status?.vehicles.map(v => (
          <View key={v._id} style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>{v.name}</Text>
            <Text style={{ fontSize: 13, color: c.textSec }}>{v.plateNumber}</Text>
            {v.tracker ? (
              <>
                <View style={s.row}>
                  <Icon name={v.tracker.tracked ? 'check-circle' : 'clock-outline'} size={18} color={v.tracker.tracked ? c.success : c.textSec} />
                  <Text style={{ flex: 1, fontSize: 14, color: c.text }} accessibilityLiveRegion="polite">
                    {v.tracker.lastReportAt
                      ? t('carTracker.statusLine', { state: v.tracker.tracked ? t('carTracker.working') : t('carTracker.notHeardFromRecently'), when: ago(v.tracker.lastReportAt) })
                      : t('carTracker.waitingFirst')}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: c.textSec }}>{t('carTracker.device', { id: v.tracker.deviceId })}</Text>
                <Pressable onPress={() => unlink(v._id)} disabled={busy === v._id} accessibilityRole="button">
                  <Text style={{ color: c.error, fontWeight: '600' }}>{t('carTracker.unlink')}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <TextInput
                  value={ids[v._id] ?? ''}
                  onChangeText={t => setIds(prev => ({ ...prev, [v._id]: t }))}
                  placeholder={t('carTracker.deviceIdImei15Digits')}
                  placeholderTextColor={c.textSec}
                  keyboardType="number-pad"
                  maxLength={24}
                  accessibilityLabel={t('carTracker.deviceLabel', { name: v.name })}
                  style={[s.input, { color: c.text, borderColor: c.border, backgroundColor: c.bg }]}
                />
                <Pressable
                  onPress={() => link(v._id)}
                  disabled={!(ids[v._id] ?? '').trim() || busy === v._id}
                  style={[s.btn, { backgroundColor: (ids[v._id] ?? '').trim() ? c.primary : c.border }]}
                  accessibilityRole="button"
                >
                  {busy === v._id ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '700' }}>{t('carTracker.linkTracker')}</Text>}
                </Pressable>
              </>
            )}
          </View>
        ))}

        <Text style={[s.title, { color: c.text }]}>{t('carTracker.pointYourTrackerAtPoolora')}</Text>
        {gateway ? (
          <>
            <Text style={{ fontSize: 14, color: c.text, lineHeight: 21 }}>
              {t('carTracker.mostTrackersAreSetBy')}
            </Text>
            <Text selectable style={[s.code, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}>
              {`SERVER,1,${gateway.host},${gateway.port},0#`}
            </Text>
            <Text style={{ fontSize: 13, color: c.textSec, lineHeight: 19 }}>
              Check your tracker's manual: some need a password first, and the SIM needs data. The device id is the IMEI on its label (or text it IMEI#).
            </Text>
          </>
        ) : (
          <Text style={{ fontSize: 14, color: c.textSec }}>{t('carTracker.serverSetup')}</Text>
        )}
        <Text style={[s.title, { color: c.text }]}>{t('carTracker.trackerFromATrackingCompany')}</Text>
        <Text style={{ fontSize: 14, color: c.text, lineHeight: 21 }}>
          Ask them to forward your car to Poolora. Most platforms can (Wialon, Traccar, GPSWox). Link the same device id here. Poolora never cuts a car's engine.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1 },
  body: { padding: 20, gap: 14, paddingBottom: 40 },
  note: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: 14 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 16, letterSpacing: 1 },
  btn: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  code: { fontFamily: 'monospace', fontSize: 15, padding: 12, borderRadius: 10, borderWidth: 1 },
});
