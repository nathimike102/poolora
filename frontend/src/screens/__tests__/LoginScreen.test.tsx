import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('../..//services/authService', () => ({
  signInWithGoogle: jest.fn(),
  firebaseLoginWithBackend: jest.fn(),
}));

jest.mock('../../context/AppContext', () => ({ useApp: () => ({ c: { bg: '#fff', primary: '#00f', surface: '#eee', border: '#ccc', text: '#000', textSec: '#666' } }) }));

import { LoginScreen } from '../LoginScreen';
import { signInWithGoogle, firebaseLoginWithBackend } from '../../services/authService';

describe('LoginScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  test('handles Google sign-in success path', async () => {
    // mock firebase user + token
    const mockUser = { user: { getIdToken: jest.fn().mockResolvedValue('ftoken') } };
    (signInWithGoogle as jest.Mock).mockResolvedValue(mockUser);
    (firebaseLoginWithBackend as jest.Mock).mockResolvedValue({});

    const { getByText } = render(<LoginScreen />);
    const btn = getByText('Continue with Google');
    fireEvent.press(btn);

    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalled());
    expect(firebaseLoginWithBackend).toHaveBeenCalledWith('ftoken');
  });

  test('does not show error when sign-in cancelled', async () => {
    (signInWithGoogle as jest.Mock).mockRejectedValue(new Error('Sign-in was cancelled.'));
    const { getByText } = render(<LoginScreen />);
    fireEvent.press(getByText('Continue with Google'));
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalled());
  });
});
