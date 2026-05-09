import React, { useCallback } from 'react';
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

export function ChatListScreen() {
  const navigation = useNavigation<Nav>();
  const { c, role } = useApp();
  const insets = useSafeAreaInsets();
  
  const [conversations, setConversations] = React.useState<any[]>([]);
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
              const activeBookings = bookingsRes.data.items.filter((b: Booking) => b.status === 'pending' || b.status === 'confirmed' || b.status === 'completed');
              
              const mapped = activeBookings.map((b: Booking) => {
                const otherPartyName = role === 'driver' ? b.rider?.name : b.ride?.driver?.name;
                const otherPartyAvatar = role === 'driver' ? b.rider?.profilePhotoUrl : b.ride?.driver?.profilePhotoUrl;
                return {
                  id: b._id,
                  name: otherPartyName || (role === 'driver' ? 'Rider' : 'Driver'),
                  avatar: otherPartyAvatar || 'https://images.unsplash.com/photo-1747373354146-646351cc7e88?w=60&h=60&fit=crop',
                  lastMessage: 'Tap to view messages',
                  time: new Date(b.createdAt).toLocaleDateString(),
                  unread: 0,
                  ride: `${b.pickupLocation?.address || 'Pickup'} → ${b.dropoffLocation?.address || 'Dropoff'}`,
                  online: false
                };
              });
              setConversations(mapped);
            }
          }
        } catch (error) {
          console.error(error);
        } finally {
          if (isActive) setLoading(false);
        }
      };
      
      fetchChats();
      return () => { isActive = false; };
    }, [role])
  );

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
            placeholder="Search messages..."
            placeholderTextColor={c.textSec}
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
          data={conversations}
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
              Chats are linked to your ride and expire <Text style={{ fontWeight: '700' }}>30 days</Text> after ride completion.
            </Text>
          </View>
        }
        ListFooterComponent={
          <Text style={{ fontSize: 13, color: c.textSec, textAlign: 'center', paddingTop: 20 }}>
            All your ride-linked chats appear here
          </Text>
        }
        renderItem={({ item: convo }) => (
          <Pressable
            onPress={() => navigation.navigate('Chat', { chatId: convo.id, recipientName: convo.name })}
            style={[
              s.convoRow,
              {
                backgroundColor: convo.unread > 0 ? c.primary + '06' : 'transparent',
                borderBottomColor: c.border,
              },
            ]}
          >
            {/* Avatar */}
            <View>
              <ImageWithFallback
                src={convo.avatar}
                alt={convo.name}
                width={52}
                height={52}
                borderRadius={16}
              />
              {convo.online && <View style={s.onlineDot} />}
            </View>

            {/* Content */}
            <View style={s.flex1}>
              <View style={s.nameRow}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{convo.name}</Text>
                <Text style={{ fontSize: 12, color: c.textSec }}>{convo.time}</Text>
              </View>
              <Text style={{ fontSize: 12, color: c.textSec, marginBottom: 3 }} numberOfLines={1}>
                🚗 {convo.ride}
              </Text>
              <View style={s.msgRow}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 13,
                    color: convo.unread > 0 ? c.text : c.textSec,
                    fontWeight: convo.unread > 0 ? '600' : '400',
                    flex: 1,
                  }}
                >
                  {convo.lastMessage}
                </Text>
                {convo.unread > 0 && (
                  <View style={[s.unreadBadge, { backgroundColor: c.primary }]}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: 'white' }}>{convo.unread}</Text>
                  </View>
                )}
              </View>
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
  root: { flex: 1 },
  flex1: { flex: 1 },

  /* Header */
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  newBadge: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20 },

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
