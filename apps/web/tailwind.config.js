/**
 * Tailwind configuration.
 *
 * Colors are NOT defined here: the visual identity lives in
 * src/theme.ts (one file to change when the identity/art-direction
 * pass lands — GDD §14 Q5, ARCHITECTURE §2.7 "identity starts from
 * zero"). Components consume theme.ts values via inline style for
 * identity colors and Tailwind utilities for layout.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
