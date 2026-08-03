/**
 * まだ投稿していない記事を Buffer 経由で即時投稿する。
 *
 *   node post-to-buffer.mjs <記事ディレクトリ> <投稿済みリスト.json>
 *   node post-to-buffer.mjs --channels          # 接続先の一覧を表示（初期設定用）
 *
 * X の API は 2026 年 2 月に無料枠が廃止され、投稿ごとの従量課金
 * （リンク付きは 1 件 $0.20）になった。Buffer は自前で X との接続を
 * 持っているため、Buffer の API を叩けば X の契約は要らない。
 *
 * 「どれを投稿済みか」を JSON に記録し、そこに無い記事だけを投稿する。
 * git の差分で新規判定すると、ビルドが 1 度失敗しただけで
 * 「新規追加」の履歴が過去のコミットに埋もれ、直して push しても
 * 二度と投稿されなくなる。記録を持てば再実行でも取りこぼさない。
 *
 * 必要な環境変数:
 *   BUFFER_ACCESS_TOKEN  publish.buffer.com/settings/api で発行する API キー
 *   BUFFER_CHANNEL_ID    投稿先チャンネル。カンマ区切りで複数指定できる
 *                        （例: X と Bluesky に同時投稿する。--channels で確認）
 *   DRY_RUN=1            送信せず内容だけ出力する（記録も更新しない）
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const SITE = 'https://blog.kazuki.page';
const ENDPOINT = 'https://api.buffer.com';
/** X の投稿上限。Buffer 経由でも X 側の制限は変わらない */
const MAX_LENGTH = 280;
/** X は URL を t.co の固定長として数える */
const URL_WEIGHT = 23;
/** タイトルの前に置く一文 */
const INTRO = 'ブログで記事を公開しました';
const ELLIPSIS = '…';

/**
 * 1 回の実行で投稿する上限。
 * 記録ファイルを失った場合に全記事を投稿してしまう事故を防ぐための安全弁。
 */
const MAX_BATCH = 5;

const token = process.env.BUFFER_ACCESS_TOKEN;
/** カンマ区切りで複数指定できる（X と Bluesky に同時投稿するなど） */
const channelIds = (process.env.BUFFER_CHANNEL_ID ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const dryRun = process.env.DRY_RUN === '1';

async function graphql(query, description) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Buffer API ${res.status}（${description}）: ${body}`);
  }

  const json = JSON.parse(body);
  if (json.errors?.length) {
    throw new Error(`Buffer API エラー（${description}）: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

/**
 * X の文字数の数え方に合わせた長さ。
 * 半角英数などは 1、日本語を含むそれ以外は 2 として数えるため、
 * 素の .length で計算すると日本語のタイトルで上限を超える。
 */
function weightedLength(text) {
  let total = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    const light =
      code <= 0x10ff ||
      (code >= 0x2000 && code <= 0x200d) ||
      (code >= 0x2010 && code <= 0x201f) ||
      (code >= 0x2032 && code <= 0x2037);
    total += light ? 1 : 2;
  }
  return total;
}

/** 重み付きの長さが limit に収まるよう、末尾を落として … を付ける */
function truncate(text, limit) {
  if (weightedLength(text) <= limit) return text;

  // … 自身も 2 文字ぶんとして数えられるので、その分を空けておく
  const room = limit - weightedLength(ELLIPSIS);

  let out = '';
  let used = 0;
  for (const ch of text) {
    const next = used + weightedLength(ch);
    if (next > room) break;
    out += ch;
    used = next;
  }
  return out + ELLIPSIS;
}

function buildText(title, url) {
  // 改行 4 つ（INTRO とタイトル、タイトルと URL の間に 2 つずつ）
  const budget = MAX_LENGTH - URL_WEIGHT - weightedLength(INTRO) - 4;
  return `${INTRO}\n\n${truncate(title, budget)}\n\n${url}`;
}

/** GraphQL の文字列リテラルとして安全な形にする */
function quote(text) {
  return JSON.stringify(text);
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

/** 初期設定用。組織と接続チャンネルを一覧表示する */
async function listChannels() {
  const account = await graphql('query { account { organizations { id name } } }', '組織の取得');

  for (const org of account.account.organizations) {
    console.log(`組織: ${org.name}  (id: ${org.id})`);
    const { channels } = await graphql(
      `query { channels(input: { organizationId: ${quote(org.id)} }) { id displayName service } }`,
      'チャンネルの取得',
    );
    for (const ch of channels) {
      console.log(`  ${ch.service.padEnd(12)} ${ch.displayName}`);
      console.log(`    BUFFER_CHANNEL_ID = ${ch.id}`);
    }
  }
}

async function createPost(text, channelId) {
  const mutation = `
    mutation {
      createPost(input: {
        text: ${quote(text)},
        channelId: ${quote(channelId)},
        schedulingType: automatic,
        mode: shareNow
      }) {
        ... on PostActionSuccess { post { id dueAt } }
        ... on MutationError { message }
      }
    }`;

  const data = await graphql(mutation, '投稿の作成');
  const result = data.createPost;

  if (result?.message) {
    throw new Error(`Buffer が投稿を拒否しました: ${result.message}`);
  }
  return result?.post;
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
  if (process.argv.includes('--channels')) {
    if (!token) {
      console.error('BUFFER_ACCESS_TOKEN が設定されていません。');
      process.exit(1);
    }
    await listChannels();
    return;
  }

  const [postsDir, statePath] = process.argv.slice(2);
  if (!postsDir || !statePath) {
    console.error('usage: node post-to-buffer.mjs <記事ディレクトリ> <投稿済みリスト.json>');
    console.error('       node post-to-buffer.mjs --channels');
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

  if ((!token || channelIds.length === 0) && !dryRun) {
    console.log('Buffer の設定が未完了のため投稿をスキップします。');
    console.log('対象だった記事:', pending.map((p) => p.slug).join(', '));
    return;
  }

  const failures = [];

  for (const { slug, title } of pending) {
    const text = buildText(title, `${SITE}/${slug}/`);

    if (dryRun) {
      console.log(`--- 投稿内容（DRY_RUN のため送信しません / ${channelIds.length} チャンネル）`);
      console.log(`${text}\n`);
      continue;
    }

    // 1 つでも成功したら投稿済みとして記録する。
    // 記録しないと、次の実行で成功済みのチャンネルに二重投稿してしまう
    let anySucceeded = false;
    for (const channelId of channelIds) {
      try {
        const post = await createPost(text, channelId);
        console.log(`投稿: ${title} → channel ${channelId} / post ${post?.id ?? '(id 不明)'}`);
        anySucceeded = true;
      } catch (err) {
        console.error(`✗ channel ${channelId} への投稿に失敗: ${err.message}`);
        failures.push(`${slug} → ${channelId}`);
      }
    }
    if (anySucceeded) posted.add(slug);
  }

  if (dryRun) {
    console.log('DRY_RUN のため投稿済みリストは更新しません。');
    return;
  }

  await writeFile(statePath, JSON.stringify([...posted].sort(), null, 2) + '\n');
  console.log(`投稿済みリストを更新しました（${posted.size} 件）。`);

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} 件の投稿に失敗しました:`);
    for (const f of failures) console.error(`  ${f}`);
    console.error('成功したぶんは記録済みなので、再実行しても二重投稿にはなりません。');
    process.exit(1);
  }
}

await main();
