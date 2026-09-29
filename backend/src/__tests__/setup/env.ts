/**
 * Jest environment setup — sets all required env vars
 * before any module is imported.
 */
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/mobility-test';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(64);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(64);
process.env.PAYNOW_USD_INTEGRATION_ID = '1201';
process.env.PAYNOW_USD_INTEGRATION_KEY = 'usd-integration-key';
process.env.PAYNOW_ZWG_INTEGRATION_ID = '1202';
process.env.PAYNOW_ZWG_INTEGRATION_KEY = 'zwg-integration-key';
process.env.PAYNOW_AUTH_EMAIL = 'merchant@example.com';
process.env.ZWG_PER_USD = '26.5';
process.env.PLATFORM_FEE_RATE = '0.15';
process.env.AUTH_PROVIDER = 'custom';
