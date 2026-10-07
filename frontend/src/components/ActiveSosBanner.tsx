/**
 * components/ActiveSosBanner.tsx
 *
 * While an SOS is open, a red bar on every screen leads back to it, so someone
 * who leaves the SOS screen (or whose app was closed and reopened) can still
 * see that help is on the way and answer the safety team. When the team asks
 * for video it says so and the phone buzzes. A cold start with an SOS open goes
 * straight to the SOS screen.
 *
 * The bar sits above the app, not over it, so no header or back button is
 * hidden: it takes the status-bar space and the screens below are told there
 * is no top inset.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import * as Haptics from 'expo-haptics';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';

import { safetyService, type SOSResponse } from '../services/safetyService';
import { initSocket } from '../utils/socket';
import { Icon } from './Icon';
import type { RootStackParamList } from '../navigation/types';

const POLL_MS = 20_000;
/** Deep enough for white text in both themes */
const SOS_RED = '#C62828';

interface Props {
  children: React.ReactNode;
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>;
  /** The screen showing now; the bar hides on the SOS screen itself */
  currentRoute: string | undefined;
}

export function ActiveSosBanner({ children, navigationRef, currentRoute }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [sos, setSos] = useState<SOSResponse | null>(null);
  const openedOnStart = useRef(false);
  const lastVideoAsk = useRef<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const { sos: current } = await safetyService.getCurrentSOS();
      setSos(current && !current.resolvedAt && !current.cancelledAt ? current : null);
    } catch {
      // Keep what we last knew: an SOS must not vanish because one check failed
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const socket = initSocket();
    const onUpdate = () => refresh();
    socket.on('sos:updated', onUpdate);
    return () => {
      clearInterval(timer);
      appState.remove();
      socket.off('sos:updated', onUpdate);
    };
  }, [refresh]);

  const openSos = useCallback(() => {
    if (navigationRef.isReady()) navigationRef.navigate('SOS', undefined);
  }, [navigationRef]);

  // Reopened during an SOS: straight back to it, once
  useEffect(() => {
    if (sos && !openedOnStart.current) {
      openedOnStart.current = true;
      if (currentRoute !== 'SOS') openSos();
    }
  }, [sos, currentRoute, openSos]);

  // The safety team asked for video: buzz, without a sound
  const videoAsked = sos?.video?.requestedAt && !sos.video.startedAt && !sos.video.endedAt ? sos.video.requestedAt : undefined;
  useEffect(() => {
    if (videoAsked && videoAsked !== lastVideoAsk.current && currentRoute !== 'SOS') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    }
    lastVideoAsk.current = videoAsked;
  }, [videoAsked, currentRoute]);

  if (!sos || currentRoute === 'SOS') return <>{children}</>;

  const title = videoAsked ? t('sos.banner.videoAsked') : t('sos.banner.open');
  return (
    <View style={styles.flex1}>
      <View style={[styles.wrap, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={openSos}
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${t('sos.banner.tap')}`}
          accessibilityLiveRegion="assertive"
          style={styles.bar}
        >
          <Icon name={videoAsked ? 'video-outline' : 'alarm-light-outline'} size={20} color="#FFFFFF" />
          <View style={styles.flex1}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Text style={styles.sub} numberOfLines={1}>{t('sos.banner.tap')}</Text>
          </View>
          <Icon name="chevron-right" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
      {/* The bar already covers the status bar, so the screens below start right under it */}
      <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
        <View style={styles.flex1}>{children}</View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingBottom: 6, backgroundColor: SOS_RED },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, minHeight: 48 },
  flex1: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  sub: { color: '#FFFFFF', fontSize: 12, opacity: 0.9 },
});
