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

import { AppProvider, useApp } from '../AppContext';

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
