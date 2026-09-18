import { setAuthorizationHeader, getAuthorizationHeader, clearAuthorizationHeader } from '../axios';

describe('api/axios helpers', () => {
  afterEach(() => {
    clearAuthorizationHeader();
  });

  test('set/get/clear authorization header', () => {
    expect(getAuthorizationHeader()).toBeUndefined();
    setAuthorizationHeader('token123');
    expect(getAuthorizationHeader()).toBe('Bearer token123');
    clearAuthorizationHeader();
    expect(getAuthorizationHeader()).toBeUndefined();
  });
});
