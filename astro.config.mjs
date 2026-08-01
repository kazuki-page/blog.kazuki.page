// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://blog.kazuki.page',

  // 現行 WordPress の URL に合わせて末尾スラッシュあり
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },

  // 「静か・装飾しない」方針に合わせて、コードブロックも明るい配色に揃える
  markdown: {
    shikiConfig: {
      theme: 'github-light',
      wrap: false,
    },
  },

  integrations: [sitemap()],
});
