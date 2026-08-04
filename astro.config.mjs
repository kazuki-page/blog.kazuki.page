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
      // 両方の配色を CSS 変数として埋め込み、global.css の
      // [data-theme='dark'] 側で切り替える
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      wrap: false,
    },
  },

  integrations: [sitemap()],
});
