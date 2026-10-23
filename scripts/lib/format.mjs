// 表示用の小さな関数

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const comma = (n) => (n == null ? '—' : Math.round(n).toLocaleString('ja-JP'));

export function fmt(v, digits = 1) {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toLocaleString('ja-JP', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export const pct = (v, digits = 1) => (v == null ? '—' : `${fmt(v * 100, digits)}%`);
export const days = (v) => (v == null ? '—' : `${fmt(v, 1)}日`);

// 公表された件数と、10件未満で伏せられた区分の数 → 表示（例：120、120〜138）
export function range(v, masked, { unit = '' } = {}) {
  if (!v && !masked) return '—';
  if (!masked) return `${comma(v)}${unit}`;
  if (!v) return '10件未満';
  return `${comma(v)}<small>〜${comma(v + masked * 9)}</small>${unit}`;
}
// 文の中で使う（HTMLなし）
export function rangeText(v, masked, unit = '件') {
  if (!masked) return `${comma(v)}${unit}`;
  return `${comma(v)}〜${comma(v + masked * 9)}${unit}`;
}

// 法人の種類などを外した呼び名（見出しや一覧で使う。正式名はページに必ず載せる）
const KINDS = '国立大学法人|公立大学法人|学校法人|国立研究開発法人|独立行政法人|地方独立行政法人|社会医療法人財団|社会医療法人社団|社会医療法人|特定医療法人財団|特定医療法人社団|特定医療法人|医療法人財団|医療法人社団|医療法人|一般財団法人|公益財団法人|一般社団法人|公益社団法人|社会福祉法人|宗教法人|国家公務員共済組合連合会|地方職員共済組合|公立学校共済組合';
const KIND = new RegExp(`^(${KINDS})`);
const KIND_ONLY = new RegExp(`^(${KINDS})$`);
const FACILITY = /(病院|センター|医院|クリニック|診療所)/;
// 運営する法人の名前のあとに病院名が続く形だけ外す。
// 「〇〇機構」「〇〇財団」「〇〇事業団」はそのまま外し、「〇〇会」は残りが短い（「札幌病院」など）ときは呼び名の一部として残す
function dropOperator(s) {
  const dup = /^(.{2,10}?会)\1/.exec(s);
  if (dup) return s.slice(dup[1].length); // 「苑田会苑田会…」のように法人名が病院名にも入っている
  const op = /^(.{1,20}?(?:機構|事業団|財団))(.{5,})$/.exec(s);
  if (op && !FACILITY.test(op[1].replace(/病院機構$/, '')) && FACILITY.test(op[2])) return op[2];
  const kai = /^(.{1,10}?会)(.{6,})$/.exec(s);
  if (kai && !FACILITY.test(kai[1]) && FACILITY.test(kai[2])) return kai[2];
  return s;
}
const GENERIC = /^(総合)?(医療センター|病院|総合病院|メディカルセンター|総合医療センター)$/;
const ABBR = [[/^地域医療機能推進機構$/, 'JCHO']];
// 全角の英数字は半角にする（ＮＴＴ → NTT）
const half = (s) => s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
export function shortName(name) {
  const full = half(String(name).trim());
  const seg = full.split(/[\s　]+/).filter(Boolean);
  let s;
  if (seg.length >= 2) {
    // 「法人名　病院名」の形：最後の区切りを病院名とみる（短いときや「総合医療センター」だけのときは一つ前とつなぐ）
    s = seg[seg.length - 1];
    let prev = seg[seg.length - 2].replace(KIND, '');
    for (const [re, to] of ABBR) prev = prev.replace(re, to);
    if ((s.length <= 5 || GENERIC.test(s)) && prev && prev.length <= 12) s = prev + s;
    else if (KIND_ONLY.test(seg[seg.length - 2]) && !/大学法人|学校法人/.test(seg[seg.length - 2])) s = dropOperator(s);
  } else {
    const m = KIND.exec(full);
    if (!m) return full;
    s = full.slice(m[0].length);
    if (!/大学法人|学校法人/.test(m[1])) s = dropOperator(s);
  }
  if (/^附属.{4,}/.test(s)) s = s.slice(2); // 「附属榊原記念病院」→「榊原記念病院」
  return s.length >= 3 ? s : full;
}

export function truncate(s, n) {
  s = String(s ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function safeUrl(u) {
  u = String(u ?? '').trim();
  if (!/^https?:\/\/[^\s"'<>]+$/i.test(u)) return '';
  return u;
}

// 「令和6年6月～令和7年5月」→ { from: '2024年6月', to: '2025年5月', fy: 2024 }
export function periodOf(text, year) {
  const m = /令和(\d+)年(\d+)月[～〜~－-]令和(\d+)年(\d+)月/.exec(String(text).replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));
  const y = (n) => 2018 + +n;
  if (m) return { from: `${y(m[1])}年${+m[2]}月`, to: `${y(m[3])}年${+m[4]}月`, fy: y(m[1]) };
  return { from: `${y(year)}年6月`, to: `${y(year) + 1}年5月`, fy: y(year) };
}
