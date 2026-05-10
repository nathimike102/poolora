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
import { ImageWithFallback } from '../../components/ImageWithFallback';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const INITIAL_MESSAGES = [
  { id: '1', from: 'driver', text: "Hi! I'm on my way to the pickup point.", time: '8:55 AM' },
  { id: '2', from: 'me', text: "Great! I'll be waiting near the main gate.", time: '8:56 AM' },
  { id: '3', from: 'driver', text: "I'll be there in 5 minutes. Look for white Swift Dzire - KA05AB1234", time: '8:57 AM' },
  { id: '4', from: 'me', text: "Got it! I can see you on the map 👍", time: '8:58 AM' },
  { id: '5', from: 'driver', text: "I'll be at the pickup point in 5 minutes!", time: '9:02 AM' },
];

const QUICK_REPLIES = ['On my way!', 'Be there in 2 min', 'Running late', 'At pickup point', 'Thanks!'];

export function ChatScreen() {
  const navigation = useNavigation<Nav>();
  const { c, role, user } = useApp();
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<RootStackParamList, 'Chat'>>();
  const chatId = route.params?.chatId;
  const recipientName = route.params?.recipientName || 'Driver';

  const [messages, setMessages] = useState<any[]>([]);
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
            const msgs = res.data.items.map((m: Message) => ({
              id: m._id,
              from: m.sender._id === user?.id ? 'me' : 'them',
              text: m.content,
              time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }));
            // Sort ascending
            msgs.reverse();
            setMessages(msgs);
          }
        } catch (error) {
          console.error(error);
        }
      };
      
      fetchMessages();
      
      // Setup simple polling for demo purposes
      const interval = setInterval(fetchMessages, 5000);
      return () => {
        isActive = false;
        clearInterval(interval);
      };
    }, [chatId])
  );

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || !chatId) return;
    const msgText = text.trim();
    setInput('');
    
    // Optimistic UI
    const tempId = Date.now().toString();
    setMessages(prev => [
      ...prev,
      {
        id: tempId,
        from: 'me',
        text: msgText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    try {
      await chatService.sendMessage(chatId, msgText);
      // Wait for next poll to sync real ID or we could replace it here, but polling is running
    } catch (error) {
      console.error(error);
      // Rollback optimistic
      setMessages(prev => prev.filter(m => m.id !== tempId));
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

        {/* Avatar */}
        <View>
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1747373354146-646351cc7e88?w=60&h=60&fit=crop"
            alt="Driver"
            width={40}
            height={40}
            borderRadius={12}
          />
          <View style={s.onlineDot} />
        </View>

        <View style={s.flex1}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{recipientName}</Text>
          <Text style={{ fontSize: 12, color: c.textSec }}>Active Chat</Text>
        </View>

        {/* Call */}
        <Pressable style={[s.headerBtn, { backgroundColor: c.successLight }]}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
              fill={c.success}
            />
          </Svg>
        </Pressable>

        {/* SOS */}
        <Pressable
          onPress={() => navigation.navigate('SOS' as any)}
          style={[s.headerBtn, { backgroundColor: c.errorLight }]}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
              fill={c.error}
            />
          </Svg>
        </Pressable>
      </View>

      {/* Masked call notice */}
      <View style={[s.notice, { backgroundColor: c.primaryLight, borderBottomColor: c.border }]}>
        <Text style={{ fontSize: 11, color: c.primary, textAlign: 'center' }}>
          🔒 Your phone number is masked. Call is routed through Sanchari.
        </Text>
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
        {/* Date divider */}
        <View style={s.dateDivider}>
          <View style={[s.dividerLine, { backgroundColor: c.border }]} />
          <Text style={{ fontSize: 12, color: c.textSec, marginHorizontal: 12 }}>Today</Text>
          <View style={[s.dividerLine, { backgroundColor: c.border }]} />
        </View>

        {messages.map(msg => {
          const isMe = msg.from === 'me';
          return (
            <View
              key={msg.id}
              style={[s.msgRow, { justifyContent: isMe ? 'flex-end' : 'flex-start' }]}
            >
              {!isMe && (
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1747373354146-646351cc7e88?w=60&h=60&fit=crop"
                  alt="Driver"
                  width={30}
                  height={30}
                  borderRadius={10}
                  style={{ marginRight: 8 }}
                />
              )}
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
                  {isMe && ' ✓✓'}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

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
            android_ripple={{ color: 'rgba(255,255,255,0.08)', borderless: false }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>{qr}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Input bar ───────────────────────────────────────── */}
      <View style={[s.inputBar, { backgroundColor: c.surface,
      borderTopColor: c.border,
      paddingBottom: insets.bottom + 6 }]}>
        {/* Location */}
        <Pressable style={[s.inputBtn, { backgroundColor: c.primaryLight }]}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
              fill={c.primary}
            />
          </Svg>
        </Pressable>

        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor={c.textSec}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
          style={[s.textInput, { backgroundColor: c.bg, borderColor: c.border, color: c.text }]}
        />

        {/* Send */}
        <Pressable
          onPress={() => send(input)}
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
    borderRadius: 20,
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
