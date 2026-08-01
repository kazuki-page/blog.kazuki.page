import { getCollection, type CollectionEntry } from 'astro:content';
import { PAGE_SIZE } from '../data/reserved-slugs';

export type Post = CollectionEntry<'posts'>;

/**
 * 記事の URL slug。
 * frontmatter に slug があればそれを、無ければファイル名（= entry.id）を使う。
 */
export function postSlug(post: Post): string {
  return post.data.slug ?? post.id;
}

export function postPath(post: Post): string {
  return `/${postSlug(post)}/`;
}

/**
 * 公開記事を新しい順で返す。
 * 本番ビルドでは draft を除外し、開発時は表示する（執筆中の確認のため）。
 */
export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) =>
    import.meta.env.PROD ? data.draft !== true : true,
  );

  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export type Page<T> = {
  /** 1 始まり */
  page: number;
  totalPages: number;
  items: T[];
};

/** 配列を 1 ページ PAGE_SIZE 件ずつに分割する */
export function paginateItems<T>(items: T[], pageSize: number = PAGE_SIZE): Page<T>[] {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  return Array.from({ length: totalPages }, (_, i) => ({
    page: i + 1,
    totalPages,
    items: items.slice(i * pageSize, (i + 1) * pageSize),
  }));
}

/**
 * ページネーションの URL を組み立てる。
 * 1 ページ目は base そのもの、2 ページ目以降は base + "page/N/"。
 * 例: "/" → "/", "/page/2/" ／ "/tags/weekly/" → "/tags/weekly/", "/tags/weekly/page/2/"
 */
export function pageUrl(base: string, page: number): string {
  return page === 1 ? base : `${base}page/${page}/`;
}

/** JST 固定で YYYY-MM-DD に整形する */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(date);
}
