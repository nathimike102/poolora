/**
 * screens/trip/TripDetailScreen.tsx
 *
 * One group trip. Anyone who can see it gets the plan and can ask to join.
 * Members get three tabs: Plan (the day-by-day outline and activities the
 * group votes on, UC-T04), People (members, join requests, the invite code
 * and UPI ids) and Money (shared expenses and settling up, UC-T03, UC-T05).
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, Linking, Share } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { BackButton } from '../../components/BackButton';
import { Icon } from '../../components/Icon';
import { tripService, tripDates, tripDays, type Trip, type TripExpense, type Settlement, type TripVote } from '../../services/tripService';
import { errorHandler } from '../../utils/errorHandler';
import type { RootStackParamList } from '../../navigation/types';

type Tab = 'plan' | 'people' | 'money';
const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function TripDetailScreen() {
  const { tripId, code } = useRoute<RouteProp<RootStackParamList, 'TripDetail'>>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<Tab>('plan');
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [busy, setBusy] = useState(false);

  // Forms
  const [joinMessage, setJoinMessage] = useState('');
  const [activity, setActivity] = useState({ title: '', cost: '', notes: '' });
  const [expense, setExpense] = useState({ description: '', amount: '', paidBy: '', split: [] as string[] });
  const [upi, setUpi] = useState('');

  const load = useCallback(async () => {
    try {
      const t = await tripService.get(tripId, code);
      setTrip(t);
      setLoadError('');
      if (t.isMember) {
        const [e, s] = await Promise.all([tripService.expenses(tripId), tripService.settlement(tripId)]);
        setExpenses(e);
        setSettlement(s);
        setUpi(t.members.find(m => m.user._id === t.viewerId)?.upiId ?? '');
      }
    } catch (e) {
      setLoadError(errorHandler.process(e).message);
    }
  }, [tripId, code]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  /** Runs an action, shows any error, and reloads */
  const act = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    try {
      await fn();
      await load();
      if (done) Alert.alert(done);
      return true;
    } catch (e) {
      Alert.alert('That did not work', errorHandler.process(e).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!trip) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        {loadError ? <Text style={{ color: c.textSec, padding: 24, textAlign: 'center' }}>{loadError}</Text> : <ActivityIndicator color={c.primary} />}
      </View>
    );
  }

  const me = trip.viewerId ?? '';
  const nameOf = (id: string) => trip.members.find(m => m.user._id === id)?.user.name ?? 'Member';
  const memberIds = trip.members.map(m => m.user._id);
  const organizerName = typeof trip.organizer === 'object' ? trip.organizer.name : undefined;
  const splitNow = expense.split.length ? expense.split : memberIds;
  const amountNum = Number(expense.amount);

  const header = (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: c.text }} accessibilityRole="header">{trip.title}</Text>
      <Text style={{ fontSize: 14, color: c.textSec }}>
        {trip.destinations.map(d => d.name).join(' → ')} · {tripDates(trip)} ({tripDays(trip)} {tripDays(trip) === 1 ? 'day' : 'days'})
      </Text>
      <Text style={{ fontSize: 13, color: c.textSec }}>
        {cap(trip.tripType)} · {trip.members.length} of {trip.maxGroupSize} going
        {trip.budgetPerPerson ? ` · about ${inr(trip.budgetPerPerson)} each` : ''}
        {organizerName ? ` · organised by ${organizerName}` : ''}
      </Text>
      {trip.status !== 'planning' ? <Text style={{ fontSize: 13, fontWeight: '700', color: trip.status === 'cancelled' ? c.error : c.primary }}>{cap(trip.status)}</Text> : null}
      {trip.interests.length ? (
        <View style={styles.chips}>
          {trip.interests.map(i => (
            <View key={i} style={[styles.tag, { backgroundColor: c.surfaceVariant }]}><Text style={{ fontSize: 12, color: c.text }}>{cap(i)}</Text></View>
          ))}
        </View>
      ) : null}
      {trip.description ? <Text style={{ fontSize: 14, color: c.text }}>{trip.description}</Text> : null}
    </View>
  );

  const itinerary = trip.itinerary.length ? (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.cardTitle, { color: c.text }]}>Day by day</Text>
      {[...trip.itinerary].sort((a, b) => a.day - b.day).map(d => (
        <View key={d.day} style={styles.row}>
          <Text style={{ width: 52, color: c.textSec }}>Day {d.day}</Text>
          <Text style={{ flex: 1, color: c.text }}>{d.title}</Text>
        </View>
      ))}
    </View>
  ) : null;

  // ── Not a member: the plan and a request to join ─────────────────────────
  if (!trip.isMember) {
    const full = trip.members.length >= trip.maxGroupSize;
    return (
      <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        <Header onBack={() => navigation.goBack()} title="Trip" />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {header}
          {itinerary}
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Who is going</Text>
            {trip.members.map(m => (
              <Text key={m.user._id} style={{ color: c.text }}>{m.user.name ?? 'Member'}{m.role === 'organizer' ? ' (organiser)' : ''}</Text>
            ))}
          </View>
          {trip.myRequestStatus === 'pending' ? (
            <Text style={{ color: c.textSec, textAlign: 'center' }}>You asked to join. The organiser has been told.</Text>
          ) : trip.myRequestStatus === 'declined' ? (
            <Text style={{ color: c.textSec, textAlign: 'center' }}>The organiser could not take you on this trip.</Text>
          ) : full || trip.status !== 'planning' ? (
            <Text style={{ color: c.textSec, textAlign: 'center' }}>This trip is not taking new members.</Text>
          ) : (
            <>
              <TextInput value={joinMessage} onChangeText={setJoinMessage} multiline maxLength={500} placeholder="Say hello: who you are, what you like doing" placeholderTextColor={c.textSec} accessibilityLabel="Message to the organiser" style={[styles.input, styles.multi, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]} />
              <Pressable onPress={() => act(() => tripService.join(tripId, joinMessage.trim() || undefined, code), 'Request sent')} disabled={busy} accessibilityRole="button" style={[styles.primary, { backgroundColor: c.primary }]}>
                {busy ? <ActivityIndicator color={c.textOnPrimary} /> : <Text style={[styles.primaryText, { color: c.textOnPrimary }]}>Ask to join</Text>}
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Member view ──────────────────────────────────────────────────────────
  const votesOf = (a: Trip['activities'][number], v: TripVote) => a.votes.filter(x => x.vote === v).length;
  const myVote = (a: Trip['activities'][number]) => a.votes.find(x => x.user === me)?.vote;

  const planTab = (
    <>
      {itinerary}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>Activities</Text>
        <Text style={{ fontSize: 12, color: c.textSec }}>More than half the group voting yes confirms an activity and adds its cost to the expenses.</Text>
        {trip.activities.length === 0 ? <Text style={{ color: c.textSec }}>No activities proposed yet.</Text> : null}
        {trip.activities.map(a => (
          <View key={a._id} style={[styles.item, { borderColor: c.border }]}>
            <View style={styles.row}>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: c.text }}>{a.title}</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: a.status === 'confirmed' ? c.success : a.status === 'rejected' ? c.error : c.textSec }}>{cap(a.status)}</Text>
            </View>
            {a.cost || a.notes ? <Text style={{ fontSize: 13, color: c.textSec }}>{[a.cost ? inr(a.cost) : '', a.notes ?? ''].filter(Boolean).join(' · ')}</Text> : null}
            <Text style={{ fontSize: 12, color: c.textSec }}>Yes {votesOf(a, 'yes')} · No {votesOf(a, 'no')} · Maybe {votesOf(a, 'maybe')}</Text>
            {a.status === 'proposed' ? (
              <View style={styles.row}>
                {(['yes', 'no', 'maybe'] as const).map(v => {
                  const on = myVote(a) === v;
                  return (
                    <Pressable key={v} onPress={() => act(() => tripService.vote(tripId, a._id, v))} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: on }} style={[styles.voteBtn, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primaryLight : c.bg }]}>
                      <Text style={{ color: on ? c.primary : c.text, fontWeight: on ? '700' : '400' }}>{cap(v)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        ))}
        <Text style={[styles.label, { color: c.textSec }]}>Propose an activity</Text>
        <TextInput value={activity.title} onChangeText={t => setActivity(s => ({ ...s, title: t }))} placeholder="Dudhsagar falls trek" placeholderTextColor={c.textSec} maxLength={120} accessibilityLabel="Activity" style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]} />
        <View style={styles.row}>
          <TextInput value={activity.cost} onChangeText={t => setActivity(s => ({ ...s, cost: t.replace(/[^0-9.]/g, '') }))} placeholder="Total cost, ₹" placeholderTextColor={c.textSec} keyboardType="decimal-pad" accessibilityLabel="Total cost" style={[styles.input, { flex: 1, borderColor: c.border, color: c.text, backgroundColor: c.bg }]} />
          <TextInput value={activity.notes} onChangeText={t => setActivity(s => ({ ...s, notes: t }))} placeholder="When, notes" placeholderTextColor={c.textSec} maxLength={1000} accessibilityLabel="Notes" style={[styles.input, { flex: 2, borderColor: c.border, color: c.text, backgroundColor: c.bg }]} />
        </View>
        <Pressable
          onPress={async () => {
            const ok = await act(() => tripService.propose(tripId, { title: activity.title.trim(), cost: activity.cost ? Number(activity.cost) : undefined, notes: activity.notes.trim() || undefined }));
            if (ok) setActivity({ title: '', cost: '', notes: '' });
          }}
          disabled={activity.title.trim().length < 2 || busy}
          accessibilityRole="button"
          style={[styles.secondary, { borderColor: c.primary }]}
        >
          <Text style={{ color: c.primary, fontWeight: '700' }}>Propose</Text>
        </Pressable>
      </View>
    </>
  );

  const peopleTab = (
    <>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>Going ({trip.members.length} of {trip.maxGroupSize})</Text>
        {trip.members.map(m => (
          <View key={m.user._id} style={styles.row}>
            <Icon name="account-circle-outline" size={22} color={c.textSec} />
            <Text style={{ flex: 1, color: c.text }}>{m.user._id === me ? 'You' : m.user.name ?? 'Member'}{m.role === 'organizer' ? ' (organiser)' : ''}</Text>
            {m.upiId ? <Text style={{ fontSize: 12, color: c.textSec }}>{m.upiId}</Text> : null}
          </View>
        ))}
      </View>

      {trip.isOrganizer && trip.joinRequests.length ? (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>Asking to join</Text>
          {trip.joinRequests.map(r => (
            <View key={r._id} style={[styles.item, { borderColor: c.border }]}>
              <Text style={{ fontWeight: '600', color: c.text }}>{r.user.name ?? 'Someone'}</Text>
              {r.message ? <Text style={{ fontSize: 13, color: c.textSec }}>“{r.message}”</Text> : null}
              <View style={styles.row}>
                <Pressable onPress={() => act(() => tripService.respond(tripId, r._id, true))} disabled={busy} accessibilityRole="button" style={[styles.smallBtn, { backgroundColor: c.primary }]}>
                  <Text style={{ color: c.textOnPrimary, fontWeight: '700' }}>Accept</Text>
                </Pressable>
                <Pressable onPress={() => act(() => tripService.respond(tripId, r._id, false))} disabled={busy} accessibilityRole="button" style={[styles.smallBtn, { borderWidth: 1, borderColor: c.border }]}>
                  <Text style={{ color: c.text }}>Decline</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>Invite friends</Text>
        <Text style={{ fontSize: 13, color: c.textSec }}>They enter this code in Trips to see the plan and ask to join.</Text>
        <View style={styles.row}>
          <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', letterSpacing: 3, color: c.primary }}>{trip.inviteCode}</Text>
          <Pressable onPress={() => Share.share({ message: `Join my trip "${trip.title}" on Poolora: open Services > Trips and enter the invite code ${trip.inviteCode}` })} accessibilityRole="button" style={[styles.smallBtn, { borderWidth: 1, borderColor: c.primary }]}>
            <Text style={{ color: c.primary, fontWeight: '700' }}>Share</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>Your UPI id</Text>
        <Text style={{ fontSize: 13, color: c.textSec }}>So the group can pay you back in one tap. Only members see it.</Text>
        <View style={styles.row}>
          <TextInput value={upi} onChangeText={setUpi} autoCapitalize="none" placeholder="name@okaxis" placeholderTextColor={c.textSec} accessibilityLabel="UPI id" style={[styles.input, { flex: 1, borderColor: c.border, color: c.text, backgroundColor: c.bg }]} />
          <Pressable onPress={() => act(() => tripService.setUpi(tripId, upi.trim()), 'Saved')} disabled={busy} accessibilityRole="button" style={[styles.smallBtn, { backgroundColor: c.primary }]}>
            <Text style={{ color: c.textOnPrimary, fontWeight: '700' }}>Save</Text>
          </Pressable>
        </View>
      </View>

      {trip.isOrganizer ? (
        <View style={styles.row}>
          {trip.status === 'planning' ? (
            <Pressable onPress={() => act(() => tripService.update(tripId, { status: 'ongoing' }))} accessibilityRole="button" style={[styles.secondary, styles.grow, { borderColor: c.primary }]}>
              <Text style={{ color: c.primary, fontWeight: '700' }}>We have set off</Text>
            </Pressable>
          ) : trip.status === 'ongoing' ? (
            <Pressable onPress={() => act(() => tripService.update(tripId, { status: 'completed' }))} accessibilityRole="button" style={[styles.secondary, styles.grow, { borderColor: c.primary }]}>
              <Text style={{ color: c.primary, fontWeight: '700' }}>Trip finished</Text>
            </Pressable>
          ) : null}
          {trip.status === 'planning' ? (
            <Pressable
              onPress={() => Alert.alert('Cancel this trip?', 'Everyone on it will see it as cancelled.', [
                { text: 'Keep it', style: 'cancel' },
                { text: 'Cancel trip', style: 'destructive', onPress: () => act(() => tripService.update(tripId, { status: 'cancelled' })) },
              ])}
              accessibilityRole="button"
              style={[styles.secondary, styles.grow, { borderColor: c.error }]}
            >
              <Text style={{ color: c.error, fontWeight: '700' }}>Cancel trip</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Pressable
          onPress={() => Alert.alert('Leave this trip?', 'Settle up with the group first.', [
            { text: 'Stay', style: 'cancel' },
            { text: 'Leave', style: 'destructive', onPress: async () => { if (await act(() => tripService.leave(tripId))) navigation.goBack(); } },
          ])}
          accessibilityRole="button"
          style={[styles.secondary, { borderColor: c.error }]}
        >
          <Text style={{ color: c.error, fontWeight: '700' }}>Leave trip</Text>
        </Pressable>
      )}
    </>
  );

  const moneyTab = (
    <>
      {settlement ? (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>Settle up</Text>
          <Text style={{ fontSize: 14, color: c.textSec }}>{inr(settlement.total)} spent, about {inr(settlement.perPerson)} a person</Text>
          {settlement.members.map(m => (
            <View key={m.userId} style={styles.row}>
              <Text style={{ flex: 1, color: c.text }}>{m.userId === me ? 'You' : m.name}</Text>
              <Text style={{ fontSize: 13, color: c.textSec }}>paid {inr(m.paid)} · share {inr(m.share)}</Text>
              <Text style={{ width: 84, textAlign: 'right', fontWeight: '700', color: m.balance > 0 ? c.success : m.balance < 0 ? c.error : c.textSec }}>
                {m.balance > 0 ? `+${inr(m.balance)}` : m.balance < 0 ? `−${inr(-m.balance)}` : 'even'}
              </Text>
            </View>
          ))}
          {settlement.transfers.length === 0 ? (
            <Text style={{ color: c.textSec }}>Everyone is settled.</Text>
          ) : settlement.transfers.map(t => {
            const mine = t.from === me || t.to === me;
            return (
              <View key={`${t.from}-${t.to}`} style={[styles.item, { borderColor: c.border }]}>
                <Text style={{ fontSize: 15, color: c.text }}>
                  <Text style={{ fontWeight: '700' }}>{t.from === me ? 'You' : t.fromName}</Text> pay{t.from === me ? '' : 's'} <Text style={{ fontWeight: '700' }}>{t.to === me ? 'you' : t.toName}</Text> {inr(t.amount)}
                </Text>
                {mine ? (
                  <View style={styles.row}>
                    {t.from === me && t.upiLink ? (
                      <Pressable onPress={() => Linking.openURL(t.upiLink!).catch(() => Alert.alert('No UPI app found'))} accessibilityRole="button" style={[styles.smallBtn, { backgroundColor: c.primary }]}>
                        <Text style={{ color: c.textOnPrimary, fontWeight: '700' }}>Pay by UPI</Text>
                      </Pressable>
                    ) : null}
                    <Pressable onPress={() => act(() => tripService.markSettled(tripId, { from: t.from, to: t.to, amount: t.amount }))} disabled={busy} accessibilityRole="button" style={[styles.smallBtn, { borderWidth: 1, borderColor: c.primary }]}>
                      <Text style={{ color: c.primary, fontWeight: '700' }}>{t.from === me ? 'I have paid' : 'I got it'}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
          {settlement.transfers.length ? (
            <Pressable onPress={() => act(() => tripService.notifyAll(tripId), 'Everyone has been told what to pay')} disabled={busy} accessibilityRole="button" style={[styles.secondary, { borderColor: c.primary }]}>
              <Text style={{ color: c.primary, fontWeight: '700' }}>Remind everyone</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>Add an expense</Text>
        <TextInput value={expense.description} onChangeText={t => setExpense(s => ({ ...s, description: t }))} placeholder="Hotel, 2 nights" placeholderTextColor={c.textSec} maxLength={200} accessibilityLabel="What for" style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]} />
        <TextInput value={expense.amount} onChangeText={t => setExpense(s => ({ ...s, amount: t.replace(/[^0-9.]/g, '') }))} placeholder="Amount, ₹" placeholderTextColor={c.textSec} keyboardType="decimal-pad" accessibilityLabel="Amount" style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]} />
        <Text style={[styles.label, { color: c.textSec }]}>Paid by</Text>
        <View style={styles.chips}>
          {memberIds.map(id => {
            const on = (expense.paidBy || me) === id;
            return (
              <Pressable key={id} onPress={() => setExpense(s => ({ ...s, paidBy: id }))} accessibilityRole="radio" accessibilityState={{ checked: on }} style={[styles.chip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primaryLight : c.bg }]}>
                <Text style={{ color: on ? c.primary : c.text }}>{id === me ? 'You' : nameOf(id)}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.label, { color: c.textSec }]}>Split between</Text>
        <View style={styles.chips}>
          {memberIds.map(id => {
            const on = splitNow.includes(id);
            return (
              <Pressable
                key={id}
                onPress={() => setExpense(s => {
                  const current = s.split.length ? s.split : memberIds;
                  const next = on ? current.filter(x => x !== id) : [...current, id];
                  return { ...s, split: next.length ? next : current };
                })}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={[styles.chip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primaryLight : c.bg }]}
              >
                <Text style={{ color: on ? c.primary : c.text }}>{id === me ? 'You' : nameOf(id)}</Text>
              </Pressable>
            );
          })}
        </View>
        {amountNum > 0 ? <Text style={{ fontSize: 13, color: c.textSec }}>{inr(Math.round((amountNum / splitNow.length) * 100) / 100)} each</Text> : null}
        <Pressable
          onPress={async () => {
            const ok = await act(() => tripService.addExpense(tripId, { description: expense.description.trim(), amount: amountNum, paidBy: expense.paidBy || me, splitAmong: splitNow }));
            if (ok) setExpense({ description: '', amount: '', paidBy: '', split: [] });
          }}
          disabled={expense.description.trim().length < 2 || !(amountNum > 0) || busy}
          accessibilityRole="button"
          style={[styles.primary, { backgroundColor: expense.description.trim().length >= 2 && amountNum > 0 ? c.primary : c.border }]}
        >
          <Text style={[styles.primaryText, { color: expense.description.trim().length >= 2 && amountNum > 0 ? c.textOnPrimary : c.textSec }]}>Add expense</Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>Expenses</Text>
        {expenses.length === 0 ? <Text style={{ color: c.textSec }}>Nothing yet.</Text> : expenses.map(e => (
          <Pressable
            key={e._id}
            onLongPress={() => (e.createdBy === me || trip.isOrganizer) && Alert.alert('Remove this expense?', e.description, [
              { text: 'Keep', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: () => act(() => tripService.deleteExpense(tripId, e._id)) },
            ])}
            accessibilityRole="text"
            accessibilityHint={e.createdBy === me || trip.isOrganizer ? 'Long press to remove' : undefined}
            style={styles.row}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text }}>{e.description}</Text>
              <Text style={{ fontSize: 12, color: c.textSec }}>
                {e.paidBy?._id === me ? 'You' : e.paidBy?.name ?? 'Member'} paid · split {e.splitAmong.length} ways
              </Text>
            </View>
            <Text style={{ fontWeight: '700', color: c.text }}>{inr(e.amount)}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <Header onBack={() => navigation.goBack()} title="Trip" />
      <View style={[styles.tabs, { borderBottomColor: c.border }]} accessibilityRole="tablist">
        {([['plan', 'Plan'], ['people', trip.joinRequests.length ? `People (${trip.joinRequests.length})` : 'People'], ['money', 'Money']] as const).map(([v, l]) => (
          <Pressable key={v} onPress={() => setTab(v)} accessibilityRole="tab" accessibilityState={{ selected: tab === v }} style={[styles.tab, tab === v && { borderBottomColor: c.primary }]}>
            <Text style={{ fontWeight: tab === v ? '700' : '500', color: tab === v ? c.primary : c.textSec }}>{l}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {tab === 'plan' ? header : null}
        {tab === 'plan' ? planTab : tab === 'people' ? peopleTab : moneyTab}
      </ScrollView>
    </View>
  );

  function Header({ onBack, title }: { onBack: () => void; title: string }) {
    return (
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <BackButton onPress={onBack} />
        <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">{title}</Text>
        <View style={{ width: 44 }} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600' },
  item: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 12, justifyContent: 'center' },
  tag: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 },
  multi: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' },
  voteBtn: { flex: 1, minHeight: 44, borderWidth: 1.5, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primary: { minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 16, fontWeight: '700' },
  secondary: { minHeight: 48, borderWidth: 1.5, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  smallBtn: { minHeight: 44, borderRadius: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
});
