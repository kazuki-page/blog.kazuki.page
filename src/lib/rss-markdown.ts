import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';

// Web本文と同じく、段落内の単独改行を表示上の改行として扱う。
const parser = new MarkdownIt({ breaks: true });

export function renderRssMarkdown(markdown: string): string {
  return sanitizeHtml(parser.render(markdown), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title', 'width', 'height'],
    },
  });
}
