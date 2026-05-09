import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: '.',
    testMatch: ['**/__tests__/**/*.test.ts'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    transform: {
        '^.+\\.ts$': ['ts-jest', {
            tsconfig: 'tsconfig.json',
            diagnostics: false,
        }],
    },
    clearMocks: true,
    // Run env setup BEFORE any module is imported (sets required env vars)
    setupFiles: ['./src/__tests__/setup/env.ts'],
    collectCoverageFrom: [
        'src/services/**/*.ts',
        'src/controllers/**/*.ts',
        '!src/**/*.d.ts',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov'],
    testTimeout: 30000,
};

export default config;
