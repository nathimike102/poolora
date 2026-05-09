module.exports = {
  testEnvironment: 'jsdom',
  rootDir: '..',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  clearMocks: true,
  collectCoverageFrom: [
    'frontend-tester/app.js',
  ],
  coverageDirectory: 'coverage/frontend-tester',
  coverageReporters: ['text', 'lcov'],
  testTimeout: 30000,
};
