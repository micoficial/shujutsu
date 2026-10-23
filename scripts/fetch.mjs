// 厚生労働省の DPC 公開データ（退院患者調査の結果報告）と、手術名の対応表（DPC電子点数表）、
// 市区町村コード（総務省）を data/raw/src/ に取ってくる。
// いちばん新しい年度の報告を中医協のページから探すので、来年度の分が出れば自動でそちらに切り替わる。
// 国のサイトは海外からのアクセスを断ることがあるので、取れなければ 1 で終わる（fetch.sh がリリースの控えに切り替える）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'raw', 'src');
const TMP = path.join(ROOT, 'data', 'raw', 'src.tmp');
const MHLW = 'https://www.mhlw.go.jp';
const INDEX = `${MHLW}/stf/shingi/shingi-chuo.html?tid=128164`;
const UA = 'Mozilla/5.0 (compatible; shujutsu-shirabe/1.0; +https://micoficial.github.io/shujutsu/about/)';

// 調査の年度（6月〜翌5月）→ その年度に使われた診断群分類（電子点数表）のページ
// 診療報酬改定（2年ごと）で新しいページができる。足りなければここに足す
const TREES = [
  { from: 6, to: 7, page: `${MHLW}/stf/seisakunitsuite/bunya/0000198757_00008.html` },
  { from: 8, to: 9, page: `${MHLW}/stf/newpage_67729.html` },
];

// 報告ページのリンク名 → 保存名。リンク名の［…KB］は外してから照らし合わせる
const WANT = [
  ['shisetsu', /^施設概要表$/],
  ['zaiin', /^（[0-9０-９]+）在院日数の状況$/],
  ['kyukyusha', /^（[0-9０-９]+）救急車による搬送の有無$/],
  ['kyukyu', /^（[0-9０-９]+）救急医療入院$/],
  ['shokai', /^（[0-9０-９]+）他院よりの紹介の有無$/],
  ['keiro', /^（[0-9０-９]+）入院経路及び退院先の状況$/],
  ['koudo', /^（[0-9０-９]+）手術化学療法放射線療法全身麻酔について$/],
  ['mdc', /^（[0-9０-９]+）MDC別医療機関別件数（割合）$/],
  ['optype', /^（[0-9０-９]+）疾患別手術別集計_施設類型別$/],
  ['dpc', /^（[0-9０-９]+）診断群分類毎の集計$/],
];
const OP = /^（[0-9０-９]+）疾患別手術別集計_MDC(\d\d)$/;

const zen2han = (s) => s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (html) => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ').trim();

async function get(url, as = 'text') {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      await sleep(400);
      return as === 'text' ? buf.toString('utf8') : buf;
    } catch (e) {
      if (i === 2) throw new Error(`${url} を取得できません（${e.message}）`);
      await sleep(5000 * (i + 1));
    }
  }
}

function links(html, base) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    out.push({ url: new URL(m[1], base).href, label: text(m[2]).replace(/［[^］]*］?$/, '').trim() });
  }
  return out;
}

// 1. いちばん新しい「退院患者調査」の結果報告
const index = await get(INDEX);
let report = null;
for (const row of index.split(/<tr\b/).slice(1)) {
  const t = zen2han(text(row));
  const m = /(令和|平成)\s*(\d+|元)\s*年度.*退院患者調査.*結果報告/.exec(t);
  const href = /href="([^"]+)"/.exec(row)?.[1];
  if (m && href) {
    report = { title: /[^ ]*退院患者調査[^ ]*/.exec(t)?.[0] || t.slice(0, 80), era: m[1], year: m[2] === '元' ? 1 : +m[2], url: new URL(href, INDEX).href };
    break;
  }
}
if (!report) throw new Error('中医協のページに退院患者調査の結果報告が見つかりません');
if (report.era !== '令和') throw new Error(`想定外の年度表記です：${report.title}`);
console.log('報告:', report.title, report.url);

const page = await get(report.url);
report.pageTitle = text(/<title>([\s\S]*?)<\/title>/.exec(page)?.[1] || '').replace(/｜厚生労働省$/, '');
const notes = [...zen2han(text(page)).matchAll(/※[^※]{0,80}?（令和\d+年\d+月\d+日）/g)].map((m) => m[0]);
report.notes = notes;
const files = {};
for (const l of links(page, report.url)) {
  if (!/\.xlsx(\?|$)/i.test(l.url)) continue;
  for (const [key, re] of WANT) if (re.test(l.label) && !files[key]) files[key] = l;
  const op = OP.exec(l.label);
  if (op && !files[`op${op[1]}`]) files[`op${op[1]}`] = l;
}
const missing = WANT.map(([k]) => k).filter((k) => !files[k]);
const opCount = Object.keys(files).filter((k) => /^op\d\d$/.test(k)).length;
if (missing.length || opCount < 15) throw new Error(`報告ページに必要なファイルがありません：${missing.join('、')}（疾患別手術別集計 ${opCount}件）`);

// 2. 電子点数表（その年度の診断群分類）。いちばん新しい正式版を使う
const tree = TREES.find((t) => report.year >= t.from && report.year <= t.to);
if (!tree) throw new Error(`令和${report.year}年度の電子点数表の場所がわかりません。scripts/fetch.mjs の TREES に足してください`);
const treePage = await get(tree.page);
const treeLinks = links(treePage, tree.page).filter((l) => /\.xlsx(\?|$)/i.test(l.url) && /電子点数表（正式版）/.test(l.label));
if (!treeLinks.length) throw new Error(`電子点数表（正式版）が見つかりません：${tree.page}`);
const treeDates = [...treePage.matchAll(/電子点数表（正式版）[^（]*（([^）]*更新)）/g)].map((m) => zen2han(text(m[1])));
files.tree = { ...treeLinks[treeLinks.length - 1], date: treeDates[treeDates.length - 1] || '' };

// 3. 市区町村コード（総務省「全国地方公共団体コード」）
const SOUMU = 'https://www.soumu.go.jp/denshijiti/code.html';
const soumu = await get(SOUMU);
const code = /href="([^"]+\.xlsx)"/.exec(soumu)?.[1];
if (!code) throw new Error('総務省の団体コードの Excel が見つかりません');
files.city = { url: new URL(code, SOUMU).href, label: '全国地方公共団体コード' };

// --if-changed：前回と同じファイル（URL）なら取り直さずに 3 で終わる（日本の回線での定期更新で使う）
if (process.argv.includes('--if-changed')) {
  try {
    const prev = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8'));
    const same = Object.keys(files).length === Object.keys(prev.files).length
      && Object.entries(files).every(([k, f]) => prev.files[k]?.url === f.url && fs.existsSync(path.join(OUT, `${k}.xlsx`)));
    if (same) {
      console.log('国のデータは前回から変わっていません');
      process.exit(3);
    }
  } catch { /* 前回の記録がなければ取る */ }
}

// 4. ぜんぶ取れてから入れ替える（途中で失敗したら前のものを残す）
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
for (const [key, f] of Object.entries(files)) {
  const buf = await get(f.url, 'buffer');
  if (buf.subarray(0, 2).toString('latin1') !== 'PK') throw new Error(`${f.url} が Excel ではありません`);
  fs.writeFileSync(path.join(TMP, `${key}.xlsx`), buf);
  f.bytes = buf.length;
  console.log(key, buf.length, f.label);
}
const manifest = { fetchedAt: new Date().toISOString(), report, tree: { page: tree.page }, files };
fs.writeFileSync(path.join(TMP, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.rmSync(OUT, { recursive: true, force: true });
fs.renameSync(TMP, OUT);
console.log(`取得しました：${Object.keys(files).length}ファイル → ${path.relative(ROOT, OUT)}`);
