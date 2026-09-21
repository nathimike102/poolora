/**
 * screens/admin/AdminVerificationsScreen.tsx
 *
 * Lets an admin review pending driver verifications: open each document and
 * approve or reject with a reason the driver will see.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';
import { BackButton } from '../../components/BackButton';
import { adminService, type AdminUser, type KycReview } from '../../services/adminService';
import { errorHandler } from '../../utils/errorHandler';

export function AdminVerificationsScreen() {
  const navigation = useNavigation();
  const { c } = useApp();
  const insets = useSafeAreaInsets();

  const [pending, setPending] = useState<AdminUser[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [review, setReview] = useState<KycReview | null>(null);
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminService.getUsers({ kycStatus: 'pending', limit: 50 });
      setPending(res.users);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const open = async (user: AdminUser) => {
    setSelected(user);
    setReview(null);
    setReason('');
    try {
      setReview(await adminService.getKycDocuments(user._id));
    } catch (error) {
      Alert.alert('Could not load documents', errorHandler.process(error).message);
      setSelected(null);
    }
  };

  const decide = async (approve: boolean) => {
    if (!selected) return;
    if (!approve && reason.trim().length < 5) {
      Alert.alert('Add a reason', 'Tell the driver what to fix so they can resubmit.');
      return;
    }
    if (approve) {
      if (!review?.documents.licence || !review.documents.registration) {
        Alert.alert(
          'Documents missing',
          'A driver can only be approved once their driving licence and registration certificate are uploaded. Reject with a reason so they can resubmit.',
        );
        return;
      }
      const confirmed = await new Promise<boolean>(resolve =>
        Alert.alert(
          `Approve ${selected.name}?`,
          'They will be able to offer rides to riders straight away.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Approve', onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        ),
      );
      if (!confirmed) return;
    }
    setActing(true);
    try {
      if (approve) await adminService.approveKyc(selected._id);
      else await adminService.rejectKyc(selected._id, reason.trim());
      setSelected(null);
      await load();
    } catch (error) {
      Alert.alert('Action failed', errorHandler.process(error).message);
    } finally {
      setActing(false);
    }
  };

  const docLinks: { label: string; url: string | null }[] = review
    ? [
        { label: 'Driving licence', url: review.documents.licence },
        { label: 'Registration certificate', url: review.documents.registration },
        { label: 'Insurance', url: review.documents.insurance },
        ...review.documents.photos.map((url, i) => ({ label: `Vehicle photo ${i + 1}`, url })),
      ]
    : [];

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">Driver verifications</Text>
      </View>

      {pending === null && !loadError ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={c.primary} />
      ) : (
        <FlatList
          data={pending ?? []}
          keyExtractor={u => u._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={{ color: loadError ? c.error : c.textSec, textAlign: 'center', marginTop: 24 }}>
              {loadError ? 'Verifications could not be loaded.' : 'No verifications are waiting for review.'}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => open(item)}
              accessibilityRole="button"
              style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>{item.name}</Text>
                <Text style={{ fontSize: 13, color: c.textSec }}>
                  {item.phone}
                  {item.kyc.submittedAt ? ` · Submitted ${new Date(item.kyc.submittedAt).toLocaleDateString()}` : ''}
                </Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.primary }}>Review</Text>
            </Pressable>
          )}
        />
      )}

      <Modal visible={Boolean(selected)} animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
          <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
            <BackButton onPress={() => setSelected(null)} />
            <Text style={[styles.headerTitle, { color: c.text }]} accessibilityRole="header">{selected?.name}</Text>
          </View>
          {!review ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={c.primary} />
          ) : (
            <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
              <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={[styles.label, { color: c.textSec }]}>Licence number</Text>
                <Text style={[styles.value, { color: c.text }]}>{review.licenseNumber ?? 'Not provided'}</Text>
                {review.vehicle && (
                  <>
                    <Text style={[styles.label, { color: c.textSec }]}>Vehicle</Text>
                    <Text style={[styles.value, { color: c.text }]}>
                      {review.vehicle.make} {review.vehicle.model} ({review.vehicle.year}), {review.vehicle.color}
                    </Text>
                    <Text style={[styles.value, { color: c.text }]}>
                      {review.vehicle.plateNumber} · {review.vehicle.vehicleType}
                    </Text>
                  </>
                )}
              </View>

              <Text style={{ fontSize: 13, color: c.textSec }}>Document links expire after 5 minutes.</Text>
              {docLinks.map(doc => (
                <View key={doc.label} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <Text style={[styles.label, { color: c.textSec }]}>{doc.label}</Text>
                  {doc.url ? (
                    <Pressable onPress={() => Linking.openURL(doc.url!)} accessibilityRole="link" accessibilityLabel={`Open ${doc.label}`}>
                      <Image source={{ uri: doc.url }} style={styles.docImage} resizeMode="contain" />
                      <Text style={{ fontSize: 14, color: c.primary, marginTop: 6 }}>Open full size</Text>
                    </Pressable>
                  ) : (
                    <Text style={{ color: c.error }}>Missing</Text>
                  )}
                </View>
              ))}

              <Text style={[styles.label, { color: c.textSec }]}>Reason (required to reject)</Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                multiline
                placeholder="For example, the registration certificate photo is blurred"
                placeholderTextColor={c.textSec}
                accessibilityLabel="Rejection reason"
                style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
              />
              <View style={styles.actions}>
                <Pressable
                  onPress={() => decide(false)}
                  disabled={acting}
                  accessibilityRole="button"
                  style={[styles.actionBtn, { backgroundColor: c.errorLight }]}
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: c.error }}>Reject</Text>
                </Pressable>
                <Pressable
                  onPress={() => decide(true)}
                  disabled={acting}
                  accessibilityRole="button"
                  style={[styles.actionBtn, { backgroundColor: c.primary }]}
                >
                  {acting ? (
                    <ActivityIndicator color={c.textOnPrimary} />
                  ) : (
                    <Text style={{ fontSize: 16, fontWeight: '700', color: c.textOnPrimary }}>Approve</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1 },
  list: { padding: 16, gap: 12, paddingBottom: 48 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 12, borderWidth: 1, minHeight: 64 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 6 },
  value: { fontSize: 15, marginTop: 2 },
  docImage: { width: '100%', height: 220, borderRadius: 8, marginTop: 6 },
  input: { minHeight: 80, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
