import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Real MySQL integration tests.
 *
 * These tests are intentionally excluded from `npm test`. Run them with
 * `npm run test:db` against a dedicated test database configured through
 * DB_TEST_* variables. They are skipped when no test database is configured,
 * so an ordinary unit-test run never touches MySQL.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    restoreMocks: true,
    clearMocks: true,
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
