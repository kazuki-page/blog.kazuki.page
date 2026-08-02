/**
 * 日本語などを含む旧 URL からのリダイレクト。
 *
 * Cloudflare Pages の `_redirects` は非 ASCII のパスを扱えず、
 * パーセントエンコードで書いても一致しなかった。リクエストのパスを
 * 自分でデコードして突き合わせる必要があるため、ここで処理する。
 *
 * ASCII だけで表せるリダイレクトは `public/_redirects` 側にある。
 */

const RENAMED = new Map([
  ['/ｍake-blog', '/make-blog'],
  ['/「memo」の「blog」への移行', '/from-memo-to-blog'],
  ['/weekly-2024-01-29〜02-04：旅行', '/weekly-2024-02-04'],
  ['/なにか', '/something'],
  ['/weekly-2025-09-07そこそこに', '/weekly-2025-09-07'],
]);

export async function onRequest(context) {
  const url = new URL(context.request.url);

  let path;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    return context.next(); // 壊れたエンコードはそのまま通す
  }

  const target = RENAMED.get(path.replace(/\/+$/, ''));
  if (target) {
    return Response.redirect(new URL(`${target}/`, url.origin).toString(), 301);
  }

  return context.next();
}
