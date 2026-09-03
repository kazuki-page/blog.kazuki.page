import assert from 'node:assert/strict';
import test from 'node:test';
import { renderRssMarkdown } from '../src/lib/rss-markdown.ts';

test('段落内の単独改行をbrとして出力する', () => {
  assert.equal(renderRssMarkdown('1行目\n2行目'), '<p>1行目<br />\n2行目</p>\n');
});

test('空行は段落の区切りとして扱う', () => {
  assert.equal(renderRssMarkdown('段落1\n\n段落2'), '<p>段落1</p>\n<p>段落2</p>\n');
});

test('コードブロック内の改行にはbrを挿入しない', () => {
  assert.equal(
    renderRssMarkdown('```text\n1行目\n2行目\n```'),
    '<pre><code>1行目\n2行目\n</code></pre>\n',
  );
});
