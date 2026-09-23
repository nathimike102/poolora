import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('../..//services/authService', () => ({
  signInWithGoogle: jest.fn(),
}));

const mockFinishSignIn = jest.fn();
jest.mock('../../context/AppContext', () => ({
  useApp: () => ({
    c: { bg: '#fff', primary: '#00f', surface: '#eee', border: '#ccc', text: '#000', textSec: '#666' },
    finishSignIn: mockFinishSignIn,
  }),
}));

import { LoginScreen } from '../LoginScreen';
import { signInWithGoogle } from '../../services/authService';

describe('LoginScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  test('sends a new user to profile setup', async () => {
    const mockUser = { user: { uid: 'u1' } };
    (signInWithGoogle as jest.Mock).mockResolvedValue(mockUser);
    mockFinishSignIn.mockResolvedValue('profile');

    const { getByText } = render(<LoginScreen />);
    fireEvent.press(getByText('Continue with Google'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('ProfileSetup'));
    expect(mockFinishSignIn).toHaveBeenCalledWith(mockUser.user);
  });

  test('lets a returning user straight into the app', async () => {
    (signInWithGoogle as jest.Mock).mockResolvedValue({ user: { uid: 'u1' } });
    mockFinishSignIn.mockResolvedValue('home');

    const { getByText } = render(<LoginScreen />);
    fireEvent.press(getByText('Continue with Google'));

    await waitFor(() => expect(mockFinishSignIn).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('does not show error when sign-in cancelled', async () => {
    (signInWithGoogle as jest.Mock).mockRejectedValue(new Error('Sign-in was cancelled.'));
    const { getByText } = render(<LoginScreen />);
    fireEvent.press(getByText('Continue with Google'));
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalled());
  });
});
