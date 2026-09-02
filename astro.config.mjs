// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  site: 'https://quoth.dev',
  redirects: { '/support': '/contact' },
  vite: {
    plugins: [tailwindcss()]
  },

  adapter: vercel()
});