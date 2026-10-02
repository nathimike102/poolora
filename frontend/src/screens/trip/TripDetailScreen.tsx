/**
 * screens/trip/TripDetailScreen.tsx
 *
 * One group trip. Anyone who can see it gets the plan and can ask to join.
 * Members get three tabs: Plan (the day-by-day outline and activities the
 * group votes on, UC-T04), People (members, join requests, the invite code
 * and mobile money numbers) and Money (shared expenses and settling up, UC-T03, UC-T05).
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, Linking, Share, Platform } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { BackButton } from '../../components/BackButton';
import { Icon } from '../../components/Icon';
import { StarRating } from '../../components/RatingForm';
import { tripService, tripDates, tripDays, type Trip, type TripExpense, type Settlement, type TripVote } from '../../services/tripService';
import { errorHandler } from '../../utils/errorHandler';
import type { RootStackParamList } from '../../navigation/types';
import { currencySymbol, formatPhone, money } from '../../utils/region';
import { Trans, useTranslation } from 'react-i18next';

type Tab = 'plan' | 'people' | 'money';
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function TripDetailScreen() {
  const { tripId, code } = useRoute<RouteProp<RootStackParamList, 'TripDetail'>>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { c } = useApp();
  const { t } = useTranslation();
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
  const [payNumber, setPayNumber] = useState('');
  const [rating, setRating] = useState({ score: 0, comment: '' });

  const load = useCallback(async () => {
    try {
      const item = await tripService.get(tripId, code);
      setTrip(item);
      setLoadError('');
      if (item.isMember) {
        const [e, s] = await Promise.all([tripService.expenses(tripId), tripService.settlement(tripId)]);
        setExpenses(e);
        setSettlement(s);
        setPayNumber(item.members.find(m => m.user._id === item.viewerId)?.payNumber ?? '');
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
      Alert.alert(t('tripDetail.thatDidNotWork'), errorHandler.process(e).message);
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
  const organizerStats = typeof trip.organizer === 'object' ? trip.organizer.stats : undefined;
  const splitNow = expense.split.length ? expense.split : memberIds;
  const amountNum = Number(expense.amount);

  const header = (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: c.text }} accessibilityRole="header">{trip.title}</Text>
      <Text style={{ fontSize: 14, color: c.textSec }}>
        {trip.destinations.map(d => d.name).join(' → ')} · {tripDates(trip)} ({tripDays(trip)} {tripDays(trip) === 1 ? 'day' : 'days'})
      </Text>
      <Text style={{ fontSize: 13, color: c.textSec }}>
        {t('tripDetail.summary', { type: t(`planTrip.types.${trip.tripType}`, { defaultValue: cap(trip.tripType) }), count: trip.members.length, max: trip.maxGroupSize })}
        {trip.budgetPerPerson ? ` · about ${money(trip.budgetPerPerson)} each` : ''}
        {organizerName ? ` · organised by ${organizerName}` : ''}
        {organizerStats?.totalRatingsAsOrganizer ? ` (★ ${organizerStats.avgRatingAsOrganizer?.toFixed(1)} from ${organizerStats.totalRatingsAsOrganizer} ${organizerStats.totalRatingsAsOrganizer === 1 ? 'trip rating' : 'trip ratings'})` : ''}
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
      <Text style={[styles.cardTitle, { color: c.text }]}>{t('tripDetail.dayByDay')}</Text>
      {[...trip.itinerary].sort((a, b) => a.day - b.day).map(d => (
        <View key={d.day} style={styles.row}>
          <Text style={{ width: 52, color: c.textSec }}>{t('tripDetail.day', { n: d.day })}</Text>
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
        <Header onBack={() => navigation.goBack()} title={t('tripDetail.trip')} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {header}
          {itinerary}
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>{t('tripDetail.whoIsGoing')}</Text>
            {trip.members.map(m => (
              <Text key={m.user._id} style={{ color: c.text }}>{m.user.name ?? t('tripDetail.member')}{m.role === 'organizer' ? t('tripDetail.organiserSuffix') : ''}</Text>
            ))}
          </View>
          {trip.myRequestStatus === 'pending' ? (
            <Text style={{ color: c.textSec, textAlign: 'center' }}>{t('tripDetail.youAskedToJoinThe')}</Text>
          ) : trip.myRequestStatus === 'declined' ? (
            <Text style={{ color: c.textSec, textAlign: 'center' }}>{t('tripDetail.theOrganiserCouldNotTake')}</Text>
          ) : full || trip.status !== 'planning' ? (
            <Text style={{ color: c.textSec, textAlign: 'center' }}>{t('tripDetail.thisTripIsNotTaking')}</Text>
          ) : (
            <>
              <TextInput value={joinMessage} onChangeText={setJoinMessage} multiline maxLength={500} placeholder={t('tripDetail.sayHelloWhoYouAre')} placeholderTextColor={c.textSec} accessibilityLabel={t('tripDetail.messageToTheOrganiser')} style={[styles.input, styles.multi, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]} />
              <Pressable onPress={() => act(() => tripService.join(tripId, joinMessage.trim() || undefined, code), t('tripDetail.requestSent'))} disabled={busy} accessibilityRole="button" style={[styles.primary, { backgroundColor: c.primary }]}>
                {busy ? <ActivityIndicator color={c.textOnPrimary} /> : <Text style={[styles.primaryText, { color: c.textOnPrimary }]}>{t('tripDetail.askToJoin')}</Text>}
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

  const addToCalendar = () =>
    act(async () => {
      const link = await tripService.calendarLink(tripId);
      // iOS subscribes to webcal links; Android hands the .ics file to the calendar app
      await Linking.openURL(Platform.OS === 'ios' ? link.webcalUrl : link.url);
    });

  const rateCard = trip.canRateOrganizer ? (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.cardTitle, { color: c.text }]}>{t('tripDetail.rateOrganiser', { name: organizerName ?? t('tripDetail.theOrganiser') })}</Text>
      <StarRating value={rating.score} onChange={score => setRating(r => ({ ...r, score }))} label={t('tripDetail.organiserRating')} />
      <TextInput value={rating.comment} onChangeText={comment => setRating(r => ({ ...r, comment }))} multiline maxLength={500} placeholder={t('tripDetail.anythingToAddOnlyPoolora')} placeholderTextColor={c.textSec} accessibilityLabel={t('tripDetail.comment')} style={[styles.input, styles.multi, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]} />
      <Pressable onPress={() => act(() => tripService.rateOrganizer(tripId, rating.score, rating.comment.trim() || undefined), t('tripDetail.thanksRating'))} disabled={!rating.score || busy} accessibilityRole="button" style={[styles.primary, { backgroundColor: rating.score ? c.primary : c.border }]}>
        <Text style={[styles.primaryText, { color: c.textOnPrimary }]}>{t('tripDetail.sendRating')}</Text>
      </Pressable>
    </View>
  ) : trip.myOrganizerRating ? (
    <Text style={{ color: c.textSec, textAlign: 'center' }}>{t('tripDetail.youRated', { score: trip.myOrganizerRating.score })}</Text>
  ) : null;

  const planTab = (
    <>
      {rateCard}
      {itinerary}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>{t('tripDetail.activities')}</Text>
        <Text style={{ fontSize: 12, color: c.textSec }}>{t('tripDetail.moreThanHalfTheGroup')}</Text>
        {trip.activities.length === 0 ? <Text style={{ color: c.textSec }}>{t('tripDetail.noActivitiesProposedYet')}</Text> : null}
        {trip.activities.map(a => (
          <View key={a._id} style={[styles.item, { borderColor: c.border }]}>
            <View style={styles.row}>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: c.text }}>{a.title}</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: a.status === 'confirmed' ? c.success : a.status === 'rejected' ? c.error : c.textSec }}>{cap(a.status)}</Text>
            </View>
            {a.cost || a.notes ? <Text style={{ fontSize: 13, color: c.textSec }}>{[a.cost ? money(a.cost) : '', a.notes ?? ''].filter(Boolean).join(' · ')}</Text> : null}
            <Text style={{ fontSize: 12, color: c.textSec }}>{t('tripDetail.votes', { yes: votesOf(a, 'yes'), no: votesOf(a, 'no'), maybe: votesOf(a, 'maybe') })}</Text>
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
        <Text style={[styles.label, { color: c.textSec }]}>{t('tripDetail.proposeAnActivity')}</Text>
        <TextInput value={activity.title} onChangeText={value => setActivity(s => ({ ...s, title: value }))} placeholder={t('tripDetail.activityPlaceholder')} placeholderTextColor={c.textSec} maxLength={120} accessibilityLabel={t('tripDetail.activity')} style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]} />
        <View style={styles.row}>
          <TextInput value={activity.cost} onChangeText={value => setActivity(s => ({ ...s, cost: value.replace(/[^0-9.]/g, '') }))} placeholder={`Total cost, ${currencySymbol()}`} placeholderTextColor={c.textSec} keyboardType="decimal-pad" accessibilityLabel={t('tripDetail.totalCost')} style={[styles.input, { flex: 1, borderColor: c.border, color: c.text, backgroundColor: c.bg }]} />
          <TextInput value={activity.notes} onChangeText={value => setActivity(s => ({ ...s, notes: value }))} placeholder={t('tripDetail.whenNotes')} placeholderTextColor={c.textSec} maxLength={1000} accessibilityLabel={t('tripDetail.notes')} style={[styles.input, { flex: 2, borderColor: c.border, color: c.text, backgroundColor: c.bg }]} />
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
          <Text style={{ color: c.primary, fontWeight: '700' }}>{t('tripDetail.propose')}</Text>
        </Pressable>
      </View>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>{t('tripDetail.calendar')}</Text>
        <Text style={{ fontSize: 13, color: c.textSec }}>{t('tripDetail.addTheTripAndEvery')}</Text>
        <Pressable onPress={addToCalendar} disabled={busy} accessibilityRole="button" style={[styles.secondary, { borderColor: c.primary }]}>
          <Text style={{ color: c.primary, fontWeight: '700' }}>{t('tripDetail.addToMyCalendar')}</Text>
        </Pressable>
      </View>
    </>
  );

  const peopleTab = (
    <>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>{t('tripDetail.going', { count: trip.members.length, max: trip.maxGroupSize })}</Text>
        {trip.members.map(m => (
          <View key={m.user._id} style={styles.row}>
            <Icon name="account-circle-outline" size={22} color={c.textSec} />
            <Text style={{ flex: 1, color: c.text }}>{m.user._id === me ? t('tripDetail.you') : m.user.name ?? t('tripDetail.member')}{m.role === 'organizer' ? t('tripDetail.organiserSuffix') : ''}</Text>
            {m.payNumber ? <Text style={{ fontSize: 12, color: c.textSec }}>{formatPhone(m.payNumber)}</Text> : null}
          </View>
        ))}
      </View>

      {trip.isOrganizer && trip.joinRequests.length ? (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>{t('tripDetail.askingToJoin')}</Text>
          {trip.joinRequests.map(r => (
            <View key={r._id} style={[styles.item, { borderColor: c.border }]}>
              <Text style={{ fontWeight: '600', color: c.text }}>{r.user.name ?? 'Someone'}</Text>
              {r.message ? <Text style={{ fontSize: 13, color: c.textSec }}>“{r.message}”</Text> : null}
              <View style={styles.row}>
                <Pressable onPress={() => act(() => tripService.respond(tripId, r._id, true))} disabled={busy} accessibilityRole="button" style={[styles.smallBtn, { backgroundColor: c.primary }]}>
                  <Text style={{ color: c.textOnPrimary, fontWeight: '700' }}>{t('tripDetail.accept')}</Text>
                </Pressable>
                <Pressable onPress={() => act(() => tripService.respond(tripId, r._id, false))} disabled={busy} accessibilityRole="button" style={[styles.smallBtn, { borderWidth: 1, borderColor: c.border }]}>
                  <Text style={{ color: c.text }}>{t('tripDetail.decline')}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>{t('tripDetail.inviteFriends')}</Text>
        <Text style={{ fontSize: 13, color: c.textSec }}>{t('tripDetail.theyEnterThisCodeIn')}</Text>
        <View style={styles.row}>
          <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', letterSpacing: 3, color: c.primary }}>{trip.inviteCode}</Text>
          <Pressable onPress={() => Share.share({ message: t('tripDetail.invite', { title: trip.title, code: trip.inviteCode }) })} accessibilityRole="button" style={[styles.smallBtn, { borderWidth: 1, borderColor: c.primary }]}>
            <Text style={{ color: c.primary, fontWeight: '700' }}>{t('tripDetail.share')}</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>{t('tripDetail.yourMobileMoneyNumber')}</Text>
        <Text style={{ fontSize: 13, color: c.textSec }}>{t('tripDetail.ecocashOnemoneyOrInnbucksSo')}</Text>
        <View style={styles.row}>
          <TextInput value={payNumber} onChangeText={setPayNumber} keyboardType="phone-pad" placeholder="0771 234 567" placeholderTextColor={c.textSec} accessibilityLabel={t('tripDetail.mobileMoneyNumber')} style={[styles.input, { flex: 1, borderColor: c.border, color: c.text, backgroundColor: c.bg }]} />
          <Pressable onPress={() => act(() => tripService.setPayNumber(tripId, payNumber.trim()), 'Saved')} disabled={busy} accessibilityRole="button" style={[styles.smallBtn, { backgroundColor: c.primary }]}>
            <Text style={{ color: c.textOnPrimary, fontWeight: '700' }}>{t('tripDetail.save')}</Text>
          </Pressable>
        </View>
      </View>

      {trip.isOrganizer ? (
        <View style={styles.row}>
          {trip.status === 'planning' ? (
            <Pressable onPress={() => act(() => tripService.update(tripId, { status: 'ongoing' }))} accessibilityRole="button" style={[styles.secondary, styles.grow, { borderColor: c.primary }]}>
              <Text style={{ color: c.primary, fontWeight: '700' }}>{t('tripDetail.weHaveSetOff')}</Text>
            </Pressable>
          ) : trip.status === 'ongoing' ? (
            <Pressable onPress={() => act(() => tripService.update(tripId, { status: 'completed' }))} accessibilityRole="button" style={[styles.secondary, styles.grow, { borderColor: c.primary }]}>
              <Text style={{ color: c.primary, fontWeight: '700' }}>{t('tripDetail.tripFinished')}</Text>
            </Pressable>
          ) : null}
          {trip.status === 'planning' ? (
            <Pressable
              onPress={() => Alert.alert(t('tripDetail.cancelThisTrip'), t('tripDetail.everyoneOnItWillSee'), [
                { text: t('tripDetail.keepIt'), style: 'cancel' },
                { text: t('tripDetail.cancelTrip'), style: 'destructive', onPress: () => act(() => tripService.update(tripId, { status: 'cancelled' })) },
              ])}
              accessibilityRole="button"
              style={[styles.secondary, styles.grow, { borderColor: c.error }]}
            >
              <Text style={{ color: c.error, fontWeight: '700' }}>{t('tripDetail.cancelTrip')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Pressable
          onPress={() => Alert.alert(t('tripDetail.leaveThisTrip'), t('tripDetail.settleUpWithTheGroup'), [
            { text: t('tripDetail.stay'), style: 'cancel' },
            { text: t('tripDetail.leave'), style: 'destructive', onPress: async () => { if (await act(() => tripService.leave(tripId))) navigation.goBack(); } },
          ])}
          accessibilityRole="button"
          style={[styles.secondary, { borderColor: c.error }]}
        >
          <Text style={{ color: c.error, fontWeight: '700' }}>{t('tripDetail.leaveTrip')}</Text>
        </Pressable>
      )}
    </>
  );

  const moneyTab = (
    <>
      {settlement ? (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>{t('tripDetail.settleUp')}</Text>
          <Text style={{ fontSize: 14, color: c.textSec }}>{t('tripDetail.spent', { total: money(settlement.total), each: money(settlement.perPerson) })}</Text>
          {settlement.members.map(m => (
            <View key={m.userId} style={styles.row}>
              <Text style={{ flex: 1, color: c.text }}>{m.userId === me ? 'You' : m.name}</Text>
              <Text style={{ fontSize: 13, color: c.textSec }}>{t('tripDetail.paidShare', { paid: money(m.paid), share: money(m.share) })}</Text>
              <Text style={{ width: 84, textAlign: 'right', fontWeight: '700', color: m.balance > 0 ? c.success : m.balance < 0 ? c.error : c.textSec }}>
                {m.balance > 0 ? `+${money(m.balance)}` : m.balance < 0 ? `−${money(-m.balance)}` : 'even'}
              </Text>
            </View>
          ))}
          {settlement.transfers.length === 0 ? (
            <Text style={{ color: c.textSec }}>{t('tripDetail.everyoneIsSettled')}</Text>
          ) : settlement.transfers.map(item => {
            const mine = item.from === me || item.to === me;
            return (
              <View key={`${item.from}-${item.to}`} style={[styles.item, { borderColor: c.border }]}>
                <Text style={{ fontSize: 15, color: c.text }}>
                  <Trans
                    i18nKey={item.from === me ? 'tripDetail.transfer.youPay' : item.to === me ? 'tripDetail.transfer.paysYou' : 'tripDetail.transfer.pays'}
                    values={{ name: item.from === me ? item.toName : item.fromName, from: item.fromName, to: item.toName, amount: money(item.amount) }}
                    components={{ b: <Text style={{ fontWeight: '700' }} /> }}
                  />
                </Text>
                {mine ? (
                  <View style={styles.row}>
                    {item.from === me && item.ecocashLink ? (
                      <Pressable onPress={() => Linking.openURL(item.ecocashLink!).catch(() => Alert.alert(t('tripDetail.couldNotOpenTheDialler'), `Dial *151# and send ${money(item.amount)} to ${formatPhone(item.payNumber ?? '')}.`))} accessibilityRole="button" accessibilityHint={t('tripDetail.dialsEcocashWithTheNumber')} style={[styles.smallBtn, { backgroundColor: c.primary }]}>
                        <Text style={{ color: c.textOnPrimary, fontWeight: '700' }}>{t('tripDetail.payWithEcocash')}</Text>
                      </Pressable>
                    ) : item.from === me && item.payNumber ? (
                      <Text style={{ fontSize: 13, color: c.textSec }}>{t('tripDetail.sendTo', { number: formatPhone(item.payNumber) })}</Text>
                    ) : null}
                    <Pressable onPress={() => act(() => tripService.markSettled(tripId, { from: item.from, to: item.to, amount: item.amount }))} disabled={busy} accessibilityRole="button" style={[styles.smallBtn, { borderWidth: 1, borderColor: c.primary }]}>
                      <Text style={{ color: c.primary, fontWeight: '700' }}>{item.from === me ? t('tripDetail.iHavePaid') : t('tripDetail.iGotIt')}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
          {settlement.transfers.length ? (
            <Pressable onPress={() => act(() => tripService.notifyAll(tripId), t('tripDetail.everyoneTold'))} disabled={busy} accessibilityRole="button" style={[styles.secondary, { borderColor: c.primary }]}>
              <Text style={{ color: c.primary, fontWeight: '700' }}>{t('tripDetail.remindEveryone')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>{t('tripDetail.addAnExpense')}</Text>
        <TextInput value={expense.description} onChangeText={value => setExpense(s => ({ ...s, description: value }))} placeholder={t('tripDetail.hotel2Nights')} placeholderTextColor={c.textSec} maxLength={200} accessibilityLabel={t('tripDetail.whatFor')} style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]} />
        <TextInput value={expense.amount} onChangeText={value => setExpense(s => ({ ...s, amount: value.replace(/[^0-9.]/g, '') }))} placeholder={`Amount, ${currencySymbol()}`} placeholderTextColor={c.textSec} keyboardType="decimal-pad" accessibilityLabel={t('tripDetail.amount')} style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]} />
        <Text style={[styles.label, { color: c.textSec }]}>{t('tripDetail.paidBy')}</Text>
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
        <Text style={[styles.label, { color: c.textSec }]}>{t('tripDetail.splitBetween')}</Text>
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
        {amountNum > 0 ? <Text style={{ fontSize: 13, color: c.textSec }}>{money(Math.round((amountNum / splitNow.length) * 100) / 100)} each</Text> : null}
        <Pressable
          onPress={async () => {
            const ok = await act(() => tripService.addExpense(tripId, { description: expense.description.trim(), amount: amountNum, paidBy: expense.paidBy || me, splitAmong: splitNow }));
            if (ok) setExpense({ description: '', amount: '', paidBy: '', split: [] });
          }}
          disabled={expense.description.trim().length < 2 || !(amountNum > 0) || busy}
          accessibilityRole="button"
          style={[styles.primary, { backgroundColor: expense.description.trim().length >= 2 && amountNum > 0 ? c.primary : c.border }]}
        >
          <Text style={[styles.primaryText, { color: expense.description.trim().length >= 2 && amountNum > 0 ? c.textOnPrimary : c.textSec }]}>{t('tripDetail.addExpense')}</Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>{t('tripDetail.expenses')}</Text>
        {expenses.length === 0 ? <Text style={{ color: c.textSec }}>{t('tripDetail.nothingYet')}</Text> : expenses.map(e => (
          <Pressable
            key={e._id}
            onLongPress={() => (e.createdBy === me || trip.isOrganizer) && Alert.alert(t('tripDetail.removeThisExpense'), e.description, [
              { text: t('tripDetail.keep'), style: 'cancel' },
              { text: t('tripDetail.remove'), style: 'destructive', onPress: () => act(() => tripService.deleteExpense(tripId, e._id)) },
            ])}
            accessibilityRole="text"
            accessibilityHint={e.createdBy === me || trip.isOrganizer ? t('tripDetail.longPressRemove') : undefined}
            style={styles.row}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text }}>{e.description}</Text>
              <Text style={{ fontSize: 12, color: c.textSec }}>
                {e.paidBy?._id === me ? 'You' : e.paidBy?.name ?? 'Member'} paid · split {e.splitAmong.length} ways
              </Text>
            </View>
            <Text style={{ fontWeight: '700', color: c.text }}>{money(e.amount)}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <Header onBack={() => navigation.goBack()} title={t('tripDetail.trip')} />
      <View style={[styles.tabs, { borderBottomColor: c.border }]} accessibilityRole="tablist">
        {([['plan', t('tripDetail.tabs.plan')], ['people', trip.joinRequests.length ? t('tripDetail.tabs.peopleCount', { count: trip.joinRequests.length }) : t('tripDetail.tabs.people')], ['money', t('tripDetail.tabs.money')]] as const).map(([v, l]) => (
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
