/**
 * 記事ごとの OGP 画像。ビルド時に /og/{slug}.png として書き出される。
 *
 * 背景は固定で、タイトルだけを載せる。
 * 折り返しと配置の規則は src/lib/ogp.ts を参照。
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getPublishedPosts, postSlug } from '../../lib/posts';
import { renderOgpImage } from '../../lib/ogp-render';

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getPublishedPosts();

  return posts.map((post) => ({
    params: { slug: postSlug(post) },
    props: { title: post.data.title },
  }));
};

export const GET: APIRoute = async ({ props }) => {
  const png = await renderOgpImage(props.title as string);

  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};
