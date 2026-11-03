import { defineConfig, loadEnv } from 'vite';

// base path для GitHub Pages задаётся через VITE_BASE_PATH (например "/coop-quest/").
// Локально по умолчанию "/".
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const base = env.VITE_BASE_PATH || '/';
  return {
    base,
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            phaser: ['phaser'],
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
    },
    server: { host: true, port: 5173 },
  };
});
