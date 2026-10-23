// 公開データ → 静的サイト（dist/）を作る
// 使い方: node scripts/build.mjs   （先に bash scripts/fetch.sh でデータを取る）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadAll } from './lib/load.mjs';
import { buildModel } from './lib/model.mjs';
import { setAssetVersion, setBuildInfo, abs, hospitalPath, topicPath, diseasePath, prefPath, BASE } from './lib/html.mjs';
import { renderHospital } from './pages/hospital.mjs';
import { renderTopic, renderDisease, renderRankingIndex, renderDiseaseIndex } from './pages/ranking.mjs';
import { renderTop, renderPrefIndex, renderPref, renderAbout, renderSearch, render404 } from './pages/hubs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw', 'src');
const DIST = path.join(ROOT, 'dist');
const LIMIT = process.env.LIMIT ? +process.env.LIMIT : 0; // 試しに少ない件数で作るとき

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

const D = loadAll(RAW);
const M = buildModel(D);
log('loaded', D.hosp.size, 'hospitals,', M.diseases.length, 'diseases,', M.topics.length, 'topics');

const now = new Date();
const jst = new Date(now.getTime() + 9 * 3600e3);
const built = `${jst.getUTCFullYear()}年${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日`;
setBuildInfo({ built, manifest: D.manifest, period: M.period });

// ---- 出力 ----
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
const ASSETS_SRC = path.join(ROOT, 'src', 'assets');
fs.cpSync(ASSETS_SRC, path.join(DIST, 'assets'), { recursive: true });
// サイト直下に置くファイル（Search Console の確認ファイルなど）
if (fs.existsSync(path.join(ROOT, 'src', 'root'))) fs.cpSync(path.join(ROOT, 'src', 'root'), DIST, { recursive: true });
const hash = crypto.createHash('sha1');
for (const f of ['style.css', 'app.js']) hash.update(fs.readFileSync(path.join(ASSETS_SRC, f)));
setAssetVersion(hash.digest('hex').slice(0, 8));

let pages = 0;
let bytes = 0;
const urls = { hubs: [], hospitals: [] };
function write(p, html, kind = 'hubs', sitemap = true) {
  const file = p === '' ? path.join(DIST, 'index.html') : p.endsWith('.html') ? path.join(DIST, p) : path.join(DIST, p, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  pages++;
  bytes += Buffer.byteLength(html);
  if (sitemap) urls[kind].push(abs(p));
}

const ctx = { ...M, kname: D.tree.kname, mdcName: D.tree.mdc, manifest: D.manifest };

write('', renderTop(ctx));
write('ranking/', renderRankingIndex(ctx));
for (const t of M.topics) {
  write(topicPath(t), renderTopic(ctx, t));
  for (const p of t.prefPages) write(topicPath(t, p), renderTopic(ctx, t, p));
}
write('shippei/', renderDiseaseIndex(ctx));
for (const d of M.diseases) {
  if (d.topic) continue;
  write(diseasePath(d), renderDisease(ctx, d));
  for (const p of d.prefPages) write(diseasePath(d, p), renderDisease(ctx, d, p));
}
write('ken/', renderPrefIndex(ctx));
for (const p of M.prefs) write(prefPath(p), renderPref(ctx, p));
write('about/', renderAbout(ctx));
write('search/', renderSearch(ctx), 'hubs', false);
write('404.html', render404(ctx), 'hubs', false);
log('hub pages', pages);

const targets = LIMIT ? M.hospitals.slice(0, LIMIT) : M.hospitals;
for (const h of targets) write(hospitalPath(h), renderHospital(ctx, h), 'hospitals', h.index);
log('hospital pages', targets.length);

// 検索用の索引（入院患者数の多い順）：[告示番号, 正式名, 呼び名, 都道府県番号, 市区町村, 入院患者数]
const index = M.hospitals.map((h) => [h.id, h.name, h.short === h.name ? '' : h.short, h.pref || 0, h.city || '', h.stats.n || 0]);
fs.writeFileSync(path.join(DIST, 'assets', 'index.json'), JSON.stringify({ v: 1, built, prefs: ['', ...M.prefs.map((p) => p.name)], h: index }));

// サイトマップ
const lastmod = now.toISOString().slice(0, 10);
const smFiles = [];
const writeSitemap = (name, list) => {
  fs.writeFileSync(path.join(DIST, name), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${list.map((u) => `<url><loc>${u}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  smFiles.push(name);
};
writeSitemap('sitemap-hubs.xml', urls.hubs);
writeSitemap('sitemap-hospitals.xml', urls.hospitals);
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${smFiles.map((f) => `<sitemap><loc>${abs(f)}</loc><lastmod>${lastmod}</lastmod></sitemap>`).join('\n')}\n</sitemapindex>\n`);
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${abs('sitemap.xml')}\n`);
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

// 更新の記録（リポジトリに残す。GitHub の定期実行が止まらないようにする役目もある）
const summary = {
  built, base: BASE, report: D.manifest.report.title, reportUrl: D.manifest.report.url, notes: D.manifest.report.notes, period: M.period,
  tree: D.manifest.files.tree.date, pages, bytes, hospitals: M.totals.hospitals, indexedHospitals: M.totals.indexed, allHospitals: M.totals.all,
  diseases: M.diseases.length, topics: M.topics.length, patients: M.totals.patients,
};
if (process.env.GITHUB_ACTIONS === 'true' && !LIMIT) {
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'data', 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
}
log('done', summary);
