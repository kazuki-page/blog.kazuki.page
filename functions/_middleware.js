/**
 * Cloudflare Pages のリクエスト処理。
 *
 * 1. pages.dev で来たアクセスを本番ドメインへ寄せる
 * 2. 日本語などを含む旧 URL からのリダイレクト
 *
 * ASCII だけで表せるリダイレクトは `public/_redirects` 側にある。
 */

const CANONICAL_HOST = 'blog.kazuki.page';

/**
 * 本番の pages.dev ホスト。
 *
 * Cloudflare は `<プロジェクト名>.pages.dev` を無効にできないため、
 * 同じ内容が 2 つの URL で見える状態になる。ここで本番ドメインへ 301 して
 * 実質的に閉じる。
 *
 * プレビュー用の `<ハッシュ>.blog-kazuki-page.pages.dev` は対象外にしている。
 * 本番へ飛ばしてしまうとプレビューの確認ができなくなるため。
 */
const PAGES_DEV_HOST = 'blog-kazuki-page.pages.dev';

/** 英小文字・数字・ハイフン以外を含んでいた旧 slug。`_redirects` は非 ASCII のパスに一致しない */
const RENAMED = new Map([
  ['/ｍake-blog', '/make-blog'],
  ['/「memo」の「blog」への移行', '/from-memo-to-blog'],
  ['/weekly-2024-01-29〜02-04：旅行', '/weekly-2024-02-04'],
  ['/なにか', '/something'],
  ['/weekly-2025-09-07そこそこに', '/weekly-2025-09-07'],
]);

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.hostname === PAGES_DEV_HOST) {
    const target = new URL(url.pathname + url.search, `https://${CANONICAL_HOST}`);
    return Response.redirect(target.toString(), 301);
  }

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
