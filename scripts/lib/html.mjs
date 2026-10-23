import { SITE_NAME, OPERATOR, SOURCE_NAME, TREE_NAME, CITY_NAME } from './meta.mjs';
import { esc, comma, range } from './format.mjs';

export const ORIGIN = process.env.SITE_ORIGIN || 'https://micoficial.github.io';
export const BASE = process.env.SITE_BASE || '/shujutsu/';
export const abs = (p) => `${ORIGIN}${BASE}${p}`;
export const href = (p) => `${BASE}${p}`;

export const hospitalPath = (h) => `byoin/${h.id}/`;
export const topicPath = (t, p) => `ranking/${t.slug}/${p ? `${p.slug}/` : ''}`;
export const diseasePath = (d, p) => (d.topic ? topicPath(d.topic, p) : `shippei/${d.code}/${p ? `${p.slug}/` : ''}`);
export const prefPath = (p) => `ken/${p.slug}/`;

let ASSET_V = '1';
export const setAssetVersion = (v) => { ASSET_V = v; };
let BUILD = { built: '', manifest: null, period: null };
export const setBuildInfo = (b) => { BUILD = b; };
export const buildInfo = () => BUILD;

// 「2024年度（2024年6月〜2025年5月退院）」
export const fyText = () => `${BUILD.period.fy}年度`;
export const periodText = () => `${BUILD.period.from}〜${BUILD.period.to}`;

export function breadcrumbs(items) {
  const li = items.map(([name, p], i) => (p != null && i < items.length - 1
    ? `<li><a href="${href(p)}">${esc(name)}</a></li>`
    : `<li aria-current="page">${esc(name)}</li>`)).join('');
  const ld = {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, ...(p != null ? { item: abs(p) } : {}) })),
  };
  return { html: `<nav class="bc" aria-label="現在地"><ol>${li}</ol></nav>`, ld };
}

export function sourceLine() {
  const m = BUILD.manifest;
  const r = m.report;
  return `出典：厚生労働省「<a href="${esc(r.url)}" rel="noopener">${esc(r.title.replace(/について$/, ''))}</a>」、「<a href="${esc(m.tree.page)}" rel="noopener">${TREE_NAME}</a>」、総務省「<a href="https://www.soumu.go.jp/denshijiti/code.html" rel="noopener">${CITY_NAME}</a>」をもとに${OPERATOR}が加工して作成。国（厚生労働省）が作成したものではありません。`;
}

// 医療の情報を見るときの注意（ランキング・病院ページの上の方に出す）
export function caution(kind = 'rank') {
  const extra = kind === 'rank'
    ? '順位は件数の多い順に並べただけのもので、病院の評価やおすすめではありません。'
    : 'このページは病院の評価やおすすめではありません。';
  return `<aside class="caution" role="note"><b>見るときの注意</b>件数が多いことは、治療の質や安全性が高いことを直接示すものではありません。${extra}受診や治療の判断は、主治医や病院の説明をもとにしてください。<a href="${href('about/#yomikata')}">数字の読み方</a></aside>`;
}

export function shareButtons(url, text) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return `<div class="share" data-url="${esc(url)}">
<span class="share-l">シェア</span>
<a class="sh" href="https://x.com/intent/post?text=${t}&amp;url=${u}" target="_blank" rel="noopener">X</a>
<a class="sh" href="https://social-plugins.line.me/lineit/share?url=${u}" target="_blank" rel="noopener">LINE</a>
<a class="sh" href="https://b.hatena.ne.jp/entry/${esc(url.replace(/^https:\/\//, 's/'))}" target="_blank" rel="noopener">はてブ</a>
<button class="sh sh-copy" type="button">リンクをコピー</button>
</div>`;
}

// 件数のセル（並べ替え用の値と、件数に比例した帯を付ける）
export function numCell(x, max, { bar = true, cls = '' } = {}) {
  if (!x || (!x.v && !x.m)) return `<td class="n ${cls}" data-v="-1">—</td>`;
  if (!x.v) return `<td class="n nd ${cls}" data-v="0"><small>10件未満</small></td>`;
  const w = max ? Math.max(1, Math.round((x.v / max) * 100)) : 0;
  return `<td class="n ${cls}" data-v="${x.v}">${bar && w ? `<i class="bar" style="width:${w}%"></i>` : ''}<span>${range(x.v, x.m)}</span></td>`;
}
export const losCell = (v) => (v == null ? '<td class="n d" data-v="-1">—</td>' : `<td class="n d" data-v="${v.toFixed(2)}">${v.toFixed(1)}</td>`);

export function layout({ title, description, path, body, ld = [], noindex = false, ogTitle }) {
  const canonical = abs(path);
  const graph = ld.length ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': ld }).replace(/</g, '\\u003c')}</script>` : '';
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${esc(ogTitle || title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${abs('assets/og.png')}">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0d5c63">
<link rel="icon" href="${href('assets/favicon.svg')}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${href('assets/icon-180.png')}">
<link rel="stylesheet" href="${href(`assets/style.css?v=${ASSET_V}`)}">
<script defer src="${href(`assets/app.js?v=${ASSET_V}`)}"></script>
${graph}
</head>
<body>
<header class="hd">
<div class="wrap hd-in">
<a class="logo" href="${href('')}"><span class="logo-m" aria-hidden="true">術</span><span>${SITE_NAME}</span></a>
<form class="sb" role="search" action="${href('search/')}">
<input class="sb-i" name="q" type="search" placeholder="病院名で検索（例：がん研）" autocomplete="off" aria-label="病院名で検索" enterkeyhint="search">
<div class="sb-r" hidden></div>
</form>
<nav class="nv" aria-label="メニュー"><a href="${href('ranking/')}">病気・手術から</a><a href="${href('ken/')}">都道府県から</a><a href="${href('about/')}">数字の読み方</a></nav>
</div>
</header>
<main class="wrap">
${body}
</main>
<footer class="ft">
<div class="wrap">
<p class="ft-src">${sourceLine()}</p>
<p>数字は、国のDPC調査に参加した病院が提出したデータの${esc(fyText())}（${esc(periodText())}に退院した患者）の集計です。10件未満の区分は国が公表していません（「—」や「〜」の幅で示しています）。</p>
<nav class="ft-nv"><a href="${href('')}">トップ</a><a href="${href('ranking/')}">病気・手術から探す</a><a href="${href('shippei/')}">すべての病気</a><a href="${href('ken/')}">都道府県から探す</a><a href="${href('about/')}">このサイトについて</a><a href="${href('about/#privacy')}">プライバシー</a></nav>
<p class="ft-c">© ${new Date().getFullYear()} ${OPERATOR}　｜　データ更新：${esc(BUILD.built)}</p>
</div>
</footer>
</body>
</html>
`;
}

// 病院名（短い呼び名＋所在地）
export function hospitalCell(h, { pref = true } = {}) {
  const where = [pref ? h.prefInfo?.name : '', h.city || ''].filter(Boolean).join('');
  return `<a href="${href(hospitalPath(h))}">${esc(h.short)}</a><small>${esc(where)}</small>`;
}

export const yen = (n) => `${comma(n)}円`;
