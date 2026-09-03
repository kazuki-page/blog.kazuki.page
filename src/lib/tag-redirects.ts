import type { Tag } from '../data/tags';

export function tagRedirectLines(list: Tag[]): string[] {
  return list.flatMap((tag) =>
    tag.aliases.map((alias) => `/tags/${alias}/ /tags/${tag.slug}/ 301`),
  );
}
