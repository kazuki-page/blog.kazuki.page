/**
 * カテゴリマスタ
 *
 * キー   = 記事の frontmatter に書く「表示名」
 * slug  = URL に使う英小文字スラッグ（/categories/{slug}/）
 *
 * ここに無いカテゴリが記事に現れたらビルドエラーになる（表記ゆれ検知のため）。
 * 記事は必ず 1 つだけカテゴリを持つ（複数不可）。
 *
 * description は任意。書くとカテゴリ一覧とカテゴリページに表示される。
 */
export const categories = {
  blog: { slug: 'blog' },
  diary: { slug: 'diary' },
} as const satisfies Record<string, { slug: string; description?: string }>;

export type CategoryName = keyof typeof categories;

/** zod の z.enum() に渡すためのタプル */
export const categoryNames = Object.keys(categories) as [CategoryName, ...CategoryName[]];

export function categorySlug(name: CategoryName): string {
  return categories[name].slug;
}

export function categoryPath(name: CategoryName): string {
  return `/categories/${categories[name].slug}/`;
}
