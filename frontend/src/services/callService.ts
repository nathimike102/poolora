/**
 * Masked calls (UC-D06): Poolora rings you, then connects you to the other
 * person without either seeing the other's number. When calls through
 * Poolora are not set up on the server, the phone dials directly if the
 * number is known.
 */
import { Alert, Linking } from 'react-native';
import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import { errorHandler } from '../utils/errorHandler';
import i18n from '../i18n';

export async function callOnBooking(bookingId: string, name: string, directPhone?: string | null): Promise<void> {
  try {
    await apiClient.post(API_ENDPOINTS.calls.start, { bookingId });
    Alert.alert(i18n.t('calls.callingTitle'), i18n.t('calls.callingBody', { name }));
  } catch (e) {
    const id = (e as { response?: { data?: { error?: { id?: string } } } }).response?.data?.error?.id;
    if ((id === 'CALLS_UNAVAILABLE' || id === 'CALL_FAILED') && directPhone) {
      await Linking.openURL(`tel:${directPhone}`);
      return;
    }
    Alert.alert(i18n.t('calls.failed'), errorHandler.process(e).message);
  }
}
