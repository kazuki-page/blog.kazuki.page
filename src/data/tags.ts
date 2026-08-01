/**
 * タグマスタ
 *
 * キー   = 記事の frontmatter に書く「表示名（日本語）」
 * slug  = URL に使う英小文字スラッグ（/tags/{slug}/）
 *
 * ここに無いタグが記事に現れたらビルドエラーになる（表記ゆれ検知のため）。
 *
 * ⚠️ 現在の中身は仮。WordPress からのエクスポート後に実データから再生成する。
 */
export const tags = {
  '週次': { slug: 'weekly', description: '週ごとの振り返り。' },
  '月次': { slug: 'monthly', description: '月ごとの振り返り。' },
  '年次': { slug: 'yearly', description: '年ごとの振り返り。' },
  '3年': { slug: '3year', description: '3年単位の振り返り。' },
} as const;

export type TagName = keyof typeof tags;

/** zod の z.enum() に渡すためのタプル */
export const tagNames = Object.keys(tags) as [TagName, ...TagName[]];

/** slug → 表示名 の逆引き */
export const tagBySlug = Object.fromEntries(
  Object.entries(tags).map(([name, meta]) => [meta.slug, { name, ...meta }]),
) as Record<string, { name: TagName; slug: string; description: string }>;

export function tagSlug(name: TagName): string {
  return tags[name].slug;
}

export function tagPath(name: TagName): string {
  return `/tags/${tags[name].slug}/`;
}
