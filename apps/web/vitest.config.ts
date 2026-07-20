/**
 * Vitest configuration for the web app's colocated presentation-math
 * tests (CODING_STANDARDS §2: app-package tests sit next to the
 * module they guard). Presentation math that CAN be pure — like the
 * camera — is tested headlessly here, same standard as sim-core.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
