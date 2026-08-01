/**
 * 記事の事前バリデーション。
 *
 * Content Collections の zod スキーマ（src/content.config.ts）は
 * 「1 記事の frontmatter が正しいか」しか検証できない。
 * このスクリプトはそこで見られない以下を担当する:
 *
 *   - ファイル名そのものの形式（zod は frontmatter しか見ない）
 *   - ファイル名由来の slug が予約語と衝突していないか
 *   - 記事をまたいだ slug の重複
 *   - 本文に混入した Obsidian 記法 / WordPress の残骸
 *
 * `npm run build` の前段で実行され、エラーがあれば非ゼロで終了する。
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';

import { RESERVED_SLUGS, SLUG_PATTERN } from '../src/data/reserved-slugs.ts';
import { categories } from '../src/data/categories.ts';
import { tags } from '../src/data/tags.ts';

const POSTS_DIR = 'src/content/posts';
const DESCRIPTION_MAX = 160;

type Issue = { file: string; message: string };

const errors: Issue[] = [];
const warnings: Issue[] = [];

const error = (file: string, message: string) => errors.push({ file, message });
const warn = (file: string, message: string) => warnings.push({ file, message });

/**
 * 本文からコードを取り除く。
 * `[[ -f x ]]` のようなシェル記法を Obsidian のリンクと誤検知しないため。
 */
function stripCode(body: string): string {
  return body
    .replace(/^```[\s\S]*?^```/gm, '')
    .replace(/^~~~[\s\S]*?^~~~/gm, '')
    .replace(/`[^`\n]*`/g, '');
}

/** 本文中に現れてはいけないパターン */
const FORBIDDEN_PATTERNS: { pattern: RegExp; label: string }[] = [
  // Obsidian 固有記法（Simplenote / Obsidian からのコピペで混入する）
  { pattern: /!\[\[[^\]]+\]\]/, label: 'Obsidian の埋め込み記法 ![[...]]' },
  { pattern: /\[\[[^\]]+\]\]/, label: 'Obsidian の内部リンク記法 [[...]]' },
  { pattern: /^\s*>\s*\[!\w+\]/m, label: 'Obsidian の callout 記法 > [!note]' },
  { pattern: /%%[\s\S]*?%%/, label: 'Obsidian のコメント記法 %%...%%' },

  // WordPress からの変換残骸
  { pattern: /<!--\s*\/?wp:/, label: 'Gutenberg のブロックコメント <!-- wp: -->' },
  { pattern: /\[\/?caption[\s\]]/, label: 'WordPress の [caption] ショートコード' },
  { pattern: /\[\/?embed[\s\]]/, label: 'WordPress の [embed] ショートコード' },
  { pattern: /\[\/[a-z_][a-z0-9_-]*\]/i, label: 'ショートコードの閉じタグ [/...]' },
];

async function main() {
  let files: string[];
  try {
    files = (await readdir(POSTS_DIR)).filter((f) => !f.startsWith('.'));
  } catch {
    console.error(`✗ ${POSTS_DIR} が見つかりません。`);
    console.error('  private リポジトリ (blog-content) の記事を symlink / コピーしてください。');
    process.exit(1);
  }

  /** 最終的な URL slug → それを生成したファイル */
  const slugOwners = new Map<string, string[]>();

  for (const file of files) {
    if (!file.endsWith('.md')) {
      error(file, '.md 以外のファイルが posts に置かれています');
      continue;
    }

    const stem = file.slice(0, -'.md'.length);

    // --- ファイル名 ---
    // macOS はファイル名の大文字小文字を区別しないため、大文字が混ざると
    // ローカルでは動いて Linux の CI でだけ壊れる。ここで止める。
    if (!SLUG_PATTERN.test(stem)) {
      error(file, 'ファイル名は英小文字・数字・ハイフンのみ使えます（例: my-post.md）');
    }

    const raw = await readFile(join(POSTS_DIR, file), 'utf8');
    const { data, content } = matter(raw);

    // --- 必須項目 ---
    for (const key of ['title', 'date', 'category', 'description'] as const) {
      if (data[key] === undefined || data[key] === '') {
        error(file, `frontmatter に ${key} がありません`);
      }
    }

    // --- slug ---
    const explicit = data.slug as string | undefined;
    if (explicit !== undefined) {
      if (typeof explicit !== 'string' || !SLUG_PATTERN.test(explicit)) {
        error(file, `slug "${explicit}" は英小文字・数字・ハイフンのみ使えます`);
      }
    }

    const slug = explicit ?? stem;
    if (RESERVED_SLUGS.has(slug)) {
      error(
        file,
        `slug "${slug}" は予約語です（固定ページや特殊ファイルと URL が衝突します）。` +
          ' ファイル名を変えるか frontmatter で slug を指定してください',
      );
    }
    slugOwners.set(slug, [...(slugOwners.get(slug) ?? []), file]);

    // --- カテゴリ / タグ ---
    if (data.category !== undefined && !(data.category in categories)) {
      error(
        file,
        `category "${data.category}" はマスタにありません。` +
          ` src/data/categories.ts に追加するか表記を直してください（現在: ${Object.keys(categories).join(', ')}）`,
      );
    }

    if (data.tags !== undefined) {
      if (!Array.isArray(data.tags)) {
        error(file, 'tags は配列で書いてください（例: tags: ["週次"]）');
      } else {
        for (const tag of data.tags) {
          if (!(tag in tags)) {
            error(file, `tag "${tag}" はマスタにありません。src/data/tags.ts に追加してください`);
          }
        }
        if (new Set(data.tags).size !== data.tags.length) {
          warn(file, 'tags に重複があります');
        }
      }
    }

    // --- 本文 ---
    const body = stripCode(content);
    for (const { pattern, label } of FORBIDDEN_PATTERNS) {
      if (pattern.test(body)) {
        error(file, `本文に ${label} が残っています`);
      }
    }

    // --- 警告 ---
    if (typeof data.description === 'string' && data.description.length > DESCRIPTION_MAX) {
      warn(
        file,
        `description が ${data.description.length} 文字です（${DESCRIPTION_MAX} 文字を超えると検索結果で省略されます）`,
      );
    }

    if (content.trim() === '') {
      warn(file, '本文が空です');
    }
  }

  // --- slug の重複（記事をまたぐのでループの外で判定）---
  for (const [slug, owners] of slugOwners) {
    if (owners.length > 1) {
      error(owners.join(', '), `slug "${slug}" が重複しています。同じ URL になってしまいます`);
    }
  }

  report(files.length);
}

function report(fileCount: number) {
  for (const { file, message } of warnings) {
    console.warn(`⚠ ${file}\n  ${message}`);
  }

  for (const { file, message } of errors) {
    console.error(`✗ ${file}\n  ${message}`);
  }

  if (errors.length > 0) {
    console.error(`\n${errors.length} 件のエラーがあります。ビルドを中止しました。`);
    process.exit(1);
  }

  const suffix = warnings.length > 0 ? `（警告 ${warnings.length} 件）` : '';
  console.log(`✓ ${fileCount} 件の記事を検証しました${suffix}`);
}

await main();
