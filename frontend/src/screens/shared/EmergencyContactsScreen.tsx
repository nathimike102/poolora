import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { ActivityIndicator, Switch } from '../../components/Themed';
import { Text, TextInput } from '../../components/Text';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Icon } from '../../components/Icon';
import { safetyService, type EmergencyContact } from '../../services/safetyService';
import { errorHandler } from '../../utils/errorHandler';
import { REGION, toE164 } from '../../utils/region';
import { displayPhone } from '../../utils/phone';
import { useTranslation } from 'react-i18next';
import { tc, tk } from '../../theme/themed';


const MAX_CONTACTS = 3;


export function EmergencyContactsScreen() {
  const { t } = useTranslation();
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
      Alert.alert(t('emergencyContacts.notSaved'), t('emergencyContacts.yourEmergencyContactsCouldNot'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const addContact = async () => {
    const phone = toE164(newPhone);
    if (!phone) {
      setFormError(t('emergencyContacts.badNumber', { example: REGION.phonePlaceholder }));
      return;
    }
    if (contacts?.some(ct => ct.phone === phone)) {
      setFormError(t('emergencyContacts.duplicate'));
      return;
    }
    const email = newEmail.trim();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      setFormError(t('emergencyContacts.badEmail'));
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
      Alert.alert(t('emergencyContacts.textSent'), `${contact.name} will get a text with a link to confirm. We'll let you know when they do.`);
      load();
    } catch (error) {
      Alert.alert(t('emergencyContacts.notSent'), errorHandler.process(error).message);
    } finally {
      setVerifying(null);
    }
  };

  const remove = (contact: EmergencyContact) => {
    Alert.alert(t('emergencyContacts.removeContact'), `${contact.name} will no longer be alerted if you raise an SOS.`, [
      { text: t('emergencyContacts.cancel'), style: 'cancel' },
      {
        text: t('emergencyContacts.remove'),
        style: 'destructive',
        onPress: () => save((contacts ?? []).filter(ct => ct.phone !== contact.phone)),
      },
    ]);
  };

  const count = contacts?.length ?? 0;
  const canSave = Boolean(newName.trim() && newPhone.trim() && newRelation.trim()) && !saving;

  return (
    <View style={[s.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      {/* ── Header ──────────────────────────────────────────── */}
      <ScreenHeader
        title={t('emergencyContacts.emergencyContacts')}
        subtitle={t('emergencyContacts.countAdded', { count, max: MAX_CONTACTS })}
        right={contacts && count < MAX_CONTACTS && !showAdd ? (
          <Pressable
            onPress={() => setShowAdd(true)}
            accessibilityRole="button"
            accessibilityLabel={t('emergencyContacts.addEmergencyContact')}
            style={[s.addBtn, tc.backgroundColor_primaryLight]}
          >
            <Text style={[{ fontSize: 13, fontWeight: '600' }, tc.color_primary]}>{t('emergencyContacts.add')}</Text>
          </Pressable>
        ) : null}
      />

      {/* ── Body ────────────────────────────────────────────── */}
      <ScrollView
        style={s.flex1}
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[s.infoBanner, tc.backgroundColor_errorLight]}>
          <Icon name="shield-alert" size={16} color={tk.error} />
          <Text style={[{ fontSize: 13, lineHeight: 18, flex: 1 }, tc.color_text]}>
            {t('emergencyContacts.intro', { max: MAX_CONTACTS })}
          </Text>
        </View>

        {loadError && (
          <Pressable onPress={load} accessibilityRole="button" style={[
            s.card,
            s.cardBody,
            tc.backgroundColor_surfaceVariant,
            tc.borderColor_surfaceVariant
          ]}>
            <Text style={[{ flex: 1, fontSize: 14 }, tc.color_text]}>
              {t('emergencyContacts.yourContactsCouldNotBe')}
            </Text>
          </Pressable>
        )}

        {contacts === null && !loadError && <ActivityIndicator color={tk.primary} style={{ padding: 20 }} />}

        {contacts?.map(contact => (
          <View key={contact.phone} style={[s.card, tc.backgroundColor_surfaceVariant, tc.borderColor_surfaceVariant]}>
            <View style={s.cardBody}>
              <View style={[s.iconBox, tc.backgroundColor_primaryLight]}>
                <Icon name="account" size={26} color={tk.primary} />
              </View>
              <View style={s.flex1}>
                <Text style={[{ fontSize: 15, fontWeight: '700' }, tc.color_text]}>{contact.name}</Text>
                <Text style={[{ fontSize: 13 }, tc.color_textSec]}>{contact.relation}</Text>
                <Text style={[{ fontSize: 14, fontWeight: '600', marginTop: 2 }, tc.color_text]}>
                  {displayPhone(contact.phone) ?? contact.phone}
                </Text>
                {contact.email ? <Text style={[{ fontSize: 13 }, tc.color_textSec]}>{contact.email}</Text> : null}
                <View style={s.tags}>
                  {contact.primary ? (
                    <View style={[s.tag, tc.backgroundColor_primaryLight]}>
                      <Text style={[{ fontSize: 12, fontWeight: '700' }, tc.color_primary]}>{t('emergencyContacts.primary')}</Text>
                    </View>
                  ) : null}
                  <View style={[s.tag, contact.verified ? tc.backgroundColor_successLight : tc.backgroundColor_surfaceVariant]}>
                    <Icon name={contact.verified ? 'check-decagram' : 'help-circle-outline'} size={14} color={contact.verified ? tk.success : tk.textSec} />
                    <Text style={[{ fontSize: 12, fontWeight: '600' }, tc.color_text]}>{contact.verified ? t('emergencyContacts.confirmed') : t('emergencyContacts.notConfirmed')}</Text>
                  </View>
                </View>
              </View>
              <Pressable
                onPress={() => remove(contact)}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={t('emergencyContacts.removeName', { name: contact.name })}
                style={[s.actionBtn, tc.backgroundColor_errorLight]}
              >
                <Text style={[{ fontSize: 13, fontWeight: '600' }, tc.color_error]}>{t('emergencyContacts.remove')}</Text>
              </Pressable>
            </View>
            <View style={[s.cardFoot, tc.borderTopColor_border]}>
              <View style={s.switchRow}>
                <Text style={[{ flex: 1, fontSize: 14 }, tc.color_text]}>{t('emergencyContacts.getsMySosText')}</Text>
                <Switch
                  value={contact.notifyOnSos !== false}
                  onValueChange={on => { void update(contact, { notifyOnSos: on }); }}
                  disabled={saving}
                  accessibilityLabel={`${contact.name} gets my SOS text`}
                  trackColor={{ false: tk.border, true: tk.primary }}
                />
              </View>
              <View style={s.footBtns}>
                {!contact.primary && (
                  <Pressable onPress={() => update(contact, { primary: true })} disabled={saving} accessibilityRole="button" style={s.linkBtn}>
                    <Text style={[{ fontSize: 14, fontWeight: '600' }, tc.color_primary]}>{t('emergencyContacts.makePrimary')}</Text>
                  </Pressable>
                )}
                {!contact.verified && contact._id && (
                  <Pressable
                    onPress={() => verify(contact)}
                    disabled={verifying !== null}
                    accessibilityRole="button"
                    accessibilityLabel={t('emergencyContacts.askConfirm', { name: contact.name })}
                    style={s.linkBtn}
                  >
                    {verifying === contact._id ? <ActivityIndicator color={tk.primary} /> : (
                      <Text style={[{ fontSize: 14, fontWeight: '600' }, tc.color_primary]}>
                        {contact.verificationSentAt ? t('emergencyContacts.sendTheTextAgain') : t('emergencyContacts.askThemToConfirm')}
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        ))}

        {contacts && count > 0 && contacts.every(ct => ct.notifyOnSos === false) && (
          <Text style={[{ fontSize: 13 }, tc.color_error]} accessibilityLiveRegion="polite">
            {t('emergencyContacts.nobodyWillGetAText')}
          </Text>
        )}

        {contacts && count === 0 && !showAdd && (
          <Pressable
            onPress={() => setShowAdd(true)}
            accessibilityRole="button"
            style={[s.emptySlot, tc.borderColor_border]}
          >
            <Icon name="plus" size={24} color={tk.textSec} />
            <Text style={[{ fontSize: 14 }, tc.color_textSec]}>{t('emergencyContacts.addYourFirstEmergencyContact')}</Text>
          </Pressable>
        )}

        {showAdd && (
          <View style={[s.formCard, tc.backgroundColor_surfaceVariant, tc.borderColor_primary]}>
            <Text style={[{ fontSize: 15, fontWeight: '700', marginBottom: 14 }, tc.color_text]}>
              {t('emergencyContacts.newEmergencyContact')}
            </Text>

            {[
              { label: t('emergencyContacts.fields.name'), value: newName, setter: setNewName, placeholder: t('emergencyContacts.fields.namePlaceholder'), kb: 'default' as const, ac: 'name' as const },
              { label: t('emergencyContacts.fields.phone'), value: newPhone, setter: setNewPhone, placeholder: REGION.phonePlaceholder, kb: 'phone-pad' as const, ac: 'tel' as const },
              { label: t('emergencyContacts.fields.relation'), value: newRelation, setter: setNewRelation, placeholder: t('emergencyContacts.fields.relationPlaceholder'), kb: 'default' as const, ac: 'off' as const },
              { label: t('emergencyContacts.fields.email'), value: newEmail, setter: setNewEmail, placeholder: t('emergencyContacts.fields.emailPlaceholder'), kb: 'email-address' as const, ac: 'email' as const },
            ].map(f => (
              <View key={f.label} style={{ marginBottom: 12 }}>
                <Text style={[{ fontSize: 13, fontWeight: '600', marginBottom: 6 }, tc.color_textSec]}>
                  {f.label}
                </Text>
                <TextInput
                  value={f.value}
                  onChangeText={f.setter}
                  placeholder={f.placeholder}
                  placeholderTextColor={tk.textSec}
                  keyboardType={f.kb}
                  autoComplete={f.ac}
                  accessibilityLabel={f.label}
                  style={[
                    s.formInput,
                    tc.backgroundColor_surface,
                    tc.borderColor_border,
                    tc.color_text
                  ]}
                />
              </View>
            ))}

            {formError ? (
              <Text style={[{ fontSize: 13, marginBottom: 12 }, tc.color_error]} accessibilityLiveRegion="polite">
                {formError}
              </Text>
            ) : null}

            <View style={s.formBtns}>
              <Pressable
                onPress={() => { setShowAdd(false); setFormError(''); }}
                accessibilityRole="button"
                style={[s.formBtn, { borderWidth: 1 }, tc.backgroundColor_surface, tc.borderColor_border]}
              >
                <Text style={[{ fontSize: 14 }, tc.color_text]}>{t('emergencyContacts.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={addContact}
                disabled={!canSave}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSave }}
                style={[s.formBtn, canSave ? tc.backgroundColor_primary : tc.backgroundColor_border]}
              >
                {saving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={[{ fontSize: 14, fontWeight: '700' }, canSave ? tc.color_textOnPrimary : tc.color_textSec]}>
                    {t('emergencyContacts.saveContact')}
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
