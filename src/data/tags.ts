/**
 * ブログタグの読み取り口。
 *
 * 本番ビルドでは blog-content の `taxonomy/tags.json` がこの隣へコピーされる。
 * JSON は leaves の D1 が正で、ここは検証・表示・URL生成を同じ定義へ集める。
 * 既存記事は表示名、新しい記事は安定IDを frontmatter に持つため、双方をIDへ
 * 読み替えて段階移行する。
 */
import source from './blog-tags.json' with { type: 'json' };

export type Tag = {
  id: string;
  name: string;
  slug: string;
  aliases: string[];
  nameAliases?: string[];
  description?: string;
};
type Taxonomy = { version: 1; revision: number; updatedAt: string; tags: Tag[] };

const raw = source as Taxonomy;

if (raw.version !== 1 || !Number.isInteger(raw.revision) || !Array.isArray(raw.tags)) {
  throw new Error('blog-tags.json の形式が不正です');
}

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ids = new Set<string>();
const names = new Set<string>();
const paths = new Set<string>();
for (const tag of raw.tags) {
  if (!slugPattern.test(tag.id) || !tag.name || !slugPattern.test(tag.slug)) {
    throw new Error(`blog-tags.json のタグ定義が不正です: ${tag.id || tag.name || '(空)'}`);
  }
  if (ids.has(tag.id)) throw new Error(`ブログタグIDが重複しています: ${tag.id}`);
  ids.add(tag.id);
  for (const name of [tag.name, ...(tag.nameAliases ?? [])]) {
    if (names.has(name)) throw new Error(`ブログタグ名が重複しています: ${name}`);
    names.add(name);
  }
  for (const path of [tag.slug, ...(tag.aliases ?? [])]) {
    if (!slugPattern.test(path)) throw new Error(`ブログタグURLが不正です: ${path}`);
    if (paths.has(path)) throw new Error(`ブログタグURLが重複しています: ${path}`);
    paths.add(path);
  }
}

export const taxonomy = raw;
export const tags = Object.fromEntries(raw.tags.map((tag) => [tag.id, tag])) as Record<string, Tag>;
export const tagIds = raw.tags.map((tag) => tag.id) as [string, ...string[]];

const idByName = new Map(raw.tags.flatMap((tag) =>
  [tag.name, ...(tag.nameAliases ?? [])].map((name) => [name, tag.id] as const),
));

export function resolveTagId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (value in tags) return value;
  return idByName.get(value) ?? null;
}

export function isKnownTag(value: unknown): value is string {
  return resolveTagId(value) !== null;
}

export function tagId(value: string): string {
  const id = resolveTagId(value);
  if (!id) throw new Error(`未知のブログタグです: ${value}`);
  return id;
}

export function tagName(id: string): string {
  return tags[id]?.name ?? id;
}

export function tagPath(id: string): string {
  const tag = tags[id];
  if (!tag) throw new Error(`未知のブログタグです: ${id}`);
  return `/tags/${tag.slug}/`;
}
