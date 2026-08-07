/**
 * OGP 画像の生成。
 *
 * satori で SVG を組み立て、resvg で PNG にする。
 *
 * 1 枚あたり 0.4 秒ほどかかるため、記事が 300 件を超えた今は全部作り直すと
 * ビルドが 3 分になる。生成済みの PNG を .ogp-cache/ に残しておき、
 * 2 回目以降は増えた記事のぶんだけ作る。
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { CANVAS_HEIGHT, CANVAS_WIDTH, MAX_TEXT_WIDTH, layoutTitle } from './ogp';

/*
 * import.meta.url は使えない。バンドル後は dist/.prerender/chunks/ を指してしまい、
 * そこには assets が無いため。このコードはビルド時にしか動かず、
 * その時の cwd は必ずプロジェクトルート（npm スクリプトの実行位置）なのでそこを基準にする。
 */
const fromRoot = (path: string) => resolve(process.cwd(), path);

const CACHE_DIR = fromRoot('.ogp-cache');
const FINGERPRINT_FILE = join(CACHE_DIR, 'fingerprint');

/**
 * OGP_REGENERATE=1 なら、キャッシュにあっても作り直す。
 * 生成結果は書き戻すので、次のビルドはまた速くなる。
 */
const regenerate = process.env.OGP_REGENERATE === '1';

/**
 * キャッシュのファイル名。タイトルから決めるので、
 * 記事のタイトルを直せば自動的に別のファイルになる（＝作り直される）。
 */
function cacheKey(title: string): string {
  return `${createHash('sha256').update(title).digest('hex').slice(0, 32)}.png`;
}

/**
 * 画像の見た目を決めているもの全部をまとめた指紋。
 *
 * 背景・フォント・レイアウト規則・描画ライブラリのどれが変わっても
 * 既存のキャッシュは使えなくなるので、この値が変わったら中身を丸ごと捨てる。
 * このファイル自身も対象なので、描画のしかたを直せば必ず作り直しになる。
 */
function fingerprint(): string {
  const hash = createHash('sha256');

  for (const path of [
    'src/lib/ogp.ts',
    'src/lib/ogp-render.ts',
    'src/assets/ogp/background.png',
    'src/assets/ogp/BIZUDGothic-Regular.ttf',
  ]) {
    hash.update(readFileSync(fromRoot(path)));
  }

  // 描画ライブラリの更新で出力が変わることもあるので、バージョンも混ぜる
  const lock = JSON.parse(readFileSync(fromRoot('package-lock.json'), 'utf-8'));
  for (const name of ['satori', '@resvg/resvg-js']) {
    hash.update(`${name}@${lock.packages?.[`node_modules/${name}`]?.version ?? 'unknown'}`);
  }

  return hash.digest('hex').slice(0, 16);
}

/** 指紋の照合は 1 プロセスで 1 回でいい */
let verified = false;

function openCache(): void {
  if (verified) return;
  verified = true;

  const current = fingerprint();
  const previous = existsSync(FINGERPRINT_FILE) ? readFileSync(FINGERPRINT_FILE, 'utf-8') : null;

  if (previous !== current) rmSync(CACHE_DIR, { recursive: true, force: true });

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(FINGERPRINT_FILE, current);
}

/**
 * キャッシュを使える状態にする。ビルドの最初に、全記事のタイトルを渡して 1 回だけ呼ぶ。
 *
 * 指紋の照合に加えて、今回の記事に対応しないファイルを消す。
 * タイトルを直した記事の古い画像や、公開をやめた記事の画像がここで落ちる。
 */
export function prepareOgpCache(titles: string[]): void {
  openCache();

  const keep = new Set(titles.map(cacheKey));

  for (const name of readdirSync(CACHE_DIR)) {
    if (name.endsWith('.png') && !keep.has(name)) rmSync(join(CACHE_DIR, name));
  }

  const hits = regenerate ? 0 : readdirSync(CACHE_DIR).filter((n) => n.endsWith('.png')).length;
  const suffix = regenerate ? '（OGP_REGENERATE=1 のため全て作り直す）' : '';
  console.log(`[ogp] 流用 ${hits} 件 / 生成 ${titles.length - hits} 件${suffix}`);
}

/**
 * フォントと背景はプロセス内で 1 回だけ読む。
 * 記事ごとに読み直すと 300 件ぶんの無駄な I/O になる。
 */
let assets: { font: Buffer; background: string } | null = null;

function loadAssets() {
  if (!assets) {
    assets = {
      font: readFileSync(fromRoot('src/assets/ogp/BIZUDGothic-Regular.ttf')),
      background: `data:image/png;base64,${readFileSync(fromRoot('src/assets/ogp/background.png')).toString('base64')}`,
    };
  }
  return assets;
}

export async function renderOgpImage(title: string): Promise<Buffer> {
  openCache();

  const cached = join(CACHE_DIR, cacheKey(title));
  if (!regenerate && existsSync(cached)) return readFileSync(cached);

  const png = await draw(title);
  writeFileSync(cached, png);

  return png;
}

async function draw(title: string): Promise<Buffer> {
  const { font, background } = loadAssets();
  const { lines, fontSize, top, lineHeight } = layoutTitle(title);

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          position: 'relative',
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
        },
        children: [
          {
            type: 'img',
            props: {
              src: background,
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              style: { position: 'absolute', top: 0, left: 0 },
            },
          },
          {
            // タイトル。各行を lineHeight の高さの箱に入れて中央に置く
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                top,
                left: (CANVAS_WIDTH - MAX_TEXT_WIDTH) / 2,
                width: MAX_TEXT_WIDTH,
                display: 'flex',
                flexDirection: 'column',
              },
              children: lines.map((line) => ({
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    height: lineHeight,
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize,
                    color: '#111111',
                  },
                  children: line,
                },
              })),
            },
          },
        ],
      },
    },
    {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      fonts: [{ name: 'BIZ UDGothic', data: font, weight: 400, style: 'normal' }],
    },
  );

  return Buffer.from(new Resvg(svg).render().asPng());
}
