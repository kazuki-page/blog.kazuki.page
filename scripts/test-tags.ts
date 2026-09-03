import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTagId, tagName, tagPath } from '../src/data/tags.ts';
import { tagRedirectLines } from '../src/lib/tag-redirects.ts';

test('旧表示名と新しい安定IDを同じIDへ読み替える', () => {
  assert.equal(resolveTagId('週次'), 'weekly');
  assert.equal(resolveTagId('weekly'), 'weekly');
  assert.equal(resolveTagId('存在しない'), null);
  assert.equal(tagName('weekly'), '週次');
  assert.equal(tagPath('weekly'), '/tags/weekly/');
});

test('旧タグURLを現行URLへの301として生成する', () => {
  assert.deepEqual(tagRedirectLines([{
    id: 'weekly', name: '週次', slug: 'weeks', aliases: ['weekly', 'week'], nameAliases: [],
  }]), [
    '/tags/weekly/ /tags/weeks/ 301',
    '/tags/week/ /tags/weeks/ 301',
  ]);
});
