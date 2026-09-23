import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { phone: '9876543210' } }),
}));

const mockSetUser = jest.fn();
const mockSetRole = jest.fn();
jest.mock('../../context/AppContext', () => ({
  useApp: () => ({
    c: { bg: '#fff', primary: '#00f', surface: '#eee', border: '#ccc', text: '#000', textSec: '#666', error: '#f00', primaryDark: '#00a' },
    setUser: mockSetUser,
    setRole: mockSetRole,
  }),
}));

jest.mock('../../services/authService', () => ({
  sendOtpToBackend: jest.fn().mockResolvedValue(undefined),
  verifyOtpWithBackend: jest.fn(),
}));

import { OTPScreen } from '../OTPScreen';
import { verifyOtpWithBackend } from '../../services/authService';

const mockVerify = verifyOtpWithBackend as jest.Mock;

function enterCode(getAllByPlaceholderText: (text: string) => unknown[]) {
  getAllByPlaceholderText('•').forEach((input, idx) => {
    fireEvent.changeText(input as never, String((idx + 1) % 10));
  });
}

describe('OTPScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  test('verifies the code with the backend using the full number', async () => {
    mockVerify.mockResolvedValue({ user: { _id: 'u1', name: '', phone: '+919876543210', capabilities: ['rider'], isVerified: true }, isNewUser: true });
    const { getAllByPlaceholderText } = render(<OTPScreen />);
    enterCode(getAllByPlaceholderText);

    await waitFor(() => expect(mockVerify).toHaveBeenCalledWith('+919876543210', '123456'));
    expect(mockNavigate).toHaveBeenCalledWith('ProfileSetup');
  });

  test('sends a returning driver straight into the app', async () => {
    mockVerify.mockResolvedValue({ user: { _id: 'u2', name: 'Arjun Sharma', phone: '+919876543210', capabilities: ['driver', 'rider'], isVerified: true }, isNewUser: false });
    const { getAllByPlaceholderText } = render(<OTPScreen />);
    enterCode(getAllByPlaceholderText);

    await waitFor(() => expect(mockSetRole).toHaveBeenCalledWith('driver'));
    expect(mockSetUser).toHaveBeenCalledWith(expect.objectContaining({ id: 'u2', name: 'Arjun Sharma' }));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('shows the backend error when the code is wrong', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockVerify.mockRejectedValue(new Error('Invalid OTP'));
    const { getAllByPlaceholderText } = render(<OTPScreen />);
    enterCode(getAllByPlaceholderText);

    await waitFor(() => expect(alert).toHaveBeenCalledWith('Verification Failed', 'Invalid OTP'));
    expect(mockSetRole).not.toHaveBeenCalled();
  });
});
