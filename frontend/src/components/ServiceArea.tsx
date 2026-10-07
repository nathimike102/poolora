/**
 * components/ServiceArea.tsx
 *
 * Where Siham has not launched yet, rides cannot be booked or offered. The
 * banner says so on the home screens; the gate stands in for the screens that
 * start a booking, a parcel, a group trip or a new ride. The account itself
 * works anywhere.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ActivityIndicator } from './Themed';
import { EmptyState } from './EmptyState';
import { Icon } from './Icon';
import { ScreenHeader } from './ScreenHeader';
import { Text } from './Text';
import { checkTestServer, detectCountry, ridesAvailable, useLocationCountry } from '../services/locationCountry';
import { countryByCode } from '../utils/countries';
import { REGION } from '../utils/region';
import { Radius, Spacing, Typography } from '../theme';
import { tc, tk } from '../theme/themed';

/** The phone's country and whether rides are open there, checked again on each mount */
export function useServiceArea() {
  const country = useLocationCountry();
  useEffect(() => {
    detectCountry();
    checkTestServer();
  }, []);
  return {
    available: ridesAvailable(country),
    countryName: countryByCode(country.code)?.name ?? country.code ?? '',
    testServer: !!country.testServer,
  };
}

/** A line on the home screen when rides are not open where the phone is */
export function ServiceAreaBanner() {
  const { t } = useTranslation();
  const { available, countryName } = useServiceArea();
  if (available !== false) return null;
  return (
    <View style={[styles.banner, tc.backgroundColor_surfaceVariant, tc.cardOutline]} accessibilityRole="alert">
      <Icon name="earth-off" size={22} color={tk.primary} />
      <View style={styles.flex1}>
        <Text style={[styles.bannerTitle, tc.color_text]}>{t('serviceArea.title', { country: countryName })}</Text>
        <Text style={[styles.bannerBody, tc.color_textSec]}>{t('serviceArea.banner', { market: REGION.countryName })}</Text>
      </View>
    </View>
  );
}

type Kind = 'book' | 'offer' | 'parcel' | 'trip';

/**
 * Wraps a screen that starts a ride. Where rides are not open it shows why
 * instead; `tab` screens have no back arrow. The screen is passed as a getter
 * so its code still loads only when it is first opened (inline requires).
 */
export function withServiceArea<P extends object>(getScreen: () => React.ComponentType<P>, kind: Kind, tab = false) {
  return function ServiceAreaGate(props: P) {
    const { t } = useTranslation();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { available, countryName } = useServiceArea();
    if (available === true) {
      const Screen = getScreen();
      return <Screen {...props} />;
    }
    return (
      <View style={[styles.root, { paddingTop: tab ? insets.top : 0 }, tc.backgroundColor_surface]}>
        {tab ? null : <ScreenHeader title="" />}
        {available === undefined ? (
          <ActivityIndicator style={styles.checking} color={tk.primary} />
        ) : (
          <EmptyState
            icon="worldMap"
            title={t('serviceArea.title', { country: countryName })}
            body={`${t(`serviceArea.${kind}`)} ${t('serviceArea.account', { market: REGION.countryName })}`}
            action={tab || !navigation.canGoBack() ? undefined : { label: t('serviceArea.back'), onPress: () => navigation.goBack() }}
          />
        )}
      </View>
    );
  };
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  checking: { marginTop: Spacing['3xl'] },
  banner: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.xl, marginBottom: Spacing.lg },
  bannerTitle: { fontSize: Typography.lg, fontWeight: Typography.bold },
  bannerBody: { fontSize: Typography.md, marginTop: 2, lineHeight: 19 },
});
