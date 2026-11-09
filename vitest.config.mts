import { defineConfig } from 'vitest/config';

/**
 * Explicit test discovery: every `*.test.ts` / `*.spec.ts` under `src/` runs in CI.
 * Core tests are environment-agnostic, so the default Node environment is used (no jsdom).
 */
export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'node',
    passWithNoTests: false,
  },
});
