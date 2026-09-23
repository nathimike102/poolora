jest.mock('../../api/axios', () => ({
  apiClient: { post: jest.fn(), get: jest.fn() },
  setAuthorizationHeader: jest.fn(),
  clearAuthorizationHeader: jest.fn(),
}));

jest.mock('../../utils/tokenStorage', () => ({
  tokenStorage: {
    saveTokens: jest.fn(),
    saveUserId: jest.fn(),
    getRefreshToken: jest.fn(),
    getTokens: jest.fn(),
    clearTokens: jest.fn(),
    isTokenExpired: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('../../utils/jwt', () => ({ getJwtExpiresAtMs: jest.fn().mockReturnValue(undefined) }));

// Firebase's modular auth API: the service calls signOut(getAuth()).
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
  signOut: jest.fn().mockResolvedValue(undefined),
  onAuthStateChanged: jest.fn(),
  signInWithPhoneNumber: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  signInWithCredential: jest.fn(),
  updateProfile: jest.fn(),
  GoogleAuthProvider: { credential: jest.fn() },
}));

import { apiClient, setAuthorizationHeader, clearAuthorizationHeader } from '../../api/axios';
import { tokenStorage } from '../../utils/tokenStorage';
import { getJwtExpiresAtMs } from '../../utils/jwt';

import {
  verifyOtpWithBackend,
  refreshAccessToken,
  getCurrentUserFromBackend,
  logoutAll,
  restoreAuthState,
} from '../authService';

describe('authService (backend-integrated)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('verifyOtpWithBackend stores tokens and user id', async () => {
    const payload = { user: { _id: 'u1' }, accessToken: 'a', refreshToken: 'r', isNewUser: false };
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { data: payload } });
    const res = await verifyOtpWithBackend('+100', '123456');
    expect(tokenStorage.saveTokens).toHaveBeenCalled();
    expect(tokenStorage.saveUserId).toHaveBeenCalledWith('u1');
    expect(res).toMatchObject({ user: { _id: 'u1' } });
  });

  test('verifyOtpWithBackend stores nothing when a new phone still needs a profile', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { data: { needsProfile: true } } });
    const res = await verifyOtpWithBackend('+919000000001', '123456');
    expect(res).toEqual({ needsProfile: true });
    expect(tokenStorage.saveTokens).not.toHaveBeenCalled();
    expect(tokenStorage.saveUserId).not.toHaveBeenCalled();
  });

  test('refreshAccessToken refreshes and sets header', async () => {
    (tokenStorage.getRefreshToken as jest.Mock).mockResolvedValue('r');
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { data: { accessToken: 'newA', refreshToken: 'newR' } } });
    const out = await refreshAccessToken();
    expect(setAuthorizationHeader).toHaveBeenCalled();
    expect(out).toBe('newA');
  });

  test('refreshAccessToken throws when no refresh token', async () => {
    (tokenStorage.getRefreshToken as jest.Mock).mockResolvedValue(null);
    await expect(refreshAccessToken()).rejects.toThrow();
  });

  test('getCurrentUserFromBackend returns user and sets state', async () => {
    const user = { _id: 'u2', name: 'T' };
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: { user } } });
    const out = await getCurrentUserFromBackend();
    expect(out._id).toBe('u2');
  });

  test('logoutAll clears tokens and signs out', async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(new Error('no')); // backend logout fails
    await logoutAll();
    expect(tokenStorage.clearTokens).toHaveBeenCalled();
    // signOut is mocked; ensure no throw
  });

  test('restoreAuthState returns false when no tokens', async () => {
    (tokenStorage.getTokens as jest.Mock).mockResolvedValue(null);
    const res = await restoreAuthState();
    expect(res).toBe(false);
  });

  test('concurrent refreshes share one request (refresh tokens rotate)', async () => {
    (tokenStorage.getRefreshToken as jest.Mock).mockResolvedValue('refresh-1');
    let finish: (v: unknown) => void = () => {};
    (apiClient.post as jest.Mock).mockReset().mockReturnValue(
      new Promise(resolve => { finish = resolve; }),
    );

    const first = refreshAccessToken();
    const second = refreshAccessToken();
    await Promise.resolve();
    finish({ data: { data: { accessToken: 'access-2', refreshToken: 'refresh-2' } } });

    await expect(Promise.all([first, second])).resolves.toEqual(['access-2', 'access-2']);
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  test('logout refreshes an expired access token so the server revokes the session', async () => {
    (tokenStorage.isTokenExpired as jest.Mock).mockResolvedValueOnce(true);
    (tokenStorage.getRefreshToken as jest.Mock).mockResolvedValue('refresh-1');
    (apiClient.post as jest.Mock).mockReset()
      .mockResolvedValueOnce({ data: { data: { accessToken: 'access-2', refreshToken: 'refresh-2' } } })
      .mockResolvedValueOnce({ data: {} });

    await logoutAll();

    const paths = (apiClient.post as jest.Mock).mock.calls.map(([path]) => path);
    expect(paths).toEqual(['/auth/refresh-token', '/auth/logout']);
    expect(setAuthorizationHeader).toHaveBeenCalledWith('access-2');
    expect(tokenStorage.clearTokens).toHaveBeenCalled();
  });
});
