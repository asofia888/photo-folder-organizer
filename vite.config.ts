import { readFileSync } from 'fs';
import path from 'path';
import { defineConfig } from 'vite';

interface VercelConfig {
  headers?: { source: string; headers: { key: string; value: string }[] }[];
}

// Security headers (CSP, framing, referrer) are defined once, in vercel.json,
// and served by Vercel in production. The CSP enforces the app's promise that
// photos never leave the browser: scripts, workers and requests may only reach
// this origin (plus the Google Fonts stylesheet and fonts), and other sites
// can't frame the app. `vite preview` serves the same headers so a local
// production build runs under the real policy. The dev server doesn't: it
// relies on inline scripts and a websocket for hot reload.
const productionHeaders = (): Record<string, string> => {
  const config: VercelConfig = JSON.parse(readFileSync(path.resolve(__dirname, 'vercel.json'), 'utf8'));
  const rule = config.headers?.find(entry => entry.source === '/(.*)');
  return Object.fromEntries((rule?.headers ?? []).map(({ key, value }) => [key, value]));
};

export default defineConfig({
  preview: {
    headers: productionHeaders(),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
