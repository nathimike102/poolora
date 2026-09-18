import { tokenStorage } from '../tokenStorage';
import { TOKEN_STORAGE_KEYS } from '../../api/constants';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(undefined),
  multiGet: jest.fn(),
}));

describe('tokenStorage', () => {
  beforeEach(() => jest.clearAllMocks());

  test('save and get tokens via secure store', async () => {
    // SecureStore mocked to accept writes; get returns null so getTokens returns null
    await tokenStorage.saveTokens({ accessToken: 'a', refreshToken: 'r', expiresAt: 123 });
    const t = await tokenStorage.getTokens();
    // since getItemAsync mocked to return null, getTokens should return null
    expect(t).toBeNull();
  });

  test('clearTokens completes', async () => {
    await expect(tokenStorage.clearTokens()).resolves.toBeUndefined();
  });
});
