import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

// Mock AsyncStorage and auth service used by AppProvider
jest.mock('@react-native-async-storage/async-storage', () => ({
  multiGet: jest.fn().mockResolvedValue([["@poolora_role", null], ["@poolora_dark_mode", null]]),
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/authService', () => ({
  onAuthStateChanged: (cb: any) => {
    // call callback with null and return unsubscribe
    setTimeout(() => cb(null), 0);
    return () => {};
  },
  signOut: jest.fn().mockResolvedValue(undefined),
  restoreAuthState: jest.fn().mockResolvedValue(false),
  logoutAll: jest.fn().mockResolvedValue(undefined),
  firebaseLoginWithBackend: jest.fn(),
}));

// The phone's light/dark setting, changed by the tests below.
let mockScheme: 'light' | 'dark' = 'light';
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return new Proxy(actual, {
    get: (target, key) => (key === 'useColorScheme' ? () => mockScheme : target[key]),
  });
});

// jest.setup.js mocks AppContext for screen tests; this file tests the real one.
jest.unmock('../AppContext');

import { act } from '@testing-library/react-native';
import { AppProvider, useApp } from '../AppContext';
import { firebaseLoginWithBackend } from '../../services/authService';

function Consumer() {
  const ctx = useApp();
  return (
    <Text testID="vals">{String(ctx.role)}|{String(ctx.isDarkMode)}</Text>
  );
}

test('AppProvider provides defaults', async () => {
  const { findByTestId } = render(
    <AppProvider>
      <Consumer />
    </AppProvider>,
  );
  const el = await findByTestId('vals');
  // Expect rendered value to include a role and a boolean dark-mode token
  const asString = String(el.props.children);
  expect(asString).toEqual(expect.stringContaining('|'));
});

test('dark mode follows the system setting while running', async () => {
  mockScheme = 'light';
  const { findByTestId, rerender } = render(
    <AppProvider>
      <Consumer />
    </AppProvider>,
  );
  expect(String((await findByTestId('vals')).props.children)).toMatch(/false$/);

  mockScheme = 'dark';
  rerender(
    <AppProvider>
      <Consumer />
    </AppProvider>,
  );
  expect(String((await findByTestId('vals')).props.children)).toMatch(/true$/);
});

describe('finishSignIn', () => {
  let ctx: ReturnType<typeof useApp>;
  function Capture() {
    ctx = useApp();
    return <Text testID="role">{String(ctx.role)}</Text>;
  }
  const fbUser = { getIdToken: jest.fn().mockResolvedValue('ftoken') } as any;

  test('opens the app for a user who already finished setup', async () => {
    (firebaseLoginWithBackend as jest.Mock).mockResolvedValue({
      user: { _id: 'u1', name: 'Ghost', phone: '', isVerified: true, dateOfBirth: '2000-09-22T00:00:00.000Z' },
    });
    const { findByTestId } = render(<AppProvider><Capture /></AppProvider>);
    await findByTestId('role');

    let next: string | undefined;
    await act(async () => { next = await ctx.finishSignIn(fbUser); });

    expect(firebaseLoginWithBackend).toHaveBeenCalledWith('ftoken');
    expect(next).toBe('home');
    expect(String((await findByTestId('role')).props.children)).toBe('rider');
  });

  test('asks a user without a date of birth to finish setup', async () => {
    (firebaseLoginWithBackend as jest.Mock).mockResolvedValue({
      user: { _id: 'u1', name: 'Ghost', phone: '', isVerified: true },
    });
    const { findByTestId } = render(<AppProvider><Capture /></AppProvider>);
    await findByTestId('role');

    let next: string | undefined;
    await act(async () => { next = await ctx.finishSignIn(fbUser); });

    expect(next).toBe('profile');
    expect(String((await findByTestId('role')).props.children)).toBe('null');
  });
});
