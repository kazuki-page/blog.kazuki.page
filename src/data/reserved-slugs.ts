/**
 * 記事 slug として使えない予約語。
 *
 * 記事は `/{slug}/` としてルート直下に配置されるため、
 * 固定ページや特殊ファイルと名前空間を共有している。
 * ここに載っている名前の記事を作るとURLが衝突するので、ビルド時にエラーにする。
 */
export const RESERVED_SLUGS = new Set([
  'page',
  'tags',
  'categories',
  'category',
  'tag',
  'policy',
  'author',
  'about',
  'index',
  '404',
  'rss',
  'rss.xml',
  'feed',
  'sitemap',
  'sitemap-index',
  'sitemap-index.xml',
  'api',
  '_redirects',
  '_headers',
  '_astro',
]);

/** 記事 slug / ファイル名に許可する形式（英小文字・数字・ハイフンのみ） */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** 1ページあたりの記事数 */
export const PAGE_SIZE = 100;

/** RSS に載せる件数 */
export const RSS_LIMIT = 10;
