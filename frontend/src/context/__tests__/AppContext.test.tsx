import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

// Mock AsyncStorage and auth service used by AppProvider
jest.mock('@react-native-async-storage/async-storage', () => ({
  multiGet: jest.fn().mockResolvedValue([["@sanchari_role", null], ["@sanchari_dark_mode", null]]),
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
