// Typed via ts-jest rather than `import type { Config } from 'jest'`.
// In this npm workspace the `jest` package is hoisted to the repo root while
// `@types/jest` stays in backend/node_modules, so resolving 'jest' from here
// finds the global-only @types/jest first and fails with TS2306.
import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
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
    coverageThreshold: {
        global: {
            branches: 90,
            functions: 90,
            lines: 90,
            statements: 90,
        },
    },
};

export default config;
