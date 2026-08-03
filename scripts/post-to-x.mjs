/**
 * 新しく追加された記事を X に投稿する。
 *
 * デプロイの直後に GitHub Actions から呼ばれる。投稿対象のファイルは
 * 引数で受け取る（どれが新規かの判定はワークフロー側の git diff が担当）。
 *
 *   node post-to-x.mjs <記事ファイル>...
 *
 * 認証は OAuth 1.0a。X API v2 の POST /2/tweets はアプリ単体ではなく
 * ユーザー権限を要求するため、開発者ポータルで自分用に発行した
 * アクセストークンをそのまま使う（更新不要）。
 *
 * 必要な環境変数:
 *   X_API_KEY / X_API_SECRET               アプリの Consumer Key / Secret
 *   X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET 自分のアカウントのアクセストークン
 *   DRY_RUN=1                              投稿せず内容だけ出力する
 *
 * 認証情報が無いときは何もせず正常終了する。設定前でもデプロイを
 * 失敗させないため。
 */

import { createHmac, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

const SITE = 'https://blog.kazuki.page';
const ENDPOINT = 'https://api.x.com/2/tweets';
const MAX_LENGTH = 280;
/** X は URL を t.co の固定長として数える */
const URL_WEIGHT = 23;

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

async function main() {
  const files = process.argv.slice(2).filter((f) => f.endsWith('.md'));
  if (files.length === 0) {
    console.log('新規記事はありません。');
    return;
  }

  const configured = Object.values(credentials).every(Boolean);
  if (!configured && !dryRun) {
    console.log('X の認証情報が未設定のため投稿をスキップします。');
    console.log('対象だった記事:', files.map((f) => basename(f)).join(', '));
    return;
  }

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const data = readFrontmatter(source);

    if (data.draft === 'true') {
      console.log(`スキップ（下書き）: ${basename(file)}`);
      continue;
    }
    if (!data.title) {
      console.log(`スキップ（title なし）: ${basename(file)}`);
      continue;
    }

    const slug = data.slug || basename(file, '.md');
    const text = buildText(data.title, `${SITE}/${slug}/`);

    if (dryRun) {
      console.log(`--- 投稿内容（DRY_RUN のため送信しません）\n${text}\n`);
      continue;
    }

    const result = await post(text);
    console.log(`投稿しました: ${data.title} → ${result?.data?.id ?? '(id 不明)'}`);
  }
}

await main();
