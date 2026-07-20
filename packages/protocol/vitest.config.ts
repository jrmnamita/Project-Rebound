/**
 * Vitest configuration for the protocol package's colocated tests
 * (CODING_STANDARDS §2: non-sim-core package tests sit next to the
 * modules they guard). The alias maps the sim-core import to its
 * public surface, same as every other consumer.
 */
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@rebound/sim-core': fileURLToPath(
        new URL('../sim-core/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
