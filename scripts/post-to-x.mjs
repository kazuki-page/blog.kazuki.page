/**
 * まだ投稿していない記事を X に投稿する。
 *
 *   node post-to-x.mjs <記事ディレクトリ> <投稿済みリスト.json>
 *
 * 「どれを投稿済みか」を JSON に記録し、そこに無い記事だけを投稿する。
 * git の差分で新規判定すると、ビルドが 1 度失敗しただけで
 * 「新規追加」の履歴が過去のコミットに埋もれ、直して push しても
 * 二度と投稿されなくなる。記録を持てば再実行でも取りこぼさない。
 *
 * 認証は OAuth 1.0a。X API v2 の POST /2/tweets はユーザー権限を要求するため、
 * 開発者ポータルで自分用に発行したアクセストークンをそのまま使う（更新不要）。
 *
 * 必要な環境変数:
 *   X_API_KEY / X_API_SECRET               アプリの Consumer Key / Secret
 *   X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET 自分のアカウントのアクセストークン
 *   DRY_RUN=1                              投稿せず内容だけ出力する（記録も更新しない）
 */

import { createHmac, randomBytes } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const SITE = 'https://blog.kazuki.page';
const ENDPOINT = 'https://api.x.com/2/tweets';
const MAX_LENGTH = 280;
/** X は URL を t.co の固定長として数える */
const URL_WEIGHT = 23;

/**
 * 1 回の実行で投稿する上限。
 * 記録ファイルを失った場合に全記事を投稿してしまう事故を防ぐための安全弁。
 */
const MAX_BATCH = 5;

const credentials = {
  key: process.env.X_API_KEY,
  secret: process.env.X_API_SECRET,
  token: process.env.X_ACCESS_TOKEN,
  tokenSecret: process.env.X_ACCESS_TOKEN_SECRET,
};
const dryRun = process.env.DRY_RUN === '1';

/** RFC 3986。encodeURIComponent が変換しない記号を補う */
function percentEncode(value) {
  return encodeURIComponent(value).replace(
    /[!*()']/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

function authorizationHeader(method, url) {
  const params = {
    oauth_consumer_key: credentials.key,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: credentials.token,
    oauth_version: '1.0',
  };

  // 署名対象は method + URL + パラメータ。
  // JSON ボディは署名に含めない（含めるのはフォーム形式のときだけ）
  const normalized = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join('&');
  const base = [method.toUpperCase(), percentEncode(url), percentEncode(normalized)].join('&');
  const signingKey = `${percentEncode(credentials.secret)}&${percentEncode(credentials.tokenSecret)}`;

  params.oauth_signature = createHmac('sha1', signingKey).update(base).digest('base64');

  return (
    'OAuth ' +
    Object.keys(params)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(params[k])}"`)
      .join(', ')
  );
}

/** frontmatter から必要な値だけ取り出す（YAML パーサは持ち込まない） */
function readFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const data = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    data[kv[1]] = kv[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return data;
}

function buildText(title, url) {
  const budget = MAX_LENGTH - URL_WEIGHT - 2; // 2 = 改行 2 つ
  const headline = title.length > budget ? title.slice(0, budget - 1) + '…' : title;
  return `${headline}\n\n${url}`;
}

async function post(text) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: authorizationHeader('POST', ENDPOINT),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new Error(`X API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function readState(path) {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error('配列ではありません');
    return new Set(parsed);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`✗ 投稿済みリストが見つかりません: ${path}`);
      console.error('  空の状態で実行すると全記事を投稿してしまうため中止します。');
      console.error('  既存記事の slug を並べた JSON 配列を作成してください。');
      process.exit(1);
    }
    throw err;
  }
}

async function main() {
  const [postsDir, statePath] = process.argv.slice(2);
  if (!postsDir || !statePath) {
    console.error('usage: node post-to-x.mjs <記事ディレクトリ> <投稿済みリスト.json>');
    process.exit(1);
  }

  const posted = await readState(statePath);
  const files = (await readdir(postsDir)).filter((f) => f.endsWith('.md')).sort();

  const pending = [];
  for (const file of files) {
    const source = await readFile(join(postsDir, file), 'utf8');
    const data = readFrontmatter(source);
    const slug = data.slug || basename(file, '.md');

    if (posted.has(slug)) continue;
    if (data.draft === 'true') {
      console.log(`スキップ（下書き）: ${file}`);
      continue;
    }
    if (!data.title) {
      console.log(`スキップ（title なし）: ${file}`);
      continue;
    }
    pending.push({ slug, title: data.title });
  }

  if (pending.length === 0) {
    console.log('投稿対象の新しい記事はありません。');
    return;
  }

  if (pending.length > MAX_BATCH) {
    console.error(`✗ 投稿対象が ${pending.length} 件あります（上限 ${MAX_BATCH} 件）。`);
    console.error('  投稿済みリストが失われている可能性があります。中身を確認してください。');
    console.error('  対象:', pending.map((p) => p.slug).join(', '));
    process.exit(1);
  }

  const configured = Object.values(credentials).every(Boolean);
  if (!configured && !dryRun) {
    console.log('X の認証情報が未設定のため投稿をスキップします。');
    console.log('対象だった記事:', pending.map((p) => p.slug).join(', '));
    return;
  }

  for (const { slug, title } of pending) {
    const text = buildText(title, `${SITE}/${slug}/`);

    if (dryRun) {
      console.log(`--- 投稿内容（DRY_RUN のため送信しません）\n${text}\n`);
      continue;
    }

    const result = await post(text);
    console.log(`投稿しました: ${title} → ${result?.data?.id ?? '(id 不明)'}`);
    posted.add(slug);
  }

  if (dryRun) {
    console.log('DRY_RUN のため投稿済みリストは更新しません。');
    return;
  }

  await writeFile(statePath, JSON.stringify([...posted].sort(), null, 2) + '\n');
  console.log(`投稿済みリストを更新しました（${posted.size} 件）。`);
}

await main();
