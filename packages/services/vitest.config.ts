/**
 * Vitest configuration for the services package's colocated tests
 * (CODING_STANDARDS §2: non-sim-core package tests sit next to the
 * modules they guard). No aliases: services depends on nothing.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
