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

export async function callOnBooking(bookingId: string, name: string, directPhone?: string | null): Promise<void> {
  try {
    await apiClient.post(API_ENDPOINTS.calls.start, { bookingId });
    Alert.alert('Calling you now', `Answer the call from Poolora and we will connect you to ${name}. Your numbers stay private.`);
  } catch (e) {
    const id = (e as { response?: { data?: { error?: { id?: string } } } }).response?.data?.error?.id;
    if ((id === 'CALLS_UNAVAILABLE' || id === 'CALL_FAILED') && directPhone) {
      await Linking.openURL(`tel:${directPhone}`);
      return;
    }
    Alert.alert('Could not call', errorHandler.process(e).message);
  }
}
