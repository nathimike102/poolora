import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { bookingService } from '../../services/bookingService';
import { chatService } from '../../services/chatService';
import type { Booking } from '../../types/api';
import { ActivityIndicator } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImageWithFallback } from '../../components/ImageWithFallback';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Conversations will be derived from active/recent bookings

interface Conversation {
  id: string;
  name: string;
  avatar?: string;
  time: string;
  ride: string;
  status: Booking['status'];
}

export function ChatListScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const { c, role } = useApp();
  const insets = useSafeAreaInsets();
  
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [totalUnread, setTotalUnread] = React.useState(0);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      const fetchChats = async () => {
        try {
          setLoading(true);
          const [bookingsRes, unreadRes] = await Promise.all([
            role === 'driver' ? bookingService.getDriverBookings() : bookingService.getRiderBookings(),
            chatService.getUnreadCount().catch(() => 0)
          ]);
          
          if (isActive) {
            setTotalUnread(unreadRes);
            
            if (bookingsRes.data?.items) {
              // Chat opens once a booking is confirmed
              const chatBookings = bookingsRes.data.items.filter((b: Booking) => b.status === 'confirmed' || b.status === 'completed');

              const mapped: Conversation[] = chatBookings.map((b: Booking) => {
                const otherParty = role === 'driver' ? b.rider : b.driver;
                return {
                  id: b._id,
                  name: otherParty?.name || (role === 'driver' ? 'Rider' : 'Driver'),
                  avatar: otherParty?.profilePhotoUrl,
                  time: new Date(b.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short' }),
                  ride: `${b.pickup?.address || 'Pickup'} to ${b.dropoff?.address || 'drop'}`,
                  status: b.status,
                };
              });
              setConversations(mapped);
            }
          }
        } catch {
          if (isActive) setConversations([]);
        } finally {
          if (isActive) setLoading(false);
        }
      };
      
      fetchChats();
      return () => { isActive = false; };
    }, [role])
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(cv => cv.name.toLowerCase().includes(q) || cv.ride.toLowerCase().includes(q));
  }, [conversations, query]);

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────── */}
      <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <View style={s.headerTop}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>Messages</Text>
          {totalUnread > 0 && (
            <View style={[s.newBadge, { backgroundColor: c.errorLight }]}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: c.error }}>{totalUnread} new</Text>
            </View>
          )}
        </View>

        {/* Search */}
        <View style={[s.searchBar, { backgroundColor: c.bg, borderColor: c.border }]}>
          <Svg width={16} height={16} viewBox="0 0 24 24">
            <Path
              d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
              fill={c.textSec}
            />
          </Svg>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or place"
            placeholderTextColor={c.textSec}
            accessibilityLabel="Search conversations"
            style={[s.searchInput, { color: c.text }]}
          />
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
        ListHeaderComponent={
          <View style={[s.notice, { backgroundColor: c.warningLight }]}>
            <Svg width={14} height={14} viewBox="0 0 24 24" style={{ marginTop: 2 }}>
              <Path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
                fill={c.warning}
              />
            </Svg>
            <Text style={{ fontSize: 12, color: '#7A5200', flex: 1 }}>
              Chats open once a booking is confirmed. Messages are deleted <Text style={{ fontWeight: '700' }}>90 days</Text> after they are sent.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={{ fontSize: 14, color: c.textSec, textAlign: 'center', paddingTop: 24, paddingHorizontal: 24 }}>
            {query ? 'No conversations match your search.' : 'You have no chats yet. They appear here when a booking is confirmed.'}
          </Text>
        }
        renderItem={({ item: convo }) => (
          <Pressable
            onPress={() => navigation.navigate('Chat', { chatId: convo.id, recipientName: convo.name })}
            accessibilityRole="button"
            accessibilityLabel={`Chat with ${convo.name}, ${convo.ride}`}
            style={[s.convoRow, { borderBottomColor: c.border }]}
          >
            {convo.avatar ? (
              <ImageWithFallback src={convo.avatar} alt={convo.name} width={52} height={52} borderRadius={16} />
            ) : (
              <View style={[s.avatarFallback, { backgroundColor: c.primaryLight }]}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: c.primary }}>{convo.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}

            {/* Content */}
            <View style={s.flex1}>
              <View style={s.nameRow}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{convo.name}</Text>
                <Text style={{ fontSize: 12, color: c.textSec }}>{convo.time}</Text>
              </View>
              <Text style={{ fontSize: 12, color: c.textSec, marginBottom: 3 }} numberOfLines={1}>
                {convo.ride}
              </Text>
              <Text style={{ fontSize: 13, color: c.textSec }}>
                {convo.status === 'completed' ? 'Ride completed' : 'Ride confirmed'}
              </Text>
            </View>
          </Pressable>
        )}
      />
      )}

    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  avatarFallback: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  root: { flex: 1 },
  flex1: { flex: 1 },

  /* Header */
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  newBadge: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 8 },

  /* Search */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    marginTop: 12,
  },
  searchInput: { flex: 1, fontSize: 14 },

  /* Notice */
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
  },

  /* Conversation row */
  convoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00C853',
    borderWidth: 2,
    borderColor: 'white',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
});
