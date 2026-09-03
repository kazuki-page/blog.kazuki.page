import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPublishedPosts, postPath } from '../lib/posts';
import { renderRssMarkdown } from '../lib/rss-markdown';
import { RSS_LIMIT } from '../data/reserved-slugs';
import { tagName } from '../data/tags';

/**
 * 現行 WordPress に合わせて「最新 RSS_LIMIT 件・全文配信」。
 *
 * @astrojs/rss は Markdown を自動で HTML に変換しないため、
 * entry.body（生の Markdown）を自前でレンダリングして content に入れている。
 */
export async function GET(context: APIContext) {
  const posts = (await getPublishedPosts()).slice(0, RSS_LIMIT);

  return rss({
    title: 'blog.kazuki.page',
    description: '未来の自分に向けたログ。',
    site: context.site!,
    trailingSlash: true,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: postPath(post),
      categories: [post.data.category, ...post.data.tags.map(tagName)],
      content: renderRssMarkdown(post.body ?? ''),
    })),
  });
}
