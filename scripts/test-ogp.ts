import assert from 'node:assert/strict';
import test from 'node:test';
import { layoutTitle } from '../src/lib/ogp.ts';

test('Weekly の日付範囲後にタイトルが 1 文字だけ残る場合は次の行へ送る', () => {
  const layout = layoutTitle('Weekly 2026/08/31〜09/06：落ち着きを取り戻す');

  assert.deepEqual(layout.lines, ['Weekly 2026/08/31〜09/06：', '落ち着きを取り戻す']);
});

test('Weekly 以外のタイトルには専用の折り返しを適用しない', () => {
  const layout = layoutTitle('Monthly 2026/08/31〜09/06：落ち着きを取り戻す');

  assert.deepEqual(layout.lines, ['Monthly 2026/08/31〜09/06：落', 'ち着きを取り戻す']);
});
