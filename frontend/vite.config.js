import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'sync-dist-to-root',
      closeBundle() {
        try {
          const src = path.resolve(__dirname, 'dist');
          const dest = path.resolve(__dirname, '../dist');
          if (src !== dest && fs.existsSync(src)) {
            fs.cpSync(src, dest, { recursive: true });
          }
        } catch (err) {
          console.warn('sync-dist warning:', err.message);
        }
      },
    },
  ],
  server: {
    port: 5173,
  },
});
