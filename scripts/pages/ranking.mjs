// 病気・手術ごとのランキング（トピック・病気）と、その一覧のページ
import { SITE_NAME, PREFS, REGIONS, MDC_SHORT, GROUP_INFO, GROUP_ORDER } from '../lib/meta.mjs';
import { TOPIC_GROUPS } from '../lib/topics.mjs';
import { esc, comma, fmt, pct, rangeText } from '../lib/format.mjs';
import { MIN_AREA } from '../lib/model.mjs';
import {
  layout, breadcrumbs, href, abs, topicPath, diseasePath, prefPath, hospitalPath, caution, shareButtons, numCell, losCell, hospitalCell, fyText, periodText,
} from '../lib/html.mjs';

const NAT_LIMIT = 100;

const isOps = (t) => t.mainKey !== 'patients';
const unitOf = (t) => (isOps(t) ? '件' : '人');
const metricWord = (t) => (isOps(t) ? '手術件数' : '入院患者数');
const topicTitleName = (t) => t.title || t.name;

// 都道府県の並び（地方ごと）。ページがある県はリンク
function prefChips(counts, pathOf, current) {
  return `<div class="chips-r">${REGIONS.map(([region, codes]) => `<div class="chips-g"><span class="chips-h">${esc(region)}</span><div class="chips">${codes.map((c) => {
    const p = PREFS[c - 1];
    const n = counts.get(c) || 0;
    if (current && current.code === c) return `<span class="chip on">${esc(p.short)}<small>${n}</small></span>`;
    return n >= MIN_AREA ? `<a class="chip" href="${href(pathOf(p))}">${esc(p.short)}<small>${n}</small></a>` : `<span class="chip off">${esc(p.short)}<small>${n || '—'}</small></span>`;
  }).join('')}</div></div>`).join('')}</div>
<p class="note">数字は件数が公表された病院の数です。病院が${MIN_AREA}か所以上ある都道府県にページがあります。</p>`;
}

// 少ない県の病院（ページを作らない県の分を、全国のページの下にまとめて載せる）
function fewList(byPref, get, unit = '件') {
  const items = [];
  for (const p of PREFS) {
    const list = byPref.get(p.code) || [];
    if (!list.length || list.length >= MIN_AREA) continue;
    items.push(`<li><b>${esc(p.name)}</b>：${list.map((r) => `<a href="${href(hospitalPath(r.h))}">${esc(r.h.short)}</a>（${esc(rangeText(get(r).v, get(r).m, unit))}）`).join('、')}</li>`);
  }
  return items.length ? `<section class="sec"><h2>公表された病院が${MIN_AREA}か所未満の都道府県</h2><ul class="ul few">${items.join('')}</ul></section>` : '';
}

// 「手術あり」（手術なし以外の区分の合計）。患者数で並べるトピックの表で使う
function opsOf(t, h, dis) {
  let v = 0;
  let m = 0;
  for (const c of t.codes) {
    const d = dis.get(c);
    const cells = h.dis.get(c);
    for (const b of d.branches) {
      if (b === '99') continue;
      const x = cells?.get(b);
      if (x?.n != null) v += x.n; else m++;
    }
  }
  return { v, m };
}

function topicTable(ctx, t, rows, { showPref }) {
  const ops = isOps(t);
  const heads = ['<th class="rk" data-sort="rank">順位</th>', '<th class="hn">病院</th>'];
  const cols = t.cols;
  cols.forEach((c, i) => heads.push(`<th class="n" data-sort="n">${esc(c.label)}${i === 0 && ops ? '<small>この列の多い順</small>' : ''}</th>`));
  heads.push(`<th class="n" data-sort="n">入院患者数${!ops ? '<small>この列の多い順</small>' : ''}</th>`);
  if (!cols.length) heads.push('<th class="n" data-sort="n">手術あり</th>');
  heads.push(`<th class="n" data-sort="n">平均在院日数<small>${ops ? esc(cols[0].label) : '入院患者全体'}</small></th>`);
  const maxes = cols.map((_, i) => Math.max(1, ...rows.map((r) => r.cols[i].v)));
  const maxP = Math.max(1, ...rows.map((r) => r.patients.v));
  const body = rows.map((r) => {
    const tds = [`<td class="rk" data-v="${r.rank}">${r.rank}</td>`, `<td class="hn">${hospitalCell(r.h, { pref: showPref })}</td>`];
    cols.forEach((_, i) => tds.push(numCell(r.cols[i], maxes[i], { bar: true })));
    tds.push(numCell(r.patients, maxP, { bar: !ops }));
    if (!cols.length) tds.push(numCell(opsOf(t, r.h, ctx.dis), 0, { bar: false }));
    tds.push(losCell(ops ? r.cols[0].los : r.patients.los));
    return `<tr>${tds.join('')}</tr>`;
  }).join('\n');
  return `<div class="tw"><table class="rt has-rk sortable"><thead><tr>${heads.join('')}</tr></thead><tbody>
${body}
</tbody></table></div>
<p class="note">「〜」の付いた数は、10件未満のため公表されていない区分があり、その分を0件〜9件として見た幅です。順位は公表された件数（幅の小さい方）の多い順です。表の見出しを押すと並べ替えられます。</p>`;
}

// 数えている手術（電子点数表の術式名をそのまま出す）
function definitions(ctx, t) {
  if (!t.cols.length) return '';
  const blocks = t.cols.map((col) => {
    const items = [];
    for (const [code, bs] of col.cells) {
      const d = ctx.dis.get(code);
      for (const b of bs) {
        const procs = d.procs.get(b);
        const names = procs.length ? procs.map((o) => `${esc(o.name)}${o.with.length ? `＋${esc(o.with.join('＋'))}` : ''} <small>${esc(o.k)}</small>`) : [b === '97' ? (d.generic ? 'この病気で行われたすべての手術' : 'その他の手術') : '—'];
        items.push(`<li><span class="def-h">${esc(d.name)}・区分${esc(b)}</span><ul>${names.map((n) => `<li>${n}</li>`).join('')}</ul></li>`);
      }
    }
    const nat = t.natCols[t.cols.indexOf(col)];
    return `<div class="def"><h3>${esc(col.label)}<small>全国 ${comma(nat.n)}件</small></h3><p>${esc(col.desc)}</p><details><summary>含まれる術式（電子点数表の名前）</summary><ul class="def-l">${items.join('')}</ul></details></div>`;
  }).join('');
  return `<section class="card"><h2>数えている手術</h2><p class="note">DPC（診断群分類）では、病気ごとに手術を「区分」に分けています。このページの各列は、次の区分の件数を足したものです。</p>${blocks}</section>`;
}

// 全国の患者の特徴（診断群分類ごとの集計を病気ごとに足したもの）
const AGES = ['0〜2歳', '3〜5歳', '6〜15歳', '16〜20歳', '21〜40歳', '41〜60歳', '61〜79歳', '80歳以上'];
export function profileBlock(ctx, codes) {
  const ps = codes.map((c) => ctx.dis.get(c)?.profile).filter(Boolean);
  if (!ps.length) return '';
  const n = ps.reduce((s, p) => s + p.n, 0);
  if (!n) return '';
  const male = ps.reduce((s, p) => s + p.male, 0) / n;
  const ages = AGES.map((_, i) => ps.reduce((s, p) => s + p.ages[i], 0) / n);
  const o65 = ps.reduce((s, p) => s + p.over65, 0) / n;
  const amb = ps.reduce((s, p) => s + p.amb, 0) / n;
  const los = ps.reduce((s, p) => s + p.losSum, 0) / n;
  const k = new Map();
  for (const p of ps) for (const [code, x] of p.k) k.set(code, (k.get(code) || 0) + x);
  const topK = [...k.entries()].filter(([code]) => ctx.kname.get(code)).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxA = Math.max(...ages);
  return `<section class="card"><h2>全国の患者の特徴</h2>
<ul class="kv">
<li><span>全国の入院患者</span><b>${comma(n)}人</b></li>
<li><span>男性の割合</span><b>${pct(male)}</b></li>
<li><span>65歳以上の割合</span><b>${pct(o65)}</b></li>
<li><span>救急車で運ばれた割合</span><b>${pct(amb)}</b></li>
<li><span>平均在院日数</span><b>${fmt(los)}日</b></li>
</ul>
<h3>年齢の分布</h3>
<div class="hbar">${AGES.map((a, i) => `<div class="hbar-r"><span>${a}</span><i style="width:${Math.max(0.5, (ages[i] / maxA) * 100).toFixed(1)}%"></i><b>${pct(ages[i])}</b></div>`).join('')}</div>
${topK.length ? `<h3>全国で多かった手術</h3><ol class="kl">${topK.map(([code, x]) => `<li>${esc(ctx.kname.get(code))} <small>${esc(code)}</small><b>${comma(x)}件</b></li>`).join('')}</ol><p class="note">診断群分類ごとに国が公表している「件数の多い手術 上位10」を足した値です。上位に入らなかった分は含まれないため、実際より少ないことがあります。</p>` : ''}
<p class="note">出典の「診断群分類毎の集計」（全病院）から作成。</p></section>`;
}

function relatedTopics(ctx, t, pref) {
  const same = ctx.topics.filter((x) => x !== t && x.group === t.group);
  const links = same.map((x) => {
    const has = !pref || x.prefPages.some((p) => p.code === pref.code);
    return `<a class="chip" href="${href(topicPath(x, has ? pref : null))}">${esc(x.name)}</a>`;
  }).join('');
  return links ? `<section class="sec"><h2>同じ分野の${pref ? `${esc(pref.name)}の` : ''}ランキング</h2><div class="chips">${links}</div></section>` : '';
}

export function renderTopic(ctx, t, pref = null) {
  const fy = fyText();
  const name = t.name; // 見出し・タイトルは短い名前（説明つきの名前は一覧で使う）
  const word = metricWord(t);
  const rows = pref ? t.byPref.get(pref.code) || [] : t.listed.slice(0, NAT_LIMIT);
  const top = rows[0];
  const mainOf = (r) => t.main(r);
  const bcItems = [['トップ', ''], ['病気・手術から探す', 'ranking/'], [t.name, pref ? topicPath(t) : null]];
  if (pref) bcItems.push([pref.name, null]);
  const bc = breadcrumbs(bcItems);
  const where = pref ? pref.name : '全国';
  const h1 = `${name}の${word} ${pref ? `${pref.name}の病院` : '病院'}ランキング${pref ? '' : '（全国）'}`;
  const mainLabel = isOps(t) ? t.cols[0].label : '入院患者数';
  const sumPref = pref ? rows.reduce((s, r) => s + mainOf(r).v, 0) : 0;
  const lead = pref
    ? `${esc(periodText())}に${esc(pref.name)}の病院を退院した${esc(t.name)}の患者について、病院ごとの${esc(word)}を国のDPC公開データからまとめました。件数が公表された病院は${comma(rows.length)}か所${isOps(t) ? `、${esc(mainLabel)}の公表分の合計は${comma(sumPref)}件` : ''}です。${top ? `最も多かったのは${esc(top.h.short)}（${esc(rangeText(mainOf(top).v, mainOf(top).m, unitOf(t)))}）でした。` : ''}`
    : `${esc(periodText())}に退院した${esc(t.name)}の患者について、病院ごとの${esc(word)}を国のDPC公開データからまとめました。全国で件数が公表された病院は${comma(t.listed.length)}か所です。${top ? `最も多かったのは${esc(top.h.short)}（${esc(top.h.prefInfo?.name || '')}、${esc(rangeText(mainOf(top).v, mainOf(top).m, unitOf(t)))}）でした。` : ''}`;
  const kpis = pref ? '' : `<section class="card kpis"><h2 class="vh">全国の件数</h2><ul class="kpi">${t.cols.map((c, i) => `<li><span>${esc(c.label)}</span><b>${comma(t.natCols[i].n)}<small>件</small></b></li>`).join('')}<li><span>入院した患者</span><b>${comma(t.natPatients)}<small>人</small></b></li><li><span>件数が公表された病院</span><b>${comma(t.listed.length)}<small>か所</small></b></li></ul><p class="note">全国の件数は国が公表した合計で、10件未満の病院の分も含みます（${esc(fy)}）。</p></section>`;
  const counts = new Map([...t.byPref].map(([c, l]) => [c, l.length]));
  const table = rows.length ? topicTable(ctx, t, rows, { showPref: !pref }) : '<p>件数が公表された病院はありません。</p>';
  const tableH = pref ? `${esc(pref.name)}の病院（${esc(mainLabel)}の多い順）` : `${esc(mainLabel)}の多い病院（全国 上位${Math.min(NAT_LIMIT, rows.length)}）`;
  const notes = `<section class="card"><h2>このページの数字について</h2><ul class="ul">
<li>対象：国のDPC調査に参加した病院（DPC対象病院、DPC準備病院、データを提出している出来高算定病院）を${esc(periodText())}に退院した患者です。入院した病院の所在地で数えています（患者の住所ではありません）。</li>
<li>入院が1日以内の患者、入院から24時間以内に亡くなった患者、臓器移植を受けた患者、自費の患者などは国の集計の対象外です。</li>
<li>病院ごとの件数は、10件未満の区分が「－」で伏せられています。このため、件数が10件に満たない病院は一覧に出ないことがあります。</li>
<li>手術の件数は「その手術を受けて退院した患者の数」です（同じ入院で同じ区分の手術を2回受けても1件）。</li>
</ul></section>`;
  const body = `${bc.html}
<header class="ph"><p class="eyebrow">${esc(fy)}・国のDPC公開データ</p><h1>${esc(h1)}</h1><p class="lead">${lead}</p>${t.note ? `<p class="official">${esc(t.note)}</p>` : ''}</header>
${caution('rank')}
${kpis}
<section class="sec"><h2>${tableH}</h2>${table}</section>
${pref ? '' : fewList(t.byPref, mainOf, unitOf(t))}
<section class="sec"><h2>都道府県ごとに見る</h2>${prefChips(counts, (p) => topicPath(t, p), pref)}${pref ? `<p><a href="${href(topicPath(t))}">全国のランキングを見る</a></p>` : ''}</section>
${definitions(ctx, t)}
${pref ? '' : profileBlock(ctx, t.codes)}
${relatedTopics(ctx, t, pref)}
${notes}
${shareButtons(abs(topicPath(t, pref)), `${name}の${word}ランキング（${where}・${fy}）`)}`;
  const topText = top ? `最多は${top.h.short}（${rangeText(mainOf(top).v, mainOf(top).m, unitOf(t))}）。` : '';
  const title = pref ? `${name}の${word} ${pref.name}の病院ランキング【${fy}】｜${SITE_NAME}` : `${name}の${word}ランキング 全国の病院【${fy}】｜${SITE_NAME}`;
  const description = `${name}の${word}を、厚生労働省のDPC公開データ（${periodText()}退院）から${where}の病院ごとに一覧にしました。${topText}${t.cols.map((c) => c.label).join('・')}${t.cols.length ? '、' : ''}入院患者数、平均在院日数を比べられます。`;
  const ld = [bc.ld];
  if (rows.length) {
    ld.push({ '@type': 'ItemList', name: h1, itemListOrder: 'https://schema.org/ItemListOrderDescending', numberOfItems: rows.length, itemListElement: rows.slice(0, 20).map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(hospitalPath(r.h)), name: r.h.short })) });
  }
  return layout({ title, description, path: topicPath(t, pref), body, ld });
}

// ---- 病気（トピックにしていないもの） ----
function diseaseTable(rows, { showPref }) {
  const maxP = Math.max(1, ...rows.map((r) => r.total.v));
  const body = rows.map((r) => `<tr><td class="rk" data-v="${r.rank}">${r.rank}</td><td class="hn">${hospitalCell(r.h, { pref: showPref })}</td>${numCell(r.total, maxP)}${numCell(r.ops, 0, { bar: false })}${losCell(r.los)}</tr>`).join('\n');
  return `<div class="tw"><table class="rt has-rk sortable"><thead><tr><th class="rk" data-sort="rank">順位</th><th class="hn">病院</th><th class="n" data-sort="n">入院患者数<small>この列の多い順</small></th><th class="n" data-sort="n">手術あり</th><th class="n" data-sort="n">平均在院日数</th></tr></thead><tbody>
${body}
</tbody></table></div>
<p class="note">「〜」の付いた数は、10件未満のため公表されていない区分があり、その分を0件〜9件として見た幅です。「手術あり」は手術なし以外の区分の合計で、病気の治療と直接関係しない手術（輸血以外の処置など）を含むことがあります。</p>`;
}

function branchTable(ctx, d) {
  const rows = d.branches.map((b) => {
    const x = d.nat.get(b);
    const procs = d.procs.get(b);
    const list = procs.length ? `<details><summary>術式（${procs.length}）</summary><ul class="def-l">${procs.map((o) => `<li>${esc(o.name)}${o.with.length ? `＋${esc(o.with.join('＋'))}` : ''} <small>${esc(o.k)}</small></li>`).join('')}</ul></details>` : '';
    return `<tr><th>${esc(d.labels.get(b))}<small>区分${esc(b)}</small>${list}</th><td class="n">${comma(x?.n || 0)}</td><td class="n">${x?.los != null ? fmt(x.los) : '—'}</td></tr>`;
  }).join('');
  return `<div class="tw"><table class="dt"><thead><tr><th>手術の区分</th><th class="n">全国の件数</th><th class="n">平均在院日数</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function renderDisease(ctx, d, pref = null) {
  const fy = fyText();
  const rows = pref ? d.byPref.get(pref.code) || [] : d.listed.slice(0, NAT_LIMIT);
  const top = rows[0];
  const bcItems = [['トップ', ''], ['すべての病気', 'shippei/'], [d.name, pref ? diseasePath(d) : null]];
  if (pref) bcItems.push([pref.name, null]);
  const bc = breadcrumbs(bcItems);
  const where = pref ? pref.name : '全国';
  const h1 = `${d.name}の入院患者数・手術件数 ${pref ? `${pref.name}の病院` : '病院'}ランキング${pref ? '' : '（全国）'}`;
  const lead = `${esc(periodText())}に${pref ? `${esc(pref.name)}の病院を` : ''}退院した「${esc(d.name)}」（${esc(MDC_SHORT[d.mdc])}の病気）の患者数を、病院ごとに国のDPC公開データからまとめました。件数が公表された病院は${comma(pref ? rows.length : d.listed.length)}か所です。${top ? `最も多かったのは${esc(top.h.short)}（${esc(rangeText(top.total.v, top.total.m, '人'))}）でした。` : ''}`;
  const counts = new Map([...d.byPref].map(([c, l]) => [c, l.length]));
  const topicLinks = (d.topics || []).map((t) => `<a class="chip" href="${href(topicPath(t, pref && t.prefPages.some((p) => p.code === pref.code) ? pref : null))}">${esc(t.name)}のランキング</a>`).join('');
  const body = `${bc.html}
<header class="ph"><p class="eyebrow">${esc(fy)}・国のDPC公開データ</p><h1>${esc(h1)}</h1><p class="lead">${lead}</p></header>
${caution('rank')}
${pref ? '' : `<section class="card kpis"><ul class="kpi"><li><span>全国の入院患者</span><b>${comma(d.natTotal)}<small>人</small></b></li><li><span>手術あり</span><b>${comma(d.natOps)}<small>人</small></b></li><li><span>件数が公表された病院</span><b>${comma(d.listed.length)}<small>か所</small></b></li></ul></section>`}
${topicLinks ? `<section class="sec"><h2>関連するランキング</h2><div class="chips">${topicLinks}</div></section>` : ''}
<section class="sec"><h2>${pref ? `${esc(pref.name)}の病院（入院患者数の多い順）` : `入院患者数の多い病院（全国 上位${Math.min(NAT_LIMIT, rows.length)}）`}</h2>${rows.length ? diseaseTable(rows, { showPref: !pref }) : '<p>件数が公表された病院はありません。</p>'}</section>
${pref ? '' : fewList(d.byPref, (r) => r.total, '人')}
<section class="sec"><h2>都道府県ごとに見る</h2>${prefChips(counts, (p) => diseasePath(d, p), pref)}${pref ? `<p><a href="${href(diseasePath(d))}">全国のランキングを見る</a></p>` : ''}</section>
${pref ? '' : `<section class="card"><h2>手術の区分ごとの全国の件数</h2>${branchTable(ctx, d)}<p class="note">区分の名前は、電子点数表に載っている術式のうち全国で件数の多いものから付けています。</p></section>`}
${pref ? '' : profileBlock(ctx, [d.code])}
<section class="card"><h2>このページの数字について</h2><ul class="ul">
<li>病気は、入院中に最も医療資源を使った病名で分類しています（DPCの診断群分類の頭6桁「${esc(d.code)}」）。</li>
<li>対象は国のDPC調査に参加した病院を${esc(periodText())}に退院した患者で、入院した病院の所在地で数えています。入院が1日以内の患者などは国の集計の対象外です。</li>
<li>病院ごとの件数は、10件未満の区分が「－」で伏せられています。</li>
</ul></section>
${shareButtons(abs(diseasePath(d, pref)), `${d.name}の入院患者数ランキング（${where}・${fy}）`)}`;
  const title = pref ? `${d.name}の入院患者数 ${pref.name}の病院ランキング【${fy}】｜${SITE_NAME}` : `${d.name}の入院患者数・手術件数ランキング【${fy}】｜${SITE_NAME}`;
  const description = `「${d.name}」で入院した患者の数と手術の件数を、厚生労働省のDPC公開データ（${periodText()}退院）から${where}の病院ごとに一覧にしました。${top ? `最多は${top.h.short}（${rangeText(top.total.v, top.total.m, '人')}）。` : ''}`;
  return layout({ title, description, path: diseasePath(d, pref), body, ld: [bc.ld] });
}

// ---- 一覧 ----
export function renderRankingIndex(ctx) {
  const fy = fyText();
  const bc = breadcrumbs([['トップ', ''], ['病気・手術から探す', null]]);
  const groups = TOPIC_GROUPS.map((g) => {
    const ts = ctx.topics.filter((t) => t.group === g);
    if (!ts.length) return '';
    return `<section class="sec"><h2>${esc(g)}</h2><ul class="tl">${ts.map((t) => {
      const c = isOps(t) ? `${esc(t.cols[0].label)} 全国${comma(t.natCols[0].n)}件` : `入院患者 全国${comma(t.natPatients)}人`;
      return `<li><a href="${href(topicPath(t))}"><b>${esc(topicTitleName(t))}</b><small>${c}・${comma(t.listed.length)}病院</small></a></li>`;
    }).join('')}</ul></section>`;
  }).join('');
  const body = `${bc.html}
<header class="ph"><h1>病気・手術から探す</h1><p class="lead">よく調べられている病気・手術について、病院ごとの件数を全国と都道府県別のランキングにしています（${esc(fy)}、${esc(periodText())}退院）。ほかの病気は<a href="${href('shippei/')}">すべての病気の一覧</a>から探せます。</p></header>
${caution('rank')}
${groups}`;
  return layout({ title: `病気・手術から探す 手術件数ランキング一覧【${fy}】｜${SITE_NAME}`, description: `胃がん・大腸がん・乳がん・人工膝関節・カテーテルアブレーション・白内障など、病気や手術ごとの病院の手術件数ランキング（全国・都道府県別）の一覧です。厚生労働省のDPC公開データ（${periodText()}退院）から作成。`, path: 'ranking/', body, ld: [bc.ld] });
}

export function renderDiseaseIndex(ctx) {
  const fy = fyText();
  const bc = breadcrumbs([['トップ', ''], ['すべての病気', null]]);
  const byMdc = new Map();
  for (const d of ctx.diseases) (byMdc.get(d.mdc) || byMdc.set(d.mdc, []).get(d.mdc)).push(d);
  const toc = [...byMdc.keys()].sort().map((m) => `<a class="chip" href="#mdc${m}">${esc(MDC_SHORT[m])}</a>`).join('');
  const sections = [...byMdc.keys()].sort().map((m) => {
    const list = byMdc.get(m).sort((a, b) => b.natTotal - a.natTotal);
    return `<section class="sec" id="mdc${m}"><h2>${esc(MDC_SHORT[m])}<small>${esc(ctx.mdcName.get(m) || '')}</small></h2><ul class="tl tl-s">${list.map((d) => `<li><a href="${href(diseasePath(d))}"><b>${esc(d.alias && d.alias !== d.name ? `${d.alias}（${d.name}）` : d.name)}</b><small>全国${comma(d.natTotal)}人・${comma(d.listed.length)}病院</small></a></li>`).join('')}</ul></section>`;
  }).join('');
  const body = `${bc.html}
<header class="ph"><h1>すべての病気から探す</h1><p class="lead">DPC（診断群分類）の病気ごとに、入院患者数と手術件数の多い病院を一覧にしています。全${ctx.diseases.length}分類（${esc(fy)}）。</p></header>
<div class="chips toc">${toc}</div>
${sections}
<p class="note">病気の名前は国の分類（診断群分類の頭6桁）の名前です。ふだんの呼び名でランキングにしているものは、そのページにつながります。</p>`;
  return layout({ title: `すべての病気から探す 入院患者数・手術件数【${fy}】｜${SITE_NAME}`, description: `DPC（診断群分類）の${ctx.diseases.length}の病気ごとに、入院患者数・手術件数の多い病院を全国・都道府県別に一覧にしました。厚生労働省のDPC公開データから作成。`, path: 'shippei/', body, ld: [bc.ld] });
}

export { GROUP_INFO, GROUP_ORDER };
