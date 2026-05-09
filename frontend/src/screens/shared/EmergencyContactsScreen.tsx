import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/BackButton';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Contact {
  id: string;
  name: string;
  phone: string;
  relation: string;
  isPrimary: boolean;
  verified: boolean;
}

const INITIAL: Contact[] = [
  { id: '1', name: 'Mom', phone: '+91 98765 43210', relation: 'Mother', isPrimary: true, verified: true },
  { id: '2', name: 'Dad', phone: '+91 87654 32109', relation: 'Father', isPrimary: false, verified: true },
  { id: '3', name: 'Rohan', phone: '+91 76543 21098', relation: 'Friend', isPrimary: false, verified: false },
];

export function EmergencyContactsScreen() {
  const navigation = useNavigation<Nav>();
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState<Contact[]>(INITIAL);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRelation, setNewRelation] = useState('');

  const addContact = () => {
    if (contacts.length >= 3) return;
    setContacts(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        name: newName,
        phone: `+91 ${newPhone}`,
        relation: newRelation,
        isPrimary: false,
        verified: false,
      },
    ]);
    setNewName('');
    setNewPhone('');
    setNewRelation('');
    setShowAdd(false);
  };

  const setPrimary = (id: string) => {
    setContacts(prev => prev.map(ct => ({ ...ct, isPrimary: ct.id === id })));
  };

  const remove = (id: string) => {
    setContacts(prev => prev.filter(ct => ct.id !== id));
  };

  const canSave = newName.trim() && newPhone.trim() && newRelation.trim();

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────── */}
      <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={s.flex1}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>Emergency Contacts</Text>
          <Text style={{ fontSize: 12, color: c.textSec }}>{contacts.length}/3 contacts</Text>
        </View>
        {contacts.length < 3 && (
          <Pressable onPress={() => setShowAdd(true)} style={[s.addBtn, { backgroundColor: c.primaryLight }]}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>+ Add</Text>
          </Pressable>
        )}
      </View>

      {/* ── Body ────────────────────────────────────────────── */}
      <ScrollView style={s.flex1} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {/* Info banner */}
        <View style={[s.infoBanner, { backgroundColor: c.errorLight }]}>
          <Svg width={16} height={16} viewBox="0 0 24 24" style={{ marginTop: 2 }}>
            <Path
              d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"
              fill={c.error}
            />
          </Svg>
          <Text style={{ fontSize: 12, color: c.error, lineHeight: 17, flex: 1 }}>
            These contacts will be{' '}
            <Text style={{ fontWeight: '700' }}>immediately notified</Text> with your live location
            when SOS is activated. Add up to 3 trusted contacts.
          </Text>
        </View>

        {/* Contacts */}
        {contacts.map(contact => (
          <View
            key={contact.id}
            style={[
              s.card,
              {
                backgroundColor: c.surface,
                borderColor: contact.isPrimary ? c.primary : c.border,
              },
            ]}
          >
            {contact.isPrimary && (
              <View style={[s.primaryTag, { backgroundColor: c.primaryLight }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: c.primary }}>PRIMARY CONTACT</Text>
              </View>
            )}

            <View style={s.cardBody}>
              {/* Icon */}
              <View
                style={[
                  s.iconBox,
                  { backgroundColor: contact.isPrimary ? c.primaryLight : c.bg },
                ]}
              >
                <Text style={{ fontSize: 26 }}>👤</Text>
              </View>

              {/* Info */}
              <View style={s.flex1}>
                <View style={s.nameRow}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{contact.name}</Text>
                  {contact.verified ? (
                    <Svg width={16} height={16} viewBox="0 0 24 24">
                      <Path
                        d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"
                        fill={c.success}
                      />
                    </Svg>
                  ) : (
                    <View style={[s.unverifiedBadge, { backgroundColor: c.warningLight }]}>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: c.warning }}>Unverified</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 13, color: c.textSec }}>{contact.relation}</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: c.text, marginTop: 2 }}>
                  {contact.phone}
                </Text>

                {/* Actions */}
                <View style={s.actionsRow}>
                  {!contact.isPrimary && (
                    <Pressable
                      onPress={() => setPrimary(contact.id)}
                      style={[s.actionBtn, { backgroundColor: c.primaryLight }]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: c.primary }}>Set Primary</Text>
                    </Pressable>
                  )}
                  {!contact.verified && (
                    <Pressable style={[s.actionBtn, { backgroundColor: c.warningLight }]}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: c.warning }}>Verify</Text>
                    </Pressable>
                  )}
                  <View style={s.flex1} />
                  <Pressable
                    onPress={() => remove(contact.id)}
                    style={[s.actionBtn, { backgroundColor: c.errorLight }]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: c.error }}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        ))}

        {/* Empty slot */}
        {contacts.length < 3 && (
          <Pressable
            onPress={() => setShowAdd(true)}
            style={[s.emptySlot, { borderColor: c.border }]}
          >
            <Svg width={24} height={24} viewBox="0 0 24 24">
              <Path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill={c.textSec} />
            </Svg>
            <Text style={{ fontSize: 14, color: c.textSec }}>Add Emergency Contact</Text>
            <Text style={{ fontSize: 12, color: c.textSec }}>{contacts.length}/3 added</Text>
          </Pressable>
        )}

        {/* Add form */}
        {showAdd && (
          <View style={[s.formCard, { backgroundColor: c.surface, borderColor: c.primary }]}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 14 }}>
              New Emergency Contact
            </Text>

            {[
              { label: 'NAME', value: newName, setter: setNewName, placeholder: 'e.g. Priya', kb: 'default' as const },
              { label: 'MOBILE NUMBER', value: newPhone, setter: setNewPhone, placeholder: '98765 43210', kb: 'phone-pad' as const },
              { label: 'RELATION', value: newRelation, setter: setNewRelation, placeholder: 'e.g. Sister', kb: 'default' as const },
            ].map(f => (
              <View key={f.label} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: c.textSec, marginBottom: 6 }}>
                  {f.label}
                </Text>
                <TextInput
                  value={f.value}
                  onChangeText={f.setter}
                  placeholder={f.placeholder}
                  placeholderTextColor={c.textSec}
                  keyboardType={f.kb}
                  style={[
                    s.formInput,
                    { backgroundColor: c.bg, borderColor: c.border, color: c.text },
                  ]}
                />
              </View>
            ))}

            <View style={s.formBtns}>
              <Pressable
                onPress={() => setShowAdd(false)}
                style={[s.formBtn, { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border }]}
              >
                <Text style={{ fontSize: 14, color: c.textSec }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={addContact}
                disabled={!canSave}
                style={[s.formBtn, { backgroundColor: canSave ? c.primary : c.border }]}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: 'white' }}>Add Contact</Text>
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
  addBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 10 },

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
  primaryTag: { paddingVertical: 6, paddingHorizontal: 14 },
  cardBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  unverifiedBadge: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: 20 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },

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
    height: 44,
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
