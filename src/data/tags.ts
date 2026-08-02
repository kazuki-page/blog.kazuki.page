/**
 * タグマスタ
 *
 * キー   = 記事の frontmatter に書く「表示名」
 * slug  = URL に使う英小文字スラッグ（/tags/{slug}/）
 *
 * ここに無いタグが記事に現れたらビルドエラーになる（表記ゆれ検知のため）。
 * WordPress から移行した際の定義をそのまま引き継いでいる。
 *
 * description は任意。書くとタグ一覧とタグページに表示される。
 */
export const tags = {
  '週次': { slug: 'weekly' }, // 140件
  '月次': { slug: 'monthly' }, // 15件
  '年次': { slug: 'yearly' }, // 3件
  'モノ・サービス': { slug: 'items-and-services' }, // 22件
  '配信': { slug: 'live-stream' }, // 19件
  'ブログについて': { slug: 'about-blog' }, // 18件
  'ゲーム': { slug: 'game' }, // 18件
  '自分へ': { slug: 'for-me' }, // 15件
  '弱音とか': { slug: 'whining' }, // 13件
  '設定': { slug: 'config' }, // 9件
  WordPress: { slug: 'wordpress' }, // 8件
  FF12: { slug: 'ff12' }, // 8件
  '創作活動': { slug: 'creation' }, // 7件
  'ノート': { slug: 'note' }, // 6件
  '読書録': { slug: 'reading' }, // 6件
  'ゲーム実況': { slug: 'gameplay' }, // 4件
  'つぶやき': { slug: 'tweet' }, // 4件
  '新鬼武者': { slug: 'onimusha-dawn-of-dreams' }, // 3件
} as const satisfies Record<string, { slug: string; description?: string }>;

export type TagName = keyof typeof tags;

/** zod の z.enum() に渡すためのタプル */
export const tagNames = Object.keys(tags) as [TagName, ...TagName[]];

export function tagSlug(name: TagName): string {
  return tags[name].slug;
}

export function tagPath(name: TagName): string {
  return `/tags/${tags[name].slug}/`;
}
