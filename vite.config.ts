import { defineConfig, type ProxyOptions } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// In production /api/metar is the Vercel edge function in api/metar.ts; locally the dev and
// preview servers forward it to aviationweather.gov (no key) so the rain gate's METAR works too.
const metar: Record<string, ProxyOptions> = {
  '/api/metar': {
    target: 'https://aviationweather.gov',
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/api\/metar/, '/api/data/metar'),
  },
};

// The build is a single self-contained index.html so it can be published as one artifact page.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { target: 'es2022', assetsInlineLimit: 100_000_000 },
  server: { proxy: metar },
  preview: { proxy: metar },
});
