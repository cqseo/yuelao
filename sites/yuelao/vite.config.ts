import { fileURLToPath } from 'node:url';
import { cloudflare } from '@cloudflare/vite-plugin';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Builds write Paraglide output to their own dir, not src/paraglide: that one belongs to the dev server and typecheck.
const PARAGLIDE_BUILD = fileURLToPath(new URL('./node_modules/.paraglide', import.meta.url));

export default defineConfig(({ command }) => ({
  resolve: {
    alias: [
      ...(command === 'serve' ? [] : [{ find: /^~\/paraglide\//, replacement: `${PARAGLIDE_BUILD}/` }]),
      { find: '~', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
    ],
  },
  // Pin IPv4: when only ::1 is bound, browsers that go through a proxy or prefer IPv4 get refused on localhost.
  server: { host: '127.0.0.1', port: Number(process.env.PORT) || 5173, strictPort: true },
  preview: { host: '127.0.0.1', strictPort: true },
  plugins: [
    // i18n via Paraglide: zh-Hant is the base locale, zh-Hans ships too.
    // Unlike the shipwords template, production uses the full project (not an en-only
    // one) and the server runs the locale middleware in production as well.
    // TODO(P1): /hk/ path-prefix routing for Simplified (Hong Kong).
    paraglideVitePlugin(
      command === 'serve'
        ? { project: './project.inlang', outdir: './src/paraglide', strategy: ['cookie', 'baseLocale'] }
        : { project: './project.inlang', outdir: PARAGLIDE_BUILD, strategy: ['cookie', 'baseLocale'] },
    ),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
}));
