/**
 * Vitest configuration for the determinism suite.
 *
 * The alias below maps '@rebound/sim-core' to the package's public
 * surface (its index.ts) so tests import the same contract every
 * other consumer uses — CODING_STANDARDS §8 forbids deep imports
 * into packages, and the test suite must not be the exception that
 * normalizes them.
 */
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@rebound/sim-core': fileURLToPath(
        new URL('../../packages/sim-core/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
