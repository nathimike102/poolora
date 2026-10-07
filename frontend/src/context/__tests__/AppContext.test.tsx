import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

// Mock AsyncStorage and auth service used by AppProvider
jest.mock('@react-native-async-storage/async-storage', () => ({
  multiGet: jest.fn().mockResolvedValue([["@siham_role", null], ["@siham_dark_mode", null]]),
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

// jest.setup.js mocks AppContext for screen tests; this file tests the real one.
jest.unmock('../AppContext');

import { act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UnistylesRuntime } from 'react-native-unistyles';
import { AppProvider, useApp } from '../AppContext';
import { firebaseLoginWithBackend } from '../../services/authService';

function Consumer() {
  const ctx = useApp();
  return (
    <Text testID="vals">{String(ctx.role)}</Text>
  );
}

test('AppProvider provides defaults', async () => {
  const { findByTestId } = render(
    <AppProvider>
      <Consumer />
    </AppProvider>,
  );
  const el = await findByTestId('vals');
  // No role is chosen until one is restored or picked
  expect(String(el.props.children)).toBe('null');
});

// The theme lives in Unistyles (theme/unistyles); AppContext only pins it to
// the user's choice or hands it back to the phone's setting.
describe('dark mode', () => {
  const rt = UnistylesRuntime as unknown as { themeName: string; colorScheme: string };
  let setTheme: jest.SpyInstance;
  let setAdaptive: jest.SpyInstance;
  beforeEach(() => {
    setTheme = jest.spyOn(UnistylesRuntime, 'setTheme').mockImplementation(() => {});
    setAdaptive = jest.spyOn(UnistylesRuntime, 'setAdaptiveThemes').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  function Capture({ onCtx }: { onCtx: (c: ReturnType<typeof useApp>) => void }) {
    onCtx(useApp());
    return <Text testID="vals">x</Text>;
  }

  test('a saved choice pins the theme at start', async () => {
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValueOnce([['@siham_role', null], ['@siham_dark_mode', 'true']]);
    const { findByTestId } = render(<AppProvider><Capture onCtx={() => {}} /></AppProvider>);
    await findByTestId('vals');
    await act(async () => {});
    expect(setAdaptive).toHaveBeenCalledWith(false);
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  test('turning dark mode on in a light phone pins dark and saves it', async () => {
    Object.assign(rt, { themeName: 'light', colorScheme: 'light' });
    let ctx!: ReturnType<typeof useApp>;
    const { findByTestId } = render(<AppProvider><Capture onCtx={c => { ctx = c; }} /></AppProvider>);
    await findByTestId('vals');
    act(() => ctx.toggleDarkMode());
    expect(setAdaptive).toHaveBeenLastCalledWith(false);
    expect(setTheme).toHaveBeenLastCalledWith('dark');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@siham_dark_mode', 'true');
  });

  test('switching back to the phone\'s own setting follows the phone again', async () => {
    Object.assign(rt, { themeName: 'dark', colorScheme: 'light' });
    let ctx!: ReturnType<typeof useApp>;
    const { findByTestId } = render(<AppProvider><Capture onCtx={c => { ctx = c; }} /></AppProvider>);
    await findByTestId('vals');
    act(() => ctx.toggleDarkMode());
    expect(setAdaptive).toHaveBeenLastCalledWith(true);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@siham_dark_mode');
  });
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

test("logout removes the account's places and routes from the phone", async () => {
  const AsyncStorage = jest.requireMock('@react-native-async-storage/async-storage');
  let ctx!: ReturnType<typeof useApp>;
  function Capture() {
    ctx = useApp();
    return <Text testID="role">{String(ctx.role)}</Text>;
  }
  const { findByTestId } = render(<AppProvider><Capture /></AppProvider>);
  await findByTestId('role');

  await act(async () => { await ctx.logout(); });

  const removed = (AsyncStorage.removeItem as jest.Mock).mock.calls.map(([key]) => key);
  expect(removed).toEqual(expect.arrayContaining([
    '@siham_place_history',
    '@siham_saved_routes',
    '@siham_sos_contacts',
  ]));
});
