import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { categoryNames } from './data/categories';
import { tagNames } from './data/tags';
import { RESERVED_SLUGS, SLUG_PATTERN } from './data/reserved-slugs';

const posts = defineCollection({
  // private リポジトリ (blog-content) の記事をここへ symlink / コピーする。
  // ファイル名がそのまま URL の slug になる（frontmatter の slug があればそちらが優先）。
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/posts',
  }),

  schema: z
    .object({
      title: z.string().min(1, 'title は必須です'),

      /** 任意。指定した場合はファイル名より優先して URL に使われる */
      slug: z
        .string()
        .regex(SLUG_PATTERN, 'slug は英小文字・数字・ハイフンのみ使えます')
        .refine((s) => !RESERVED_SLUGS.has(s), {
          message: 'この slug は予約語のため使えません',
        })
        .optional(),

      /** 公開日。JST として扱う（§4 参照） */
      date: z.coerce.date(),

      /** 更新日。任意 */
      updated: z.coerce.date().optional(),

      /** カテゴリは必ず 1 つ。マスタに無い名前はエラー */
      category: z.enum(categoryNames),

      /** タグは任意・複数可。マスタに無い名前はエラー */
      tags: z.array(z.enum(tagNames)).default([]),

      /** OGP / meta description 用 */
      description: z.string().min(1, 'description は必須です'),

      draft: z.boolean().default(false),

      /** 未指定なら共通 OGP 画像を使う */
      ogImage: z.string().optional(),
    })
    .refine((data) => !data.updated || data.updated >= data.date, {
      message: 'updated は date 以降の日付にしてください',
      path: ['updated'],
    }),
});

export const collections = { posts };
