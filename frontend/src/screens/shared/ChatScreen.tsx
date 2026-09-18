import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { chatService } from '../../services/chatService';
import type { Message } from '../../types/api';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/BackButton';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface ChatBubble {
  id: string;
  from: 'me' | 'them';
  text: string;
  time: string;
  isRead: boolean;
}

const QUICK_REPLIES = ['On my way!', 'Be there in 2 min', 'Running late', 'At pickup point', 'Thanks!'];

export function ChatScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const { c, user } = useApp();
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<RootStackParamList, 'Chat'>>();
  const chatId = route.params?.chatId;
  const recipientName = route.params?.recipientName || 'Chat';

  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [sendError, setSendError] = useState('');
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      const fetchMessages = async () => {
        if (!chatId) return;
        try {
          // Mark as read when opening
          await chatService.markBookingAsRead(chatId).catch(() => {});
          const res = await chatService.getMessages(chatId);
          if (isActive && res.data?.items) {
            // The API returns the page oldest first
            const msgs: ChatBubble[] = res.data.items.map((m: Message) => {
              const senderId = String((m.sender as unknown as { _id?: string })?._id ?? m.sender);
              return {
                id: m._id,
                from: senderId === user?.id ? 'me' : 'them',
                text: m.content,
                time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isRead: Boolean((m as unknown as { isRead?: boolean }).isRead),
              };
            });
            setMessages(msgs);
          }
        } catch {
          // Keep showing the last messages; the next poll retries
        }
      };

      fetchMessages();
      const interval = setInterval(fetchMessages, 5000);
      return () => {
        isActive = false;
        clearInterval(interval);
      };
    }, [chatId, user?.id])
  );

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || !chatId) return;
    const msgText = text.trim();
    setInput('');
    
    // Optimistic UI
    const tempId = `pending-${Date.now()}`;
    setSendError('');
    setMessages(prev => [
      ...prev,
      {
        id: tempId,
        from: 'me',
        text: msgText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isRead: false,
      },
    ]);

    try {
      await chatService.sendMessage(chatId, msgText);
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInput(msgText);
      setSendError('Message not sent. Check your connection and try again.');
    }
  };

  return (
   <KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
>
      {/* ── Header ──────────────────────────────────────────── */}
      <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />

        <View style={[s.avatar, { backgroundColor: c.primaryLight }]}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.primary }}>{recipientName.charAt(0).toUpperCase()}</Text>
        </View>

        <View style={s.flex1}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }} accessibilityRole="header">{recipientName}</Text>
          <Text style={{ fontSize: 12, color: c.textSec }}>Chat for this booking</Text>
        </View>

        {/* SOS */}
        <Pressable
          onPress={() => navigation.navigate('SOS')}
          style={[s.headerBtn, { backgroundColor: c.errorLight }]}
          accessibilityRole="button"
          accessibilityLabel="SOS emergency"
        >
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
              fill={c.error}
            />
          </Svg>
        </Pressable>
      </View>

      {/* ── Messages ────────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        style={s.flex1}
        contentContainerStyle={[s.msgList, { paddingBottom: 90 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {messages.length === 0 && (
          <Text style={{ fontSize: 14, color: c.textSec, textAlign: 'center', marginTop: 24 }}>
            No messages yet. Messages are kept for 90 days.
          </Text>
        )}

        {messages.map(msg => {
          const isMe = msg.from === 'me';
          return (
            <View
              key={msg.id}
              style={[s.msgRow, { justifyContent: isMe ? 'flex-end' : 'flex-start' }]}
            >
              <View style={{ maxWidth: '75%' }}>
                <View
                  style={[
                    s.bubble,
                    isMe
                      ? { backgroundColor: c.primary, borderBottomRightRadius: 4 }
                      : { backgroundColor: c.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: c.border },
                  ]}
                >
                  <Text style={{ fontSize: 14, lineHeight: 20, color: isMe ? 'white' : c.text }}>
                    {msg.text}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 11,
                    color: c.textSec,
                    marginTop: 3,
                    textAlign: isMe ? 'right' : 'left',
                  }}
                >
                  {msg.time}
                  {isMe && (msg.id.startsWith('pending-') ? ' · Sending' : msg.isRead ? ' · Read' : ' · Sent')}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {sendError ? (
        <Text style={{ fontSize: 13, color: c.error, textAlign: 'center', paddingHorizontal: 16 }} accessibilityLiveRegion="polite">
          {sendError}
        </Text>
      ) : null}

      {/* ── Quick replies ───────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.quickRepliesScroll}
        contentContainerStyle={s.quickRow}
      >
        {QUICK_REPLIES.map(qr => (
          <Pressable
            key={qr}
            onPress={() => send(qr)}
            style={[s.quickChip, { backgroundColor: c.surface, borderColor: c.border }]}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={`Send: ${qr}`}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>{qr}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Input bar ───────────────────────────────────────── */}
      <View style={[s.inputBar, { backgroundColor: c.surface,
      borderTopColor: c.border,
      paddingBottom: insets.bottom + 6 }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type a message"
          placeholderTextColor={c.textSec}
          accessibilityLabel="Message"
          maxLength={2000}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
          style={[s.textInput, { backgroundColor: c.bg, borderColor: c.border, color: c.text }]}
        />

        {/* Send */}
        <Pressable
          onPress={() => send(input)}
          disabled={!input.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          style={[s.inputBtn, { backgroundColor: input.trim() ? c.primary : c.border }]}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="white" />
          </Svg>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  avatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00C853',
    borderWidth: 2,
    borderColor: 'white',
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Notice */
  notice: { paddingVertical: 8, paddingHorizontal: 16, borderBottomWidth: 1 },

  /* Messages */
  msgList: { padding: 16, gap: 12 },
  dateDivider: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  dividerLine: { flex: 1, height: 1 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end' },
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
  },

  /* Quick replies */
  quickRepliesScroll: { maxHeight: 48 },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
    gap: 10,
  },
  quickChip: {
    minHeight: 30,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Input bar */
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  inputBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
});
