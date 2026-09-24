import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/BackButton';
import type { RootStackParamList } from '../../navigation/types';
import { Icon } from '../../components/Icon';
import { safetyService, type EmergencyContact } from '../../services/safetyService';
import { errorHandler } from '../../utils/errorHandler';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MAX_CONTACTS = 3;

/** Accepts a 10-digit Indian mobile number, with or without +91 or spaces. */
function toE164(input: string): string | null {
  const digits = input.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

export function EmergencyContactsScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState<EmergencyContact[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRelation, setNewRelation] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [formError, setFormError] = useState('');
  const [verifying, setVerifying] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadError(false);
    safetyService
      .getEmergencyContacts()
      .then(setContacts)
      .catch(() => setLoadError(true));
  }, []);

  useEffect(load, [load]);

  const save = async (next: EmergencyContact[]): Promise<boolean> => {
    setSaving(true);
    try {
      setContacts(await safetyService.updateEmergencyContacts(next));
      return true;
    } catch {
      Alert.alert('Not saved', 'Your emergency contacts could not be saved. Check your connection and try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const addContact = async () => {
    const phone = toE164(newPhone);
    if (!phone) {
      setFormError('Enter a 10-digit mobile number.');
      return;
    }
    if (contacts?.some(ct => ct.phone === phone)) {
      setFormError('This number is already one of your contacts.');
      return;
    }
    const email = newEmail.trim();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      setFormError('Check the email address, or leave it empty.');
      return;
    }
    setFormError('');
    const ok = await save([
      ...(contacts ?? []),
      { name: newName.trim(), phone, relation: newRelation.trim(), email: email || undefined, notifyOnSos: true },
    ]);
    if (ok) {
      setNewName('');
      setNewPhone('');
      setNewRelation('');
      setNewEmail('');
      setShowAdd(false);
    }
  };

  const update = (contact: EmergencyContact, change: Partial<EmergencyContact>) =>
    save((contacts ?? []).map(ct => (ct.phone === contact.phone ? { ...ct, ...change } : change.primary ? { ...ct, primary: false } : ct)));

  const verify = async (contact: EmergencyContact) => {
    if (!contact._id) return;
    setVerifying(contact._id);
    try {
      await safetyService.verifyEmergencyContact(contact._id);
      Alert.alert('Text sent', `${contact.name} will get a text with a link to confirm. We'll let you know when they do.`);
      load();
    } catch (error) {
      Alert.alert('Not sent', errorHandler.process(error).message);
    } finally {
      setVerifying(null);
    }
  };

  const remove = (contact: EmergencyContact) => {
    Alert.alert('Remove contact', `${contact.name} will no longer be alerted if you raise an SOS.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => save((contacts ?? []).filter(ct => ct.phone !== contact.phone)),
      },
    ]);
  };

  const count = contacts?.length ?? 0;
  const canSave = Boolean(newName.trim() && newPhone.trim() && newRelation.trim()) && !saving;

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────── */}
      <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={s.flex1}>
          <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '700', color: c.text }}>
            Emergency contacts
          </Text>
          <Text style={{ fontSize: 12, color: c.textSec }}>
            {count} of {MAX_CONTACTS} added
          </Text>
        </View>
        {contacts && count < MAX_CONTACTS && !showAdd && (
          <Pressable
            onPress={() => setShowAdd(true)}
            accessibilityRole="button"
            accessibilityLabel="Add emergency contact"
            style={[s.addBtn, { backgroundColor: c.primaryLight }]}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>Add</Text>
          </Pressable>
        )}
      </View>

      {/* ── Body ────────────────────────────────────────────── */}
      <ScrollView
        style={s.flex1}
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[s.infoBanner, { backgroundColor: c.errorLight }]}>
          <Icon name="shield-alert" size={16} color={c.error} />
          <Text style={{ fontSize: 13, color: c.text, lineHeight: 18, flex: 1 }}>
            When you raise an SOS during a ride, these people get a text message with a link to your
            live location. Add up to {MAX_CONTACTS} people you trust, and ask each to confirm so you know
            the number is right.
          </Text>
        </View>

        {loadError && (
          <Pressable onPress={load} accessibilityRole="button" style={[s.card, s.cardBody, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={{ flex: 1, fontSize: 14, color: c.text }}>
              Your contacts could not be loaded. Tap to try again.
            </Text>
          </Pressable>
        )}

        {contacts === null && !loadError && <ActivityIndicator color={c.primary} style={{ padding: 20 }} />}

        {contacts?.map(contact => (
          <View key={contact.phone} style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={s.cardBody}>
              <View style={[s.iconBox, { backgroundColor: c.primaryLight }]}>
                <Icon name="account" size={26} color={c.primary} />
              </View>
              <View style={s.flex1}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{contact.name}</Text>
                <Text style={{ fontSize: 13, color: c.textSec }}>{contact.relation}</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: c.text, marginTop: 2 }}>
                  {contact.phone}
                </Text>
                {contact.email ? <Text style={{ fontSize: 13, color: c.textSec }}>{contact.email}</Text> : null}
                <View style={s.tags}>
                  {contact.primary ? (
                    <View style={[s.tag, { backgroundColor: c.primaryLight }]}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: c.primary }}>Primary</Text>
                    </View>
                  ) : null}
                  <View style={[s.tag, { backgroundColor: contact.verified ? c.successLight : c.surfaceVariant }]}>
                    <Icon name={contact.verified ? 'check-decagram' : 'help-circle-outline'} size={14} color={contact.verified ? c.success : c.textSec} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: c.text }}>{contact.verified ? 'Confirmed' : 'Not confirmed'}</Text>
                  </View>
                </View>
              </View>
              <Pressable
                onPress={() => remove(contact)}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${contact.name}`}
                style={[s.actionBtn, { backgroundColor: c.errorLight }]}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: c.error }}>Remove</Text>
              </Pressable>
            </View>
            <View style={[s.cardFoot, { borderTopColor: c.border }]}>
              <View style={s.switchRow}>
                <Text style={{ flex: 1, fontSize: 14, color: c.text }}>Gets my SOS text</Text>
                <Switch
                  value={contact.notifyOnSos !== false}
                  onValueChange={on => { void update(contact, { notifyOnSos: on }); }}
                  disabled={saving}
                  accessibilityLabel={`${contact.name} gets my SOS text`}
                  trackColor={{ false: c.border, true: c.primary }}
                />
              </View>
              <View style={s.footBtns}>
                {!contact.primary && (
                  <Pressable onPress={() => update(contact, { primary: true })} disabled={saving} accessibilityRole="button" style={s.linkBtn}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: c.primary }}>Make primary</Text>
                  </Pressable>
                )}
                {!contact.verified && contact._id && (
                  <Pressable
                    onPress={() => verify(contact)}
                    disabled={verifying !== null}
                    accessibilityRole="button"
                    accessibilityLabel={`Ask ${contact.name} to confirm by text`}
                    style={s.linkBtn}
                  >
                    {verifying === contact._id ? <ActivityIndicator color={c.primary} /> : (
                      <Text style={{ fontSize: 14, fontWeight: '600', color: c.primary }}>
                        {contact.verificationSentAt ? 'Send the text again' : 'Ask them to confirm'}
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        ))}

        {contacts && count > 0 && contacts.every(ct => ct.notifyOnSos === false) && (
          <Text style={{ fontSize: 13, color: c.error }} accessibilityLiveRegion="polite">
            Nobody will get a text if you raise an SOS. Turn on "Gets my SOS text" for at least one contact.
          </Text>
        )}

        {contacts && count === 0 && !showAdd && (
          <Pressable
            onPress={() => setShowAdd(true)}
            accessibilityRole="button"
            style={[s.emptySlot, { borderColor: c.border }]}
          >
            <Icon name="plus" size={24} color={c.textSec} />
            <Text style={{ fontSize: 14, color: c.textSec }}>Add your first emergency contact</Text>
          </Pressable>
        )}

        {showAdd && (
          <View style={[s.formCard, { backgroundColor: c.surface, borderColor: c.primary }]}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 14 }}>
              New emergency contact
            </Text>

            {[
              { label: 'Name', value: newName, setter: setNewName, placeholder: 'Their name', kb: 'default' as const, ac: 'name' as const },
              { label: 'Mobile number', value: newPhone, setter: setNewPhone, placeholder: '10-digit mobile number', kb: 'phone-pad' as const, ac: 'tel' as const },
              { label: 'Relationship', value: newRelation, setter: setNewRelation, placeholder: 'For example, sister', kb: 'default' as const, ac: 'off' as const },
              { label: 'Email (optional)', value: newEmail, setter: setNewEmail, placeholder: 'name@example.com', kb: 'email-address' as const, ac: 'email' as const },
            ].map(f => (
              <View key={f.label} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: c.textSec, marginBottom: 6 }}>
                  {f.label}
                </Text>
                <TextInput
                  value={f.value}
                  onChangeText={f.setter}
                  placeholder={f.placeholder}
                  placeholderTextColor={c.textSec}
                  keyboardType={f.kb}
                  autoComplete={f.ac}
                  accessibilityLabel={f.label}
                  style={[s.formInput, { backgroundColor: c.bg, borderColor: c.border, color: c.text }]}
                />
              </View>
            ))}

            {formError ? (
              <Text style={{ fontSize: 13, color: c.error, marginBottom: 12 }} accessibilityLiveRegion="polite">
                {formError}
              </Text>
            ) : null}

            <View style={s.formBtns}>
              <Pressable
                onPress={() => { setShowAdd(false); setFormError(''); }}
                accessibilityRole="button"
                style={[s.formBtn, { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border }]}
              >
                <Text style={{ fontSize: 14, color: c.text }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={addContact}
                disabled={!canSave}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSave }}
                style={[s.formBtn, { backgroundColor: canSave ? c.primary : c.border }]}
              >
                {saving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={{ fontSize: 14, fontWeight: '700', color: canSave ? c.textOnPrimary : c.textSec }}>
                    Save contact
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
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
  addBtn: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 10 },

  /* Body */
  body: { padding: 20, gap: 12, paddingBottom: 40 },

  /* Info banner */
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },

  /* Card */
  card: { borderRadius: 16, borderWidth: 1.5, overflow: 'hidden' },
  cardBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  cardFoot: { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  footBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  linkBtn: { minHeight: 44, justifyContent: 'center' },

  /* Empty slot */
  emptySlot: {
    height: 90,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  /* Add form */
  formCard: { borderRadius: 16, borderWidth: 2, padding: 16 },
  formInput: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  formBtns: { flexDirection: 'row', gap: 8 },
  formBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
