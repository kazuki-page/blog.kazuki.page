/**
 * OGP 画像の生成。
 *
 * satori で SVG を組み立て、resvg で PNG にする。
 * ビルド時にだけ動かすので、フォントの大きさや生成速度は問題にならない。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { CANVAS_HEIGHT, CANVAS_WIDTH, MAX_TEXT_WIDTH, layoutTitle } from './ogp';

/*
 * import.meta.url は使えない。バンドル後は dist/.prerender/chunks/ を指してしまい、
 * そこには assets が無いため。このコードはビルド時にしか動かず、
 * その時の cwd は必ずプロジェクトルート（npm スクリプトの実行位置）なのでそこを基準にする。
 */
const asset = (name: string) => resolve(process.cwd(), 'src/assets/ogp', name);

/**
 * フォントと背景はプロセス内で 1 回だけ読む。
 * 記事ごとに読み直すと 300 件ぶんの無駄な I/O になる。
 */
let cache: { font: Buffer; background: string } | null = null;

function assets() {
  if (!cache) {
    cache = {
      font: readFileSync(asset('BIZUDGothic-Regular.ttf')),
      background: `data:image/png;base64,${readFileSync(asset('background.png')).toString('base64')}`,
    };
  }
  return cache;
}

export async function renderOgpImage(title: string): Promise<Buffer> {
  const { font, background } = assets();
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
