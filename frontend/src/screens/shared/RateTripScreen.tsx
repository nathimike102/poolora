/**
 * screens/shared/RateTripScreen.tsx
 *
 * Rating a trip after leaving the ride screen: from ride history, or after
 * the reminder a day later (UC-R06 3a). Ratings close 7 days after the trip.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { BackButton } from '../../components/BackButton';
import { RatingForm } from '../../components/RatingForm';
import type { RootStackParamList } from '../../navigation/types';
import { ratingService } from '../../services/ratingService';
import { useTranslation } from 'react-i18next';

export function RateTripScreen() {
  const { bookingId, rateeName, summary } = useRoute<RouteProp<RootStackParamList, 'RateTrip'>>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { c } = useApp();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">{t('rateTrip.rateYourTrip')}</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {summary ? <Text style={{ fontSize: 14, color: c.textSec, textAlign: 'center' }}>{summary}</Text> : null}
        <RatingForm
          rateeName={rateeName}
          onSubmit={async input => {
            await ratingService.submitRating(bookingId, input);
            Alert.alert(t('rateTrip.thanksForYourRating'), t('rateTrip.itHelpsKeepPooloraSafe'), [{ text: t('rateTrip.ok'), onPress: () => navigation.goBack() }]);
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
});
