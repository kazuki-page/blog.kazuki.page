# blog.kazuki.page

個人ブログ [blog.kazuki.page](https://blog.kazuki.page) の実装。
WordPress から Astro + Cloudflare Pages へ移行したもの。

**記事本文はこのリポジトリには含まれない。** 別の private リポジトリ (`blog-content`) が持ち、
ビルド時に結合される。サイトの実装だけを公開し、記事の編集履歴は公開しないための構成。

## 構成

```
[blog-content] (private)          [blog.kazuki.page] (public)
  記事の Markdown                   Astro 本体・レイアウト・設定
        │                                    │
        └────── GitHub Actions ──────────────┘
                 (blog-content 側で実行)
                 記事を配置 → build → wrangler pages deploy
                          │
                          ▼
              Cloudflare Pages (Direct Upload)
```

Cloudflare 側は Git 連携していない。デプロイの起点は Actions のみ。

## URL 設計

| ページ | URL |
| --- | --- |
| 記事 | `/{slug}/` |
| トップ | `/`、2 ページ目以降は `/page/2/` |
| カテゴリ | `/categories/{slug}/` |
| タグ | `/tags/{slug}/` |
| 固定ページ | `/about/`、`/policy/` |
| フィード | `/rss.xml` |

- 記事はルート直下に置くため、固定ページと名前空間を共有している。
  衝突は予約語リストで検出する（`src/data/reserved-slugs.ts`）
- 末尾スラッシュあり（`trailingSlash: 'always'`）。移行前の WordPress と URL を揃え、
  301 リダイレクトを最小限にするため
- 1 ページ 100 件。移行前と件数を揃えてあるので、ページネーションの URL も変わらない

## タクソノミー

カテゴリとタグは「表示名 → slug」のマスタで管理する。

```ts
// src/data/tags.ts
export const tags = {
  週次: { slug: 'weekly', description: '...' },
};
```

記事の frontmatter には表示名を書き、URL には slug を使う。
**マスタに無い名前が現れたらビルドを失敗させる** —— 表記ゆれを検出するため。

## 検証

`npm run build` の前段で `scripts/validate-content.ts` が走る。
Content Collections の zod スキーマが見られない範囲を担当する。

| | 担当 |
| --- | --- |
| zod スキーマ | 1 記事の frontmatter の型と値 |
| 検証スクリプト | ファイル名、記事をまたいだ slug 重複、予約語衝突、本文の混入物 |

本文の検査は**コードブロックとインラインコードを除いてから**行う。
シェルの `[[ -f x ]]` を Obsidian のリンク記法と誤検知しないため。

## コマンド

| コマンド | 内容 |
| --- | --- |
| `npm run link:content` | 隣の `blog-content/posts` を `src/content/posts` へ symlink |
| `npm run dev` | 開発サーバー (localhost:4321) |
| `npm run validate` | 記事の検証のみ |
| `npm run build` | 検証 → ビルド |
| `npm run preview` | ビルド結果をローカルで確認 |

## ローカルで動かす

記事が別リポジトリにあるため、clone しただけでは表示できない。

```bash
git clone https://github.com/kazuki-page/blog.kazuki.page.git
git clone https://github.com/kazuki-page/blog-content.git   # 同じ階層に置く
cd blog.kazuki.page
npm install
npm run link:content
npm run dev
```

## 技術構成

- [Astro](https://astro.build) 7（静的出力・Content Layer API）
- Cloudflare Pages（Direct Upload）
- GitHub Actions
- TypeScript / zod
