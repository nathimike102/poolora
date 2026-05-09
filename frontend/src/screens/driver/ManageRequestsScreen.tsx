import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  Pressable,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { bookingService } from '../../services/bookingService';
import type { Booking } from '../../types/api';
import { ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/BackButton';
import { ImageWithFallback } from '../../components/ImageWithFallback';
import type { RootStackParamList } from '../../navigation/types';
import { Shadow } from '../../theme';

type Gender = 'Male' | 'Female' | 'Other';
type Status = 'pending' | 'accepted' | 'rejected';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

// TRIPS and REQUESTS will be derived from state

/* ── Sub-components ────────────────────────────────────────── */

function GenderBadge({ gender }: { gender: Gender }) {
  const map: Record<Gender, { bg: string; border: string; text: string }> = {
    Female: { bg: '#FFF1F2', border: '#FCA5A5', text: '#E11D48' },
    Male:   { bg: '#EFF6FF', border: '#93C5FD', text: '#2563EB' },
    Other:  { bg: '#F5F3FF', border: '#C4B5FD', text: '#7C3AED' },
  };
  const s = map[gender];
  return (
    <View style={[styles.genderBadge, { backgroundColor: s.bg, borderColor: s.border }]}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: s.text }}>{gender}</Text>
    </View>
  );
}

function StatusChip({ status }: { status: Status }) {
  const map: Record<Status, { label: string; bg: string; text: string }> = {
    pending:  { label: 'Pending',  bg: '#FEF3C7', text: '#D97706' },
    accepted: { label: 'Accepted', bg: '#D1FAE5', text: '#059669' },
    rejected: { label: 'Declined', bg: '#FFF1F2', text: '#E11D48' },
  };
  const m = map[status];
  return (
    <View style={[styles.statusChip, { backgroundColor: m.bg }]}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: m.text }}>{m.label}</Text>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export function ManageRequestsScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [requests, setRequests] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
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
            
            // Map bookings to requests
            const reqs = bookings.map(b => ({
              id: b._id,
              tripId: b.ride?._id || 'unknown',
              rider: b.rider?.name || 'Rider',
              avatar: b.rider?.profilePhotoUrl || 'https://images.unsplash.com/photo-1580746453801-37b0bc56f3b4?w=80&h=80&fit=crop&crop=face',
              rating: b.rider?.stats?.avgRatingAsRider || 4.5,
              trips: b.rider?.stats?.totalRidesAsRider || 0,
              from: b.pickupLocation?.address || 'Pickup',
              to: b.dropoffLocation?.address || 'Dropoff',
              date: new Date(b.ride?.scheduledDeparture || new Date()).toLocaleString(),
              seats: b.seatsBooked,
              price: b.totalPrice,
              aiScore: 90,
              expiresIn: '4h 20m',
              verified: b.rider?.isVerified || false,
              passengers: [{ name: b.rider?.name || 'Rider', gender: b.rider?.gender || 'Other' }],
              status: b.status,
            }));
            
            setRequests(reqs);

            // Group into TRIPS
            const tripMap = new Map();
            bookings.forEach(b => {
              if (!b.ride || tripMap.has(b.ride._id)) return;
              tripMap.set(b.ride._id, {
                id: b.ride._id,
                label: `${b.ride.pickupLocation?.address || 'Start'} → ${b.ride.dropoffLocation?.address || 'End'}`,
                from: b.ride.pickupLocation?.address,
                to: b.ride.dropoffLocation?.address,
                date: new Date(b.ride.scheduledDeparture).toLocaleDateString(),
                totalSeats: b.ride.seats,
                filledSeats: b.ride.seats - b.ride.availableSeats,
                earnings: b.ride.pricePerSeat * (b.ride.seats - b.ride.availableSeats),
              });
            });
            const fetchedTrips = Array.from(tripMap.values());
            setTrips(fetchedTrips);
            if (fetchedTrips.length > 0 && !activeTripId) {
              setActiveTripId(fetchedTrips[0].id);
            }
          }
        } catch (error) {
          console.error(error);
        } finally {
          if (isActive) setLoading(false);
        }
      };
      fetchBookings();
      return () => { isActive = false; };
    }, [activeTripId])
  );

  const trip = trips.find(t => t.id === activeTripId) || null;
  const totalPending = requests.filter(r => r.status === 'pending').length;
  const visibleRequests = requests.filter(r => r.tripId === activeTripId && r.status === activeTab);

  const accept = async (id: string) => {
    try {
      await bookingService.confirmBooking(id);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setRequests(prev => prev.map(r => (r.id === id ? { ...r, status: 'accepted' } : r)));
    } catch (e) { console.error(e); }
  };

  const reject = async (id: string) => {
    try {
      await bookingService.rejectBooking(id);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setRequests(prev => prev.map(r => (r.id === id ? { ...r, status: 'rejected' } : r)));
    } catch (e) { console.error(e); }
  };

  const tabCounts: Record<Status, number> = {
    pending: requests.filter(r => r.tripId === activeTripId && r.status === 'pending').length,
    accepted: requests.filter(r => r.tripId === activeTripId && r.status === 'accepted').length,
    rejected: requests.filter(r => r.tripId === activeTripId && r.status === 'rejected').length,
  };

  const TABS: { key: Status; label: string; color: string; bg: string }[] = [
    { key: 'pending', label: 'Pending', color: '#D97706', bg: '#FEF3C7' },
    { key: 'accepted', label: 'Accepted', color: '#059669', bg: '#D1FAE5' },
    { key: 'rejected', label: 'Rejected', color: '#E11D48', bg: '#FFF1F2' },
  ];

  /* ═══════════════════════════════════════════════════════════ */
  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* ── Header ─────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        {/* Title row */}
        <View style={styles.titleRow}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={[styles.title, { color: c.text }]}>Ride Requests</Text>
          {totalPending > 0 && (
            <View style={[styles.pendingBadge, { backgroundColor: c.accent + '20', borderColor: c.accent + '50' }]}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: c.accent }}>
                {totalPending} pending
              </Text>
            </View>
          )}
        </View>

        {/* Trip selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
        >
          {trips.map(t => {
            const isActive = t.id === activeTripId;
            return (
              <Pressable key={t.id} onPress={() => setActiveTripId(t.id)}>
                <View
                  style={[
                    styles.tripChip,
                    {
                      borderColor: isActive ? c.primary : c.border,
                      backgroundColor: isActive ? c.primaryLight : c.surface,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: isActive ? c.primary : c.textSec }}>
                    {t.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading || !trip ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={c.primary} />
          {!trip && !loading && (
            <Text style={{ marginTop: 10, color: c.textSec }}>No active trips found</Text>
          )}
        </View>
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
            <View style={[styles.summaryCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={styles.summaryTop}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>
                    {trip.from} → {trip.to}
                  </Text>
                  <Text style={{ fontSize: 12, color: c.textSec, marginTop: 3 }}>
                    {trip.date} · {trip.totalSeats} seats total
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: c.success }}>
                    ₹{trip.earnings}
                  </Text>
                  <Text style={{ fontSize: 11, color: c.textSec }}>if full</Text>
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
                          ? { backgroundColor: c.primary }
                          : { backgroundColor: c.bg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border },
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
                        <Text style={{ fontSize: 11, color: c.textSec, fontWeight: '500' }}>Free</Text>
                      )}
                    </View>
                  );
                })}
                <Text style={{ fontSize: 12, fontWeight: '600', color: c.primary, marginLeft: 4 }}>
                  {trip.filledSeats}/{trip.totalSeats} filled
                </Text>
              </View>
            </View>

            {/* Status tabs */}
            <View style={[styles.tabRow, { marginTop: 4 }]}>
              {TABS.map(tab => {
                const isActive2 = activeTab === tab.key;
                return (
                  <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={{ flex: 1 }}>
                    <View
                      style={[
                        styles.tabBtn,
                        {
                          backgroundColor: isActive2 ? tab.bg : c.surface,
                          borderColor: isActive2 ? tab.color + '60' : c.border,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: isActive2 ? tab.color : c.textSec }}>
                        {tab.label}
                      </Text>
                      {tabCounts[tab.key] > 0 && (
                        <View style={[styles.tabCount, { backgroundColor: isActive2 ? tab.color : c.border }]}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: isActive2 ? 'white' : c.textSec }}>
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
              <Text variant="bodyMedium" style={{ fontWeight: '700', color: c.text, marginTop: 4, marginBottom: -2 }}>
                {visibleRequests.length}{' '}
                {activeTab === 'pending' ? 'Pending' : activeTab === 'accepted' ? 'Accepted' : 'Declined'}{' '}
                Request{visibleRequests.length !== 1 ? 's' : ''}
              </Text>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 52 }}>
              {activeTab === 'pending' ? '⏳' : activeTab === 'accepted' ? '✅' : '❌'}
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>
              {activeTab === 'pending' && 'No pending requests'}
              {activeTab === 'accepted' && 'No accepted requests yet'}
              {activeTab === 'rejected' && 'No declined requests'}
            </Text>
            <Text style={{ fontSize: 13, color: c.textSec, textAlign: 'center', lineHeight: 19, paddingHorizontal: 20 }}>
              {activeTab === 'pending' && 'New ride requests from riders will appear here.'}
              {activeTab === 'accepted' && 'When you accept a request it will show up here.'}
              {activeTab === 'rejected' && 'Declined requests will be moved here.'}
            </Text>
          </View>
        }
        renderItem={({ item: req }) => (
          <View
            key={req.id}
            style={[
              styles.reqCard,
              {
                backgroundColor: c.surface,
                borderColor:
                  req.status === 'accepted'
                    ? c.success + '50'
                    : req.status === 'rejected'
                    ? c.error + '40'
                    : c.border,
              },
            ]}
          >
            {/* Top banner */}
            {req.status === 'pending' ? (
              <View style={[styles.bannerRow, { backgroundColor: c.warningLight }]}>
                <View style={styles.row}>
                  <Svg width={14} height={14} viewBox="0 0 24 24">
                    <Path
                      d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"
                      fill={c.warning}
                    />
                  </Svg>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#92400E' }}>
                    Expires in {req.expiresIn}
                  </Text>
                </View>
                {/* AI score badge */}
                <View
                  style={[
                    styles.aiBadge,
                    {
                      backgroundColor:
                        req.aiScore >= 90
                          ? c.successLight
                          : req.aiScore >= 75
                          ? c.primaryLight
                          : c.accent + '22',
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '800',
                      lineHeight: 15,
                      color:
                        req.aiScore >= 90
                          ? c.success
                          : req.aiScore >= 75
                          ? c.primary
                          : c.accent,
                    }}
                  >
                    {req.aiScore}
                  </Text>
                  <Text
                    style={{
                      fontSize: 8,
                      fontWeight: '700',
                      color:
                        req.aiScore >= 90
                          ? c.success
                          : req.aiScore >= 75
                          ? c.primary
                          : c.accent,
                    }}
                  >
                    AI
                  </Text>
                </View>
              </View>
            ) : (
              <View
                style={[
                  styles.bannerRow,
                  {
                    backgroundColor:
                      req.status === 'accepted' ? c.successLight : c.errorLight,
                  },
                ]}
              >
                <View style={styles.row}>
                  <Svg width={14} height={14} viewBox="0 0 24 24">
                    <Path
                      d={
                        req.status === 'accepted'
                          ? 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'
                          : 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'
                      }
                      fill={req.status === 'accepted' ? c.success : c.error}
                    />
                  </Svg>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: req.status === 'accepted' ? '#065F46' : '#9F1239',
                    }}
                  >
                    {req.status === 'accepted' ? 'Request Accepted' : 'Request Declined'}
                  </Text>
                </View>
                <StatusChip status={req.status} />
              </View>
            )}

            {/* Card body */}
            <View style={styles.cardBody}>
              {/* Rider row */}
              <View style={styles.riderRow}>
                <View style={{ position: 'relative' }}>
                  <ImageWithFallback
                    src={req.avatar}
                    alt={req.rider}
                    width={54}
                    height={54}
                    borderRadius={14}
                  />
                  {req.verified && (
                    <View style={[styles.verifiedDot, { backgroundColor: c.primary }]}>
                      <Svg width={9} height={9} viewBox="0 0 24 24">
                        <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="white" />
                      </Svg>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="titleSmall" style={{ fontWeight: '800', color: c.text }}>{req.rider}</Text>
                  <View style={[styles.row, { flexWrap: 'wrap', marginTop: 4 }]}>
                    <View style={styles.row}>
                      <Svg width={12} height={12} viewBox="0 0 24 24">
                        <Path
                          d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                          fill="#FFB300"
                        />
                      </Svg>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: c.text, marginLeft: 2 }}>
                        {req.rating}
                      </Text>
                    </View>
                    <Text variant="bodySmall" style={{ color: c.textSec, marginLeft: 8 }}>
                      {req.trips} trips
                    </Text>
                    <View style={[styles.seatLabel, { backgroundColor: c.primaryLight }]}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: c.primary }}>
                        {req.seats} seat{req.seats > 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="titleLarge" style={{ fontWeight: '800', color: c.primary }}>₹{req.price}</Text>
                  <Text variant="labelSmall" style={{ color: c.textSec }}>total</Text>
                </View>
              </View>

              {/* Passenger details */}
              <View style={[styles.passTable, { borderColor: c.border }]}>
                <View
                  style={[
                    styles.passHeader,
                    { backgroundColor: c.primaryLight, borderBottomColor: c.border },
                  ]}
                >
                  <Svg width={13} height={13} viewBox="0 0 24 24">
                    <Path
                      d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
                      fill={c.primary}
                    />
                  </Svg>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: c.primary }}>
                    Passenger Details
                  </Text>
                  <Text style={{ fontSize: 11, color: c.textSec, marginLeft: 'auto' }}>
                    {req.passengers.length} passenger{req.passengers.length > 1 ? 's' : ''}
                  </Text>
                </View>
                {req.passengers.map((pax: { gender: Gender, name: string }, i: number) => (
                  <View
                    key={i}
                    style={[
                      styles.passRow,
                      {
                        backgroundColor: i % 2 === 0 ? c.bg : c.surface,
                        borderTopWidth: i > 0 ? 1 : 0,
                        borderTopColor: c.border,
                      },
                    ]}
                  >
                    <View style={[styles.paxNum, { backgroundColor: c.primary }]}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: 'white' }}>
                        {i + 1}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 18 }}>
                      {pax.gender === 'Female' ? '👩' : pax.gender === 'Male' ? '👨' : '🧑'}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>
                        {pax.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: c.textSec }}>{pax.gender}</Text>
                    </View>
                    <GenderBadge gender={pax.gender} />
                  </View>
                ))}
              </View>

              {/* Route */}
              <View style={[styles.routeRow, { backgroundColor: c.bg }]}>
                <View style={{ alignItems: 'center' }}>
                  <View style={[styles.routeDot, { backgroundColor: c.primary, borderRadius: 4 }]} />
                  <View style={[styles.routeLine, { backgroundColor: c.border }]} />
                  <View style={[styles.routeDot, { backgroundColor: c.error, borderRadius: 2 }]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodySmall" style={{ fontWeight: '700', color: c.text }}>{req.from}</Text>
                  <Text variant="bodySmall" style={{ color: c.textSec, marginTop: 6 }}>{req.to}</Text>
                </View>
                <Text variant="labelSmall" style={{ color: c.textSec }}>{req.date}</Text>
              </View>

              {/* Message */}
          

              {/* Action buttons */}
              {req.status === 'pending' && (
                <View style={[styles.actionRow, { marginTop: 4 }]}>
                  <Pressable onPress={() => reject(req.id)} style={{ flex: 1 }}>
                    <View style={[styles.actionBtn, { backgroundColor: c.errorLight }]}>
                      <Svg width={14} height={14} viewBox="0 0 24 24">
                        <Path
                          d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                          fill={c.error}
                        />
                      </Svg>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: c.error }}>Decline</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => navigation.navigate('Chat', { chatId: req.id, recipientName: req.rider })}
                    style={[styles.chatBtn, { backgroundColor: c.bg, borderColor: c.border }]}
                  >
                    <Svg width={16} height={16} viewBox="0 0 24 24">
                      <Path
                        d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"
                        fill={c.textSec}
                      />
                    </Svg>
                  </Pressable>

                  <Pressable onPress={() => accept(req.id)} style={{ flex: 1 }}>
                    <LinearGradient
                      colors={[c.success, '#059669']}
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
                      <Text style={{ fontSize: 14, fontWeight: '700', color: 'white' }}>Accept</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              )}

              {req.status === 'accepted' && (
                <View style={[styles.statusBanner, { backgroundColor: c.successLight }]}>
                  <Svg width={16} height={16} viewBox="0 0 24 24">
                    <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill={c.success} />
                  </Svg>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#065F46' }}>
                    You accepted this request. Rider has been notified.
                  </Text>
                </View>
              )}

              {req.status === 'rejected' && (
                <View style={[styles.statusBanner, { backgroundColor: c.errorLight }]}>
                  <Svg width={16} height={16} viewBox="0 0 24 24">
                    <Path
                      d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                      fill={c.error}
                    />
                  </Svg>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#9F1239' }}>
                    You declined this request.
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
const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  /* Header */
  header: { borderBottomWidth: 1, paddingHorizontal: 20, paddingTop: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', flex: 1 },
  pendingBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  tripChip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1.5 },

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
    borderRadius: 22,
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
  seatLabel: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 20, marginLeft: 8 },

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
  genderBadge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1 },

  /* Status chip */
  statusChip: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20 },
});
