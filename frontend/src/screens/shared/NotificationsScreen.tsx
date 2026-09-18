import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useApp } from '../../context/AppContext';
import { Icon, type IconName } from '../../components/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/BackButton';
import type { RootStackParamList } from '../../navigation/types';
import { notificationService } from '../../services/notificationService';
import type { Notification } from '../../types/api';
import { logger } from '../../utils/logger';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TYPE_COLORS: Record<string, string> = {
  success: '#E8F5E9',
  info: '#E8F0FE',
  star: '#FFF8E1',
  promo: '#FFF3EE',
  reminder: '#FFF4E5',
  error: '#FFEBEE',
};

export function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const unreadCount = useMemo(() => items.filter((n) => !n.isRead).length, [items]);

  const iconFor = useCallback((type: string) => {
    const map: Record<string, IconName> = {
      ride_request: 'car',
      ride_confirmed: 'check-circle-outline',
      ride_cancelled: 'close-circle-outline',
      ride_started: 'car-arrow-right',
      ride_completed: 'flag-checkered',
      new_message: 'message-text-outline',
      rating_received: 'star-outline',
      payment_received: 'cash',
      system: 'bell-outline',
    };
    return map[type] ?? 'bell-outline';
  }, []);

  const colorTypeFor = useCallback((type: string) => {
    if (type === 'ride_confirmed' || type === 'payment_received') return 'success';
    if (type === 'ride_cancelled') return 'error';
    if (type === 'rating_received') return 'star';
    if (type === 'system') return 'reminder';
    return 'info';
  }, []);

  const relativeTime = useCallback((iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }, []);

  const loadNotifications = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const result = await notificationService.getNotifications(1, 50);
      setItems(result.data.items ?? []);
    } catch (error) {
      logger.error('Failed to load notifications', { error });
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onMarkAllRead = useCallback(async () => {
    await notificationService.markAllAsRead();
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  const onMarkRead = useCallback(async (id: string) => {
    await notificationService.markAsRead(id);
    setItems((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
  }, []);

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────── */}
      <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[s.headerTitle, { color: c.text }]}>Notifications</Text>
        <Pressable accessibilityRole="button" onPress={onMarkAllRead} disabled={unreadCount === 0}>
          <Text style={{ fontSize: 13, color: unreadCount ? c.primary : c.textSec, fontWeight: '600' }}>
            Mark all read
          </Text>
        </Pressable>
      </View>

      {/* ── List ────────────────────────────────────────────── */}
      {loading ? (
        <View style={[s.flex1, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
      <ScrollView
        style={s.flex1}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadNotifications(true)} />}
      >
        {items.map(notif => {
          const typeKey = colorTypeFor(notif.type);
          const bg = TYPE_COLORS[typeKey] ?? TYPE_COLORS.info;
          return (
            <Pressable accessibilityRole="button"
              key={notif._id}
              onPress={() => !notif.isRead && onMarkRead(notif._id)}
              style={[
                s.notifRow,
                {
                  backgroundColor: notif.isRead ? 'transparent' : bg + '50',
                  borderBottomColor: c.border,
                },
              ]}
            >
              {/* Icon */}
              <View style={[s.iconBox, { backgroundColor: bg }]}>
                <Icon name={iconFor(notif.type)} size={22} color={c.text} />
              </View>

              {/* Content */}
              <View style={s.flex1}>
                <View style={s.titleRow}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: notif.isRead ? '600' : '700',
                      color: c.text,
                      flex: 1,
                    }}
                  >
                    {notif.title ?? 'Notification'}
                  </Text>
                  <Text style={{ fontSize: 11, color: c.textSec, flexShrink: 0 }}>
                    {relativeTime(notif.createdAt)}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: c.textSec, marginTop: 3, lineHeight: 18 }}>
                  {notif.body}
                </Text>
              </View>

              {/* Unread dot */}
              {!notif.isRead && <View style={[s.unreadDot, { backgroundColor: c.primary }]} />}
            </Pressable>
          );
        })}
      </ScrollView>
      )}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700' },

  /* Notification row */
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
    marginTop: 6,
  },
});
