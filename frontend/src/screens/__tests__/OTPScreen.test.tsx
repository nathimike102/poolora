import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => {
  let _route = { params: { phone: '+911234567890', confirmation: { confirm: jest.fn().mockResolvedValue({}) } } };
  return {
    useNavigation: () => ({ navigate: jest.fn() }),
    useRoute: () => _route,
    // helper to update the mocked route during tests
    setRoute: (r: any) => { _route = r; },
  };
});

jest.mock('../../context/AppContext', () => ({ useApp: () => ({ c: { bg: '#fff', primary: '#00f', surface: '#eee', border: '#ccc', text: '#000', textSec: '#666', error: '#f00', primaryDark: '#00a' } }) }));

jest.mock('../../services/authService', () => ({
  confirmOtp: jest.fn().mockResolvedValue({}),
  verifyOtpWithBackend: jest.fn().mockResolvedValue({}),
}));

import { OTPScreen } from '../OTPScreen';
import { confirmOtp, verifyOtpWithBackend } from '../../services/authService';

describe('OTPScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  test('auto-verify when OTP filled', async () => {
    const { getAllByPlaceholderText } = render(<OTPScreen />);
    const inputs = getAllByPlaceholderText('•');
    // fill inputs
    inputs.forEach((input, idx) => {
      fireEvent.changeText(input, String((idx + 1) % 10));
    });

    await waitFor(() => expect(confirmOtp).toHaveBeenCalled());
    expect(verifyOtpWithBackend).toHaveBeenCalled();
  });

  test('shows alert when no confirmation', async () => {
    // Override the mocked route to have no confirmation using the mock's setter
    const nav = require('@react-navigation/native');
    nav.setRoute({ params: { phone: '+911234', confirmation: null } });
    const { getByText } = render(<OTPScreen />);
    const btn = getByText('Verify OTP');
    fireEvent.press(btn);
  });
});
