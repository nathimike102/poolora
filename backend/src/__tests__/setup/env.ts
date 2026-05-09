/**
 * Jest environment setup — sets all required env vars
 * before any module is imported.
 */
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/mobility-test';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(64);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(64);
process.env.RAZORPAY_KEY_ID = 'rzp_test_fake';
process.env.RAZORPAY_KEY_SECRET = 'fake_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'fake_webhook_secret';
process.env.PLATFORM_FEE_RATE = '0.15';
process.env.AUTH_PROVIDER = 'custom';
