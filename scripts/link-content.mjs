/**
 * ローカル開発用に、記事リポジトリ (blog-content) の posts/ を
 * src/content/posts へ symlink する。
 *
 * public リポジトリには記事が入っていないため、clone しただけでは
 * プレビューできない。隣に blog-content を clone してこれを実行する。
 *
 *   ~/Code/
 *   ├── blog.kazuki.page/   ← ここ
 *   └── blog-content/       ← 記事
 *
 * 中身のあるディレクトリを誤って壊さないよう、実ディレクトリが
 * すでにある場合は何もせず終了する。
 */

import { existsSync, lstatSync, readdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const linkPath = join(root, 'src/content/posts');
const target = resolve(root, '..', 'blog-content/posts');

if (!existsSync(target)) {
  console.error(`✗ 記事リポジトリが見つかりません: ${target}`);
  console.error('  blog-content をこのリポジトリと同じ階層に clone してください:');
  console.error('    git clone <blog-content の URL> ../blog-content');
  process.exit(1);
}

if (existsSync(linkPath) || lstatSafe(linkPath)) {
  const stat = lstatSync(linkPath);

  if (stat.isSymbolicLink()) {
    unlinkSync(linkPath);
  } else {
    const count = readdirSync(linkPath).length;
    console.error(`✗ ${linkPath} が実ディレクトリとして存在します（${count} 件）。`);
    console.error('  中身を blog-content/posts へ移してから、このディレクトリを削除してください。');
    process.exit(1);
  }
}

symlinkSync(relative(dirname(linkPath), target), linkPath, 'dir');

const count = readdirSync(linkPath).filter((f) => f.endsWith('.md')).length;
console.log(`✓ src/content/posts → ${target}`);
console.log(`  記事 ${count} 件をリンクしました`);

function lstatSafe(p) {
  try {
    return lstatSync(p);
  } catch {
    return null;
  }
}
