/**
 * screens/admin/AdminVerificationsScreen.tsx
 *
 * Lets an admin review pending driver verifications: open each document and
 * approve or reject with a reason the driver will see.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  Linking,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { ActivityIndicator } from '../../components/Themed';
import { Text, TextInput } from '../../components/Text';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import { adminService, type AdminUser, type KycReview } from '../../services/adminService';
import { errorHandler } from '../../utils/errorHandler';
import { REGION } from '../../utils/region';
import { displayPhone } from '../../utils/phone';
import { tc, tk } from '../../theme/themed';

export function AdminVerificationsScreen() {
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
          'A driver can only be approved once their driving licence and vehicle registration book are uploaded. Reject with a reason so they can resubmit.',
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
        { label: 'Registration book', url: review.documents.registration },
        { label: 'Insurance', url: review.documents.insurance },
        ...review.documents.photos.map((url, i) => ({ label: `Vehicle photo ${i + 1}`, url })),
      ]
    : [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
      <ScreenHeader title="Driver verifications" />

      {pending === null && !loadError ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={tk.primary} />
      ) : (
        <FlatList
          data={pending ?? []}
          keyExtractor={u => u._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[{ textAlign: 'center', marginTop: 24 }, loadError ? tc.color_error : tc.color_textSec]}>
              {loadError ? 'Verifications could not be loaded.' : 'No verifications are waiting for review.'}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => open(item)}
              accessibilityRole="button"
              style={[
                styles.row,
                tc.backgroundColor_surfaceVariant,
                tc.borderColor_surfaceVariant
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[{ fontSize: 16, fontWeight: '700' }, tc.color_text]}>{item.name}</Text>
                <Text style={[{ fontSize: 13 }, tc.color_textSec]}>
                  {displayPhone(item.phone) ?? item.phone}
                  {item.kyc.submittedAt ? ` · Submitted ${new Date(item.kyc.submittedAt).toLocaleDateString(REGION.dateLocale)}` : ''}
                </Text>
              </View>
              <Text style={[{ fontSize: 14, fontWeight: '600' }, tc.color_primary]}>Review</Text>
            </Pressable>
          )}
        />
      )}

      <Modal visible={Boolean(selected)} animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={[styles.root, { paddingTop: insets.top }, tc.backgroundColor_surface]}>
          <ScreenHeader title={selected?.name ?? ''} onBack={() => setSelected(null)} />
          {!review ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={tk.primary} />
          ) : (
            <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
              <View style={[
                styles.card,
                tc.backgroundColor_surfaceVariant,
                tc.borderColor_surfaceVariant
              ]}>
                <Text style={[styles.label, tc.color_textSec]}>Licence number</Text>
                <Text style={[styles.value, tc.color_text]}>{review.licenseNumber ?? 'Not provided'}</Text>
                {review.vehicle && (
                  <>
                    <Text style={[styles.label, tc.color_textSec]}>Vehicle</Text>
                    <Text style={[styles.value, tc.color_text]}>
                      {review.vehicle.make} {review.vehicle.model} ({review.vehicle.year}), {review.vehicle.color}
                    </Text>
                    <Text style={[styles.value, tc.color_text]}>
                      {review.vehicle.plateNumber} · {review.vehicle.vehicleType}
                    </Text>
                  </>
                )}
              </View>

              <Text style={[{ fontSize: 13 }, tc.color_textSec]}>Document links expire after 5 minutes.</Text>
              {docLinks.map(doc => (
                <View key={doc.label} style={[
                  styles.card,
                  tc.backgroundColor_surfaceVariant,
                  tc.borderColor_surfaceVariant
                ]}>
                  <Text style={[styles.label, tc.color_textSec]}>{doc.label}</Text>
                  {doc.url ? (
                    <Pressable onPress={() => Linking.openURL(doc.url!)} accessibilityRole="link" accessibilityLabel={`Open ${doc.label}`}>
                      <Image source={{ uri: doc.url }} style={styles.docImage} resizeMode="contain" />
                      <Text style={[{ fontSize: 14, marginTop: 6 }, tc.color_primary]}>Open full size</Text>
                    </Pressable>
                  ) : (
                    <Text style={tc.color_error}>Missing</Text>
                  )}
                </View>
              ))}

              <Text style={[styles.label, tc.color_textSec]}>Reason (required to reject)</Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                multiline
                placeholder="For example, the registration book photo is blurred"
                placeholderTextColor={tk.textSec}
                accessibilityLabel="Rejection reason"
                style={[
                  styles.input,
                  tc.borderColor_surfaceVariant,
                  tc.color_text,
                  tc.backgroundColor_surfaceVariant
                ]}
              />
              <View style={styles.actions}>
                <Pressable
                  onPress={() => decide(false)}
                  disabled={acting}
                  accessibilityRole="button"
                  style={[styles.actionBtn, tc.backgroundColor_errorLight]}
                >
                  <Text style={[{ fontSize: 16, fontWeight: '700' }, tc.color_error]}>Reject</Text>
                </Pressable>
                <Pressable
                  onPress={() => decide(true)}
                  disabled={acting}
                  accessibilityRole="button"
                  style={[styles.actionBtn, tc.backgroundColor_primary]}
                >
                  {acting ? (
                    <ActivityIndicator color={tk.textOnPrimary} />
                  ) : (
                    <Text style={[{ fontSize: 16, fontWeight: '700' }, tc.color_textOnPrimary]}>Approve</Text>
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
