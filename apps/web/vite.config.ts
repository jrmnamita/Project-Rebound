/**
 * Vite configuration for the web client.
 *
 * The README's promise is that `pnpm dev` always launches a fully
 * playable offline build with zero configuration — this file is where
 * that promise starts. PostCSS (Tailwind) is configured inline so the
 * repository carries one fewer root file than the classic setup
 * (FOLDER_STRUCTURE: nothing exists without purpose).
 */
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
});
