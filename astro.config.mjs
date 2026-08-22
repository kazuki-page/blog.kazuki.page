// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import { defineMdastPlugin } from 'satteri';

/**
 * **単独の改行を、そのまま改行として出す。**
 *
 * Markdown の本来の決まりでは、行末に空白2つを置くか空行を挟まない限り
 * 1つの改行は空白に潰れる。ここに入るのは自分で書いたものなので、
 * その決まりを覚えている前提にしない。
 *
 * 入れる前に既存315件を数えた。段落の途中に単独の改行がある記事が80件、
 * そこに301本の改行が入っていて、**行の長さの中央値は26文字**だった。
 * 80桁で折り返した行ではなく、意図して切った改行しかない。
 * つまりこれは見た目を変える設定ではなく、**書いたとおりに出す**ための設定。
 *
 * remark-breaks は使えない。Astro 7 の既定の処理系は Sätteri で、
 * remark を挟むには @astrojs/markdown-remark を入れて処理系ごと
 * 差し替えることになる。**315件の見え方を全部賭ける変更**になるので、
 * 同じことを Sätteri 側の仕組みで書いた。
 *
 * code / inlineCode は text ではないので、ここを通らない。
 */
const softBreaks = defineMdastPlugin({
  name: 'soft-breaks',
  text(node, ctx) {
    if (!node.value.includes('\n')) return;
    const parts = [];
    node.value.split('\n').forEach((part, i) => {
      if (i) parts.push({ type: 'break' });
      if (part) parts.push({ type: 'text', value: part });
    });
    ctx.insertBefore(node, parts);
    ctx.removeNode(node);
  },
});

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
    processor: satteri({ mdastPlugins: [softBreaks] }),
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
