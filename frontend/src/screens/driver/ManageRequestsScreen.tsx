import React, { useState } from 'react';
import {
  Alert,
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  Pressable,
  LayoutAnimation,
} from 'react-native';
import { ActivityIndicator } from '../../components/Themed';
import { Text } from '../../components/Text';
import { useFocusEffect } from '@react-navigation/native';
import { bookingService } from '../../services/bookingService';
import type { Booking, UserGender, BookingStatus } from '../../types/api';
import 'react-native';
import { StyleSheet as UStyleSheet } from 'react-native-unistyles';
import { LinearGradient } from '../../components/Themed';
import Svg, { Path } from '../../components/ThemedSvg';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ImageWithFallback } from '../../components/ImageWithFallback';
import { Shadow } from '../../theme';
import { Icon } from '../../components/Icon';
import { EmptyState } from '../../components/EmptyState';
import { errorHandler } from '../../utils/errorHandler';
import { money, REGION } from '../../utils/region';
import { useTranslation } from 'react-i18next';
import { tc, tk } from '../../theme/themed';

type Gender = UserGender;
type Status = BookingStatus;

interface RequestItem {
  id: string;
  tripId: string;
  rider: string;
  avatar?: string;
  rating: number | null;
  ratingCount: number;
  trips: number;
  from: string;
  to: string;
  date: string;
  seats: number;
  price: number;
  aiScore: number | null;
  passengers: Array<{ name: string; gender: string }>;
  /** The rider's company, when it is the driver's too (UC-C02) */
  colleagueAt?: string;
  status: Status;
  /** The rider's message with the request */
  note?: string;
  /** The rider is catching a bus from the drop (UC-R12) */
  bus?: { time: string; hub?: string };
  /** Stops the rider added on the way, in route order; accepting the request accepts them */
  stops: string[];
}

interface TripItem {
  id: string;
  label: string;
  from?: string;
  to?: string;
  date: string;
  totalSeats: number;
  filledSeats: number;
  earnings: number;
}



// TRIPS and REQUESTS will be derived from state

/* ── Sub-components ────────────────────────────────────────── */

function GenderBadge({ gender }: { gender: Gender }): React.ReactElement {
  const { t } = useTranslation();
  // The colour key; the label shown comes from the catalogue
  const normalizedGender = gender === 'male' ? 'Male' : gender === 'female' ? 'Female' : 'Other';
  const map: Record<string, { bg: string; border: string; text: string }> = {
    Female: { bg: '#FFF1F2', border: '#FCA5A5', text: '#E11D48' },
    Male:   { bg: '#EFF6FF', border: '#93C5FD', text: '#2563EB' },
    Other:  { bg: '#E3F2F1', border: '#9CD3CF', text: '#0B7A75' },
  };
  const s = map[normalizedGender];
  return (
    <View style={[styles.genderBadge, { backgroundColor: s.bg, borderColor: s.border }]}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: s.text }}>{t(`manageRequests.gender.${normalizedGender.toLowerCase()}`)}</Text>
    </View>
  );
}

function StatusChip({ status }: { status: Status }): React.ReactElement {
  const { t } = useTranslation();
  const map: Record<string, { label: string; bg: string; text: string }> = {
    pending:   { label: t('manageRequests.status.pending'),   bg: '#FEF3C7', text: '#D97706' },
    accepted:  { label: t('manageRequests.status.accepted'),  bg: '#D1FAE5', text: '#059669' },
    confirmed: { label: t('manageRequests.status.confirmed'), bg: '#D1FAE5', text: '#059669' },
    rejected:  { label: t('manageRequests.status.rejected'),  bg: '#FFF1F2', text: '#E11D48' },
    cancelled: { label: t('manageRequests.status.cancelled'), bg: '#FFF1F2', text: '#E11D48' },
    completed: { label: t('manageRequests.status.completed'), bg: '#D1FAE5', text: '#059669' },
  };
  const m = map[status] || { label: status, bg: '#F0F0F0', text: '#666' };
  return (
    <View style={[styles.statusChip, { backgroundColor: m.bg }]}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: m.text }}>{m.label}</Text>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export function ManageRequestsScreen(): React.ReactElement {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [trips, setTrips] = useState<TripItem[]>([]);
  const [activeTripId, setActiveTripId] = useState('');
  const [activeTab, setActiveTab] = useState<string>('pending');
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      const fetchBookings = async () => {
        try {
          setLoading(true);
          const res = await bookingService.getDriverBookings();
          if (isActive) {
            const bookings: Booking[] = res.data?.items || [];
            
            type PopulatedRide = {
              _id: string;
              pickup?: { address?: string };
              dropoff?: { address?: string };
              departureTime?: string;
              totalSeats?: number;
              availableSeats?: number;
              pricePerSeat?: number;
            };
            const rideOf = (b: Booking) => b.ride as unknown as PopulatedRide | undefined;

            const reqs: RequestItem[] = bookings.map(b => {
              const ride = rideOf(b);
              const stats = b.rider?.stats;
              const ratingCount = stats?.totalRatingsAsRider ?? 0;
              return {
                id: b._id,
                tripId: ride?._id ?? 'unknown',
                rider: b.rider?.name || t('manageRequests.rider'),
                colleagueAt: (b.rider as { colleagueAt?: string } | undefined)?.colleagueAt,
                avatar: b.rider?.profilePhotoUrl,
                rating: ratingCount > 0 ? stats?.avgRatingAsRider ?? null : null,
                ratingCount,
                trips: stats?.totalRidesAsRider ?? 0,
                from: b.pickup?.address || t('manageRequests.pickup'),
                to: b.dropoff?.address || t('manageRequests.drop'),
                date: ride?.departureTime
                  ? new Date(ride.departureTime).toLocaleString(REGION.dateLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : '',
                seats: b.seatsBooked,
                price: b.estimatedFare ?? 0,
                aiScore: b.matchScore ? Math.round(b.matchScore) : null,
                passengers: [{ name: b.rider?.name || t('manageRequests.rider'), gender: b.rider?.gender || '' }],
                status: b.status,
                note: b.note,
                stops: (b.stops ?? []).map(s => s.address),
                bus: b.connection
                  ? { time: new Date(b.connection.departsAt).toLocaleTimeString(REGION.dateLocale, { hour: '2-digit', minute: '2-digit' }), hub: b.connection.hubName }
                  : undefined,
              };
            });

            setRequests(reqs);

            // Group into trips
            const tripMap = new Map<string, TripItem>();
            bookings.forEach(b => {
              const ride = rideOf(b);
              if (!ride || tripMap.has(ride._id)) return;
              const totalSeats = ride.totalSeats ?? 0;
              const filledSeats = totalSeats - (ride.availableSeats ?? 0);
              tripMap.set(ride._id, {
                id: ride._id,
                label: t('common.route', { from: ride.pickup?.address || t('common.start'), to: ride.dropoff?.address || t('common.endLower') }),
                from: ride.pickup?.address,
                to: ride.dropoff?.address,
                date: ride.departureTime ? new Date(ride.departureTime).toLocaleDateString(REGION.dateLocale, { day: 'numeric', month: 'short' }) : '',
                totalSeats,
                filledSeats,
                earnings: (ride.pricePerSeat ?? 0) * filledSeats,
              });
            });
            const fetchedTrips = Array.from(tripMap.values());
            setTrips(fetchedTrips);
            if (fetchedTrips.length > 0 && !activeTripId) {
              setActiveTripId(fetchedTrips[0].id);
            }
          }
        } catch {
          if (isActive) setRequests([]);
        } finally {
          if (isActive) setLoading(false);
        }
      };
      fetchBookings();
      return () => { isActive = false; };
    }, [activeTripId, t])
  );

  const trip = trips.find(t => t.id === activeTripId) || null;
  const totalPending = requests.filter(r => r.status === 'pending').length;
  const visibleRequests = requests.filter(r => r.tripId === activeTripId && r.status === activeTab);

  const accept = async (id: string) => {
    try {
      await bookingService.confirmBooking(id);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setRequests(prev => prev.map(r => (r.id === id ? { ...r, status: 'confirmed' } : r)));
    } catch (error) {
      Alert.alert(t('manageRequests.couldNotAcceptRequest'), errorHandler.process(error).message);
    }
  };

  const reject = async (id: string) => {
    try {
      await bookingService.rejectBooking(id);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setRequests(prev => prev.map(r => (r.id === id ? { ...r, status: 'rejected' } : r)));
    } catch (error) {
      Alert.alert(t('manageRequests.couldNotDeclineRequest'), errorHandler.process(error).message);
    }
  };

  const tabCounts: Record<string, number> = {
    pending: requests.filter(r => r.tripId === activeTripId && r.status === 'pending').length,
    rejected: requests.filter(r => r.tripId === activeTripId && r.status === 'rejected').length,
    confirmed: requests.filter(r => r.tripId === activeTripId && r.status === 'confirmed').length,
    cancelled: requests.filter(r => r.tripId === activeTripId && r.status === 'cancelled').length,
    completed: requests.filter(r => r.tripId === activeTripId && r.status === 'completed').length,
  };

  const TABS: { key: Status; label: string; color: string; bg: string }[] = [
    { key: 'pending', label: t('manageRequests.status.pending'), color: '#92400E', bg: '#FEF3C7' },
    { key: 'confirmed', label: t('manageRequests.status.accepted'), color: '#047857', bg: '#D1FAE5' },
    { key: 'rejected', label: t('manageRequests.status.rejected'), color: '#BE123C', bg: '#FFF1F2' },
  ];

  /* ═══════════════════════════════════════════════════════════ */
  return (
    <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      {/* ── Header ─────────────────────────────────────────── */}
      <ScreenHeader
        title={t('manageRequests.rideRequests')}
        noBack
        right={totalPending > 0 ? (
          <View style={[styles.pendingBadge, themed.pendingBadge]}>
            <Text style={[{ fontSize: 13, fontWeight: '700' }, tc.color_accent]}>
              {totalPending} pending
            </Text>
          </View>
        ) : null}
      />
      <View style={[styles.header, tc.backgroundColor_surface, tc.borderBottomColor_border]}>

        {/* Trip selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
        >
          {trips.map(t => {
            const isActive = t.id === activeTripId;
            return (
              <Pressable accessibilityRole="button" key={t.id} onPress={() => setActiveTripId(t.id)}>
                <View
                  style={[
                    styles.tripChip,
                    isActive ? tc.borderColor_primary : tc.borderColor_border,
                    isActive ? tc.backgroundColor_primaryLight : tc.backgroundColor_surface
                  ]}
                >
                  <Text style={[{ fontSize: 12, fontWeight: '600' }, isActive ? tc.color_primary : tc.color_textSec]}>
                    {t.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={tk.primary} />
        </View>
      ) : !trip ? (
        <EmptyState icon="automobile" title={t('manageRequests.noTripsTitle')} body={t('manageRequests.noTripsBody')} />
      ) : (
        <FlatList
          data={visibleRequests}
        keyExtractor={(item) => item.id}
        style={styles.flex1}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Trip summary card */}
            <View style={[
              styles.summaryCard,
              tc.backgroundColor_surfaceVariant,
              tc.borderColor_surfaceVariant
            ]}>
              <View style={styles.summaryTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[{ fontSize: 16, fontWeight: '700' }, tc.color_text]}>
                    {t('manageRequests.route', { from: trip.from, to: trip.to })}
                  </Text>
                  <Text style={[{ fontSize: 12, marginTop: 3 }, tc.color_textSec]}>
                    {trip.date} · {trip.totalSeats} seats total
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[{ fontSize: 20, fontWeight: '800' }, tc.color_success]}>
                    {money(trip.earnings)}
                  </Text>
                  <Text style={[{ fontSize: 11 }, tc.color_textSec]}>{t('manageRequests.fromBookedSeats')}</Text>
                </View>
              </View>

              {/* Seat blocks */}
              <View style={styles.seatBlocks}>
                {Array.from({ length: trip.totalSeats }).map((_, i) => {
                  const filled = i < trip.filledSeats;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.seatBlock,
                        filled
                          ? tc.backgroundColor_primary
                          : [{ borderWidth: 1.5, borderStyle: 'dashed' }, tc.backgroundColor_surface, tc.borderColor_border],
                      ]}
                    >
                      {filled ? (
                        <Svg width={18} height={18} viewBox="0 0 24 24">
                          <Path
                            d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                            fill="white"
                          />
                        </Svg>
                      ) : (
                        <Text style={[{ fontSize: 11, fontWeight: '500' }, tc.color_textSec]}>{t('manageRequests.free')}</Text>
                      )}
                    </View>
                  );
                })}
                <Text style={[{ fontSize: 12, fontWeight: '600', marginLeft: 4 }, tc.color_primary]}>
                  {trip.filledSeats}/{trip.totalSeats} filled
                </Text>
              </View>
            </View>

            {/* Status tabs */}
            <View style={[styles.tabRow, { marginTop: 4 }]}>
              {TABS.map(tab => {
                const isActive2 = activeTab === tab.key;
                return (
                  <Pressable accessibilityRole="button" key={tab.key} onPress={() => setActiveTab(tab.key)} style={{ flex: 1 }}>
                    <View
                      style={[styles.tabBtn, isActive2 ? {
                        backgroundColor: tab.bg
                      } : tc.backgroundColor_surface, isActive2 ? {
                        borderColor: tab.color + '60'
                      } : tc.borderColor_border]}
                    >
                      <Text style={[{ fontSize: 13, fontWeight: '700' }, isActive2 ? {
                        color: tab.color
                      } : tc.color_textSec]}>
                        {tab.label}
                      </Text>
                      {tabCounts[tab.key] > 0 && (
                        <View style={[styles.tabCount, isActive2 ? {
                          backgroundColor: tab.color
                        } : tc.backgroundColor_border]}>
                          <Text style={[{ fontSize: 10, fontWeight: '800' }, isActive2 ? {
                            color: 'white'
                          } : tc.color_textSec]}>
                            {tabCounts[tab.key]}
                          </Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Section label */}
            {visibleRequests.length > 0 && (
              <Text style={[type.bodyMedium, { fontWeight: '700', marginTop: 4, marginBottom: -2 }, tc.color_text]}>
                {visibleRequests.length}{' '}
                {activeTab === 'pending' ? 'pending' : activeTab === 'confirmed' ? 'accepted' : 'declined'}{' '}
                {visibleRequests.length !== 1 ? 'requests' : 'request'}
              </Text>
            )}
          </>
        }
        ListEmptyComponent={
          activeTab === 'pending' || activeTab === 'confirmed' || activeTab === 'rejected' ? (
            <EmptyState
              icon={activeTab === 'confirmed' ? 'handshake' : 'bustsInSilhouette'}
              title={t(`manageRequests.empty.${activeTab}Title`)}
              body={t(`manageRequests.empty.${activeTab}Sub`)}
            />
          ) : null
        }
        renderItem={({ item: req }) => (
          <View
            key={req.id}
            style={[
              styles.reqCard,
              tc.backgroundColor_surfaceVariant,
              req.status === 'confirmed' ? themed.confirmedEdge : req.status === 'rejected' ? themed.rejectedEdge : tc.borderColor_border,
            ]}
          >
            {/* Top banner */}
            {req.status === 'pending' ? (
              <View style={[styles.bannerRow, tc.backgroundColor_warningLight]}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#92400E' }}>{t('manageRequests.waitingForYourAnswer')}</Text>
                {req.aiScore !== null && (
                  <View
                    style={[styles.aiBadge, req.aiScore >= 75 ? tc.backgroundColor_successLight : tc.backgroundColor_primaryLight]}
                    accessibilityLabel={t('manageRequests.matchScore', { score: req.aiScore })}
                  >
                    <Text style={[{ fontSize: 13, fontWeight: '800', lineHeight: 15 }, req.aiScore >= 75 ? tc.color_successDark : tc.color_primary]}>
                      {req.aiScore}
                    </Text>
                    <Text style={[{ fontSize: 9, fontWeight: '700' }, req.aiScore >= 75 ? tc.color_successDark : tc.color_primary]}>{t('manageRequests.match')}</Text>
                  </View>
                )}
              </View>
            ) : (
              <View
                style={[
                  styles.bannerRow,
                  req.status === 'confirmed' ? tc.backgroundColor_successLight : tc.backgroundColor_errorLight,
                ]}
              >
                <View style={styles.row}>
                  <Svg width={14} height={14} viewBox="0 0 24 24">
                    <Path
                      d={
                        req.status === 'confirmed'
                          ? 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'
                          : 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'
                      }
                      fill={req.status === 'confirmed' ? tk.success : tk.error}
                    />
                  </Svg>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: req.status === 'confirmed' ? '#065F46' : '#9F1239',
                    }}
                  >
                    {req.status === 'confirmed' ? t('manageRequests.requestAccepted') : t('manageRequests.requestDeclined')}
                  </Text>
                </View>
                <StatusChip status={req.status} />
              </View>
            )}

            {/* Card body */}
            <View style={styles.cardBody}>
              {/* Rider row */}
              <View style={styles.riderRow}>
                {req.avatar ? (
                  <ImageWithFallback src={req.avatar} alt={req.rider} width={54} height={54} borderRadius={14} />
                ) : (
                  <View style={[styles.avatarFallback, tc.backgroundColor_primaryLight]}>
                    <Text style={[{ fontSize: 20, fontWeight: '700' }, tc.color_primary]}>{req.rider.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[type.titleSmall, { fontWeight: '800' }, tc.color_text]}>{req.rider}</Text>
                  {req.colleagueAt ? (
                    <Text style={[{ fontSize: 13, fontWeight: '600' }, tc.color_primary]}>{t('manageRequests.worksAt', { company: req.colleagueAt })}</Text>
                  ) : null}
                  <View style={[styles.row, { flexWrap: 'wrap', marginTop: 4 }]}>
                    <Text style={[{ fontSize: 13, fontWeight: '600' }, tc.color_text]}>
                      {req.rating !== null ? t('manageRequests.rated', { rating: req.rating.toFixed(1), count: req.ratingCount }) : t('manageRequests.noRatings')}
                    </Text>
                    <Text style={[type.bodySmall, { marginLeft: 8 }, tc.color_textSec]}>
                      {req.trips === 1 ? t('manageRequests.tripOne') : t('manageRequests.tripMany', { count: req.trips })}
                    </Text>
                    <View style={[styles.seatLabel, tc.backgroundColor_primaryLight]}>
                      <Text style={[{ fontSize: 11, fontWeight: '600' }, tc.color_primary]}>
                        {req.seats > 1 ? t('manageRequests.seatMany', { count: req.seats }) : t('manageRequests.seatOne')}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[type.titleLarge, { fontWeight: '800' }, tc.color_primary]}>{money(req.price)}</Text>
                  <Text style={[type.labelSmall, tc.color_textSec]}>{t('manageRequests.total')}</Text>
                </View>
              </View>

              {/* Passenger details */}
              <View style={[styles.passTable, tc.borderColor_border]}>
                <View
                  style={[
                    styles.passHeader,
                    tc.backgroundColor_primaryLight,
                    tc.borderBottomColor_border
                  ]}
                >
                  <Svg width={13} height={13} viewBox="0 0 24 24">
                    <Path
                      d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
                      fill={tk.primary}
                    />
                  </Svg>
                  <Text style={[{ fontSize: 12, fontWeight: '700' }, tc.color_primary]}>
                    {t('manageRequests.passengerDetails')}
                  </Text>
                  <Text style={[{ fontSize: 11, marginLeft: 'auto' }, tc.color_textSec]}>
                    {req.passengers.length > 1 ? t('manageRequests.passengerMany', { count: req.passengers.length }) : t('manageRequests.passengerOne')}
                  </Text>
                </View>
                {req.passengers.map((pax, i) => (
                  <View
                    key={i}
                    style={[
                      styles.passRow,
                      { borderTopWidth: i > 0 ? 1 : 0 },
                      i % 2 === 0 ? tc.backgroundColor_surface : tc.backgroundColor_surfaceVariant,
                      tc.borderTopColor_border
                    ]}
                  >
                    <View style={[styles.paxNum, tc.backgroundColor_primary]}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: 'white' }}>
                        {i + 1}
                      </Text>
                    </View>
                    <Icon name={pax.gender === 'female' ? 'human-female' : pax.gender === 'male' ? 'human-male' : 'account'} size={20} color={tk.textSec} />
                    <View style={{ flex: 1 }}>
                      <Text style={[{ fontSize: 14, fontWeight: '700' }, tc.color_text]}>
                        {pax.name}
                      </Text>
                      <Text style={[{ fontSize: 11 }, tc.color_textSec]}>
                        {pax.gender ? t(`manageRequests.gender.${pax.gender === 'male' || pax.gender === 'female' ? pax.gender : 'other'}`) : t('manageRequests.gender.notSpecified')}
                      </Text>
                    </View>
                    {pax.gender ? <GenderBadge gender={pax.gender as Gender} /> : null}
                  </View>
                ))}
              </View>

              {/* Route */}
              <View style={[styles.routeRow, tc.backgroundColor_surface]}>
                <View style={{ alignItems: 'center' }}>
                  <View style={[styles.routeDot, { borderRadius: 4 }, tc.backgroundColor_primary]} />
                  <View style={[styles.routeLine, tc.backgroundColor_border]} />
                  <View style={[styles.routeDot, { borderRadius: 2 }, tc.backgroundColor_error]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[type.bodySmall, { fontWeight: '700' }, tc.color_text]}>{req.from}</Text>
                  <Text style={[type.bodySmall, { marginTop: 6 }, tc.color_textSec]}>{req.to}</Text>
                </View>
                <Text style={[type.labelSmall, tc.color_textSec]}>{req.date}</Text>
              </View>

              {req.bus ? (
                <View style={[styles.routeRow, tc.backgroundColor_surface]}>
                  <Text style={[type.bodySmall, { fontWeight: '700', flex: 1 }, tc.color_text]}>
                    {req.bus.hub ? t('manageRequests.busFrom', { time: req.bus.time, hub: req.bus.hub }) : t('manageRequests.bus', { time: req.bus.time })}
                  </Text>
                </View>
              ) : null}

              {/* Stops the rider asked for on the way */}
              {req.stops.length ? (
                <View style={[styles.routeRow, tc.backgroundColor_surface, { flexDirection: 'column', alignItems: 'flex-start', gap: 2 }]}>
                  <Text style={[type.bodySmall, { fontWeight: '700' }, tc.color_text]}>
                    {req.stops.length === 1 ? t('manageRequests.stopsOne') : t('manageRequests.stopsMany', { count: req.stops.length })}
                  </Text>
                  {req.stops.map((stop, i) => (
                    <Text key={`${stop}-${i}`} style={[type.bodySmall, tc.color_textSec]}>{`${i + 1}. ${stop}`}</Text>
                  ))}
                </View>
              ) : null}

              {/* Message from the rider */}
              {req.note ? (
                <View style={[styles.routeRow, tc.backgroundColor_surface]}>
                  <Text style={[type.bodySmall, { fontStyle: 'italic', flex: 1 }, tc.color_text]}>“{req.note}”</Text>
                </View>
              ) : null}

              {/* Action buttons */}
              {req.status === 'pending' && (
                <View style={[styles.actionRow, { marginTop: 4 }]}>
                  <Pressable onPress={() => reject(req.id)} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={t('manageRequests.declineFrom', { name: req.rider })}>
                    <View style={[styles.actionBtn, tc.backgroundColor_errorLight]}>
                      <Svg width={14} height={14} viewBox="0 0 24 24">
                        <Path
                          d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                          fill={tk.error}
                        />
                      </Svg>
                      <Text style={[{ fontSize: 14, fontWeight: '600' }, tc.color_error]}>{t('manageRequests.decline')}</Text>
                    </View>
                  </Pressable>

                  <Pressable onPress={() => accept(req.id)} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={t('manageRequests.acceptFrom', { name: req.rider })}>
                    <LinearGradient
                      colors={[tk.success, '#059669']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.acceptBtn}
                    >
                      <Svg width={14} height={14} viewBox="0 0 24 24">
                        <Path
                          d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
                          fill="white"
                        />
                      </Svg>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: 'white' }}>{t('manageRequests.accept')}</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              )}

              {req.status === 'confirmed' && (
                <View style={[styles.statusBanner, tc.backgroundColor_successLight]}>
                  <Svg width={16} height={16} viewBox="0 0 24 24">
                    <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill={tk.success} />
                  </Svg>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#065F46' }}>
                    {t('manageRequests.youAcceptedThisRequestRider')}
                  </Text>
                </View>
              )}

              {req.status === 'rejected' && (
                <View style={[styles.statusBanner, tc.backgroundColor_errorLight]}>
                  <Svg width={16} height={16} viewBox="0 0 24 24">
                    <Path
                      d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                      fill={tk.error}
                    />
                  </Svg>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#9F1239' }}>
                    {t('manageRequests.youDeclinedThisRequest')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      />
      )}

    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
// Theme colours made see-through (hex alpha), repainted with the theme
const themed = UStyleSheet.create(theme => ({
  pendingBadge: { backgroundColor: theme.colors.accent + '20', borderColor: theme.colors.accent + '50' },
  confirmedEdge: { borderColor: theme.colors.success + '50' },
  rejectedEdge: { borderColor: theme.colors.error + '40' },
}));

// The Material 3 type sizes this screen had from react-native-paper's Text,
// kept on the app's own Text (which Unistyles repaints with the theme)
const type = StyleSheet.create({
  titleLarge: { fontSize: 22, lineHeight: 28 },
  titleSmall: { fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0.1 },
  bodyMedium: { fontSize: 14, lineHeight: 20, letterSpacing: 0.25 },
  bodySmall: { fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
  labelSmall: { fontSize: 11, lineHeight: 16, fontWeight: '500', letterSpacing: 0.5 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  /* Header */
  header: { borderBottomWidth: 1, paddingHorizontal: 20 },
  title: { fontSize: 22, fontWeight: '800', flex: 1 },
  pendingBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  tripChip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1.5 },

  /* Body */
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100, gap: 16 },

  /* Summary */
  summaryCard: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 4, ...Shadow.sm },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  seatBlocks: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  seatBlock: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Tabs */
  tabRow: { flexDirection: 'row', gap: 10 },
  tabBtn: {
    height: 42,
    borderRadius: 8,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  tabCount: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },

  /* Empty */
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 },

  /* Request card */
  reqCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  aiBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { padding: 16, gap: 14 },

  /* Rider row */
  riderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarFallback: { width: 54, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  verifiedDot: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seatLabel: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 8, marginLeft: 8 },

  /* Passenger table */
  passTable: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  passHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  passRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  paxNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  /* Route */
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 14 },
  routeDot: { width: 10, height: 10 },
  routeLine: { width: 1.5, height: 22, marginVertical: 3 },

  /* Message */
  msgBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },

  /* Actions */
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { height: 46, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  chatBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    height: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  /* Status banners */
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12 },

  /* Gender badge */
  genderBadge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 },

  /* Status chip */
  statusChip: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 8 },
});
