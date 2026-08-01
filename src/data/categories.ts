/**
 * カテゴリマスタ
 *
 * キー   = 記事の frontmatter に書く「表示名」
 * slug  = URL に使う英小文字スラッグ（/categories/{slug}/）
 *
 * ここに無いカテゴリが記事に現れたらビルドエラーになる（表記ゆれ検知のため）。
 * 記事は必ず 1 つだけカテゴリを持つ（複数不可）。
 */
export const categories = {
  blog: {
    slug: 'blog',
    description: '技術・生活・考えたことの記録。',
  },
  diary: {
    slug: 'diary',
    description: '定期的に書いている振り返り。',
  },
} as const;

export type CategoryName = keyof typeof categories;

/** zod の z.enum() に渡すためのタプル */
export const categoryNames = Object.keys(categories) as [CategoryName, ...CategoryName[]];

/** slug → 表示名 の逆引き */
export const categoryBySlug = Object.fromEntries(
  Object.entries(categories).map(([name, meta]) => [meta.slug, { name, ...meta }]),
) as Record<string, { name: CategoryName; slug: string; description: string }>;

export function categorySlug(name: CategoryName): string {
  return categories[name].slug;
}

export function categoryPath(name: CategoryName): string {
  return `/categories/${categories[name].slug}/`;
}
