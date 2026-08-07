/**
 * OGP 画像のレイアウト計算。
 *
 * 背景 PNG (src/assets/ogp/background.png) の実測値を前提にしている。
 * 画像は 2400x1260。3 本線が y=1000..1021 にあり、その上下が長方形になる。
 *
 *   上の長方形 … y=0..999   (高さ 1000) タイトルを置く領域
 *   3 本線     … y=1000..1021
 *   下の長方形 … y=1022..1259 (高さ 238)  ロゴが入る
 *
 * 左右の余白は「下の長方形の短辺 (=238)」以上、というルールで決めている。
 */

export const CANVAS_WIDTH = 2400;
export const CANVAS_HEIGHT = 1260;

/** 3 本線の上端。タイトル領域はここまで */
const STRIPE_TOP = 1000;

/** 下の長方形の高さ。左右の余白もこれに合わせる */
const SIDE_MARGIN = 238;

export const MAX_TEXT_WIDTH = CANVAS_WIDTH - SIDE_MARGIN * 2; // 1924

/** タイトル領域の中心。ここに基準行が来る */
const TEXT_AREA_CENTER = STRIPE_TOP / 2; // 500

/** モックから逆算した値 */
const BASE_FONT_SIZE = 130;
export const LINE_HEIGHT_RATIO = 1.34;

/**
 * 3 行に収まらないときに試す縮小後のサイズ。
 * 全 312 記事のうち 4 行になるのは 1 本だけなので、
 * 4 行のレイアウト規則を足すより 1 段階縮めるほうが見た目が一貫する。
 */
const FONT_SIZE_STEPS = [BASE_FONT_SIZE, 118, 106, 96];

const MAX_LINES = 3;

/** 最終行がこれ未満の幅にならないようにする（全角 3 文字ぶん） */
const MIN_LAST_LINE_EM = 3;

/**
 * 行頭に置けない文字。
 * 閉じ括弧・句読点・長音や小書きの仮名など。
 */
const NO_LINE_START = new Set(
  '、。，．・：；？！ー〜～）〕］｝〉》」』】〙〗”’〟゛゜ヽヾゝゞ々' +
    'ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ' +
    ',.:;?!)]}>%',
);

/** 行末に置けない文字。開き括弧の類 */
const NO_LINE_END = new Set('（〔［｛〈《「『【〘〖“‘〝([{<');

/**
 * 欧文の単語の途中で改行しないための判定。
 * 空白以外の ASCII 印字文字を「単語を構成する文字」とみなす。
 * 記号も含めることで "fatal:" や "2026/07/27" がまとまって扱われる。
 */
function isAsciiWordChar(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  return cp > 0x20 && cp <= 0x7e;
}

/**
 * 1 文字の幅を em で返す。
 *
 * BIZ UDGothic は完全な等幅で、ASCII が 0.5em、それ以外が 1em になっている
 * （フォントの hmtx を実測して確認済み）。そのため字幅を厳密に計算できる。
 */
export function charWidthEm(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0;

  // ASCII
  if (cp <= 0x7f) return 0.5;
  // 半角カナ・半角記号
  if (cp >= 0xff61 && cp <= 0xffdc) return 0.5;
  if (cp >= 0xffe8 && cp <= 0xffee) return 0.5;

  return 1;
}

function widthEm(chars: string[]): number {
  return chars.reduce((sum, ch) => sum + charWidthEm(ch), 0);
}

/**
 * 改行位置を決める。
 *
 * 幅で貪欲に切った位置 j から手前へ戻しながら、条件を満たす位置を探す（追い出し）。
 * 追い込みにすると行が maxEm を超えてしまうため使わない。
 *
 * 禁則は必ず守る。欧文の単語の分断は「行が痩せすぎない範囲でだけ」避ける
 * —— 長い英単語 1 語で行が埋まる場合まで避けようとすると、
 * かえって極端に短い行ができてしまうため。
 */
function findBreak(chars: string[], i: number, j: number, maxEm: number): number {
  const kinsokuOk = (k: number) => !NO_LINE_START.has(chars[k]) && !NO_LINE_END.has(chars[k - 1]);
  const wordOk = (k: number) => !(isAsciiWordChar(chars[k - 1]) && isAsciiWordChar(chars[k]));

  // 1) 禁則と欧文の単語の両方を守れる位置
  for (let k = j; k > i + 1; k--) {
    if (widthEm(chars.slice(i, k)) < maxEm * 0.5) break;
    if (kinsokuOk(k) && wordOk(k)) return k;
  }
  // 2) 見つからなければ禁則だけでも守る
  for (let k = j; k > i + 1; k--) {
    if (kinsokuOk(k)) return k;
  }
  return j;
}

/** 行頭・行末の半角空白を落とす。改行位置に来た空白は表示上不要なため */
function trimSpaces(line: string[]): string[] {
  let start = 0;
  let end = line.length;
  while (start < end && line[start] === ' ') start++;
  while (end > start && line[end - 1] === ' ') end--;
  return line.slice(start, end);
}

/** タイトルを 1 行あたり maxEm に収まるよう折り返す */
function wrapByWidth(chars: string[], maxEm: number): string[][] {
  const lines: string[][] = [];
  let i = 0;

  while (i < chars.length) {
    // maxEm に収まる最大の位置 j を探す
    let j = i;
    let w = 0;
    while (j < chars.length && w + charWidthEm(chars[j]) <= maxEm) {
      w += charWidthEm(chars[j]);
      j++;
    }

    // 1 文字も入らない場合の保険（maxEm が極端に小さいとき）
    if (j === i) j = i + 1;

    if (j < chars.length) j = findBreak(chars, i, j, maxEm);

    // ここでは空白を落とさない。落とすと行をまたぐ単語の境界が
    // 判定できなくなる（"failed" と "for" が地続きに見えてしまう）。
    // 空白の除去は行が確定したあと、layoutTitle でまとめて行う。
    lines.push(chars.slice(i, j));
    i = j;
  }

  return lines.filter((l) => l.length > 0);
}

/**
 * 最終行が短くなりすぎたら、前の行から文字を送って調整する。
 * 送った結果として禁則が崩れる場合はさらに送る。
 */
function balanceLastLine(lines: string[][], maxEm: number): void {
  if (lines.length < 2) return;

  let guard = 0;
  while (guard++ < 40) {
    const last = lines[lines.length - 1];
    const prev = lines[lines.length - 2];

    const lastW = widthEm(last);
    const startsBad = NO_LINE_START.has(last[0]);
    const endsBad = NO_LINE_END.has(prev[prev.length - 1]);
    // 送った結果、欧文の単語や日付が行をまたいで割れていないか
    const wordBad = isAsciiWordChar(prev[prev.length - 1]) && isAsciiWordChar(last[0]);

    if (lastW >= MIN_LAST_LINE_EM && !startsBad && !endsBad && !wordBad) return;

    const moving = prev[prev.length - 1];
    // 前の行を痩せさせすぎない／空にしない
    if (prev.length <= 1) return;
    if (widthEm(prev) - charWidthEm(moving) < MIN_LAST_LINE_EM) return;
    // 送っても最終行が maxEm を超えるなら諦める
    if (lastW + charWidthEm(moving) > maxEm) return;

    prev.pop();
    last.unshift(moving);
  }
}

export interface TitleLayout {
  lines: string[];
  fontSize: number;
  /** タイトルブロックの上端 y 座標 */
  top: number;
  lineHeight: number;
}

/**
 * タイトルの折り返しと縦位置を決める。
 *
 * 縦位置は「基準行がタイトル領域の中心に来る」規則で、
 * 2 行目は上に、3 行目は下に伸びる。
 *   1 行 … その行が中心
 *   2 行 … 2 行目が中心（1 行目が上に出る）
 *   3 行 … 2 行目が中心（上下に 1 行ずつ）
 */
export function layoutTitle(title: string): TitleLayout {
  const chars = [...title.trim()];

  let lines: string[][] = [];
  let fontSize = FONT_SIZE_STEPS[FONT_SIZE_STEPS.length - 1];

  for (const size of FONT_SIZE_STEPS) {
    const maxEm = MAX_TEXT_WIDTH / size;
    const candidate = wrapByWidth(chars, maxEm);
    balanceLastLine(candidate, maxEm);

    if (candidate.length <= MAX_LINES) {
      lines = candidate;
      fontSize = size;
      break;
    }
    // 最小サイズでも溢れる場合は、そのまま受け入れる
    lines = candidate;
    fontSize = size;
  }

  const lineHeight = fontSize * LINE_HEIGHT_RATIO;

  // 中心に置く行。1 行なら自分自身、2 行以上なら 2 行目
  const anchorIndex = lines.length === 1 ? 0 : 1;
  const top = TEXT_AREA_CENTER - (anchorIndex + 0.5) * lineHeight;

  return {
    lines: lines.map((l) => trimSpaces(l).join('')).filter((l) => l.length > 0),
    fontSize,
    top,
    lineHeight,
  };
}
