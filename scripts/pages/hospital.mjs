// 病院のページ
import { SITE_NAME, MDC_SHORT, GROUP_INFO } from '../lib/meta.mjs';
import { esc, comma, fmt, pct, rangeText, safeUrl } from '../lib/format.mjs';
import {
  layout, breadcrumbs, href, abs, hospitalPath, topicPath, diseasePath, prefPath, caution, shareButtons, numCell, losCell, fyText, periodText,
} from '../lib/html.mjs';

const perMonth = (v) => (v == null ? '—' : `${fmt(v, 1)}人/月`);

function kpis(h, med) {
  const s = h.stats;
  const g = GROUP_INFO[h.group];
  const items = [
    ['入院患者数', s.n != null ? `${comma(s.n)}<small>人</small>` : '—', med.n != null ? `${comma(med.n)}人` : '', s.n0 != null ? `前年度 ${comma(s.n0)}人` : ''],
    ['手術を受けた人', s.ope != null ? `${comma(s.ope)}<small>人</small>` : '—', med.ope != null ? `${comma(med.ope)}人` : '', s.n ? `患者の${pct(s.ope / s.n, 0)}` : ''],
    ['全身麻酔', s.anes != null ? `${comma(s.anes)}<small>件</small>` : '—', med.anes != null ? `${comma(med.anes)}件` : '', ''],
    ['化学療法（がんの薬）', s.chemo != null ? `${comma(s.chemo)}<small>人</small>` : '—', med.chemo != null ? `${comma(med.chemo)}人` : '', ''],
    ['放射線療法', s.radio != null ? `${comma(s.radio)}<small>人</small>` : '—', med.radio != null ? `${comma(med.radio)}人` : '', ''],
    ['救急車で運ばれて入院', s.ambMonth != null ? `${fmt(s.ambMonth, 1)}<small>人/月</small>` : '—', med.ambMonth != null ? perMonth(med.ambMonth) : '', s.ambMonth0 != null ? `前年度 ${perMonth(s.ambMonth0)}` : ''],
    ['救急医療入院', s.emgMonth != null ? `${fmt(s.emgMonth, 1)}<small>人/月</small>` : '—', med.emgMonth != null ? perMonth(med.emgMonth) : '', ''],
    ['ほかの病院・診療所からの紹介', s.refRate != null ? pct(s.refRate) : '—', med.refRate != null ? pct(med.refRate) : '', ''],
    ['平均在院日数', s.los != null ? `${fmt(s.los)}<small>日</small>` : '—', med.los != null ? `${fmt(med.los)}日` : '', s.los0 != null ? `前年度 ${fmt(s.los0)}日` : ''],
    ['自宅へ退院した割合', s.home != null ? pct(s.home) : '—', med.home != null ? pct(med.home) : '', ''],
  ];
  return `<section class="card"><h2>${esc(fyText())}の主な数字</h2><ul class="kpi kpi-h">${items.map(([k, v, m, x]) => `<li><span>${esc(k)}</span><b>${v}</b>${m ? `<small>同じ類型の中央値 ${m}</small>` : ''}${x ? `<small>${x}</small>` : ''}</li>`).join('')}</ul>
<p class="note">「同じ類型の中央値」は、${esc(g.name)}（${comma(med.count)}病院）の真ん中の値です。入院患者数・手術などは、国のDPC調査の対象になった入院（一般病棟）だけを数えています。救急車・救急医療入院・紹介は、自宅や施設、ほかの病院から入院した患者についての数です。</p></section>`;
}

function badges(h) {
  const list = (h.badges || []).filter((b) => b.rank <= 10 || b.rank / b.of <= 0.2).slice(0, 10);
  if (!list.length) return '';
  const p = h.prefInfo;
  return `<section class="sec"><h2>${esc(p?.name || '')}内で件数の多い分野</h2><ul class="bdg">${list.map((b) => {
    const label = b.t.mainKey === 'patients' ? `${b.t.name}の入院患者数` : `${b.t.name}：${b.t.cols[0].label}`;
    const link = href(topicPath(b.t, b.hasPage ? p : null));
    return `<li><a href="${link}"><span>${esc(label)}</span><b>${b.rank}位<small>/${b.of}病院</small></b><small>${esc(rangeText(b.v.v, b.v.m, b.t.mainKey === 'patients' ? '人' : '件'))}</small></a></li>`;
  }).join('')}</ul><p class="note">${esc(p?.name || '')}内で件数が公表された病院の中での順位です（件数の多い順に並べたもので、病院の評価ではありません）。</p></section>`;
}

function diseaseRows(ctx, h) {
  if (!h.rows.length) return '<p>病気ごとの件数は公表されていません（10件未満の区分は国が公表していないため）。</p>';
  const p = h.prefInfo;
  const max = Math.max(1, ...h.rows.map((r) => r.total.v));
  const body = h.rows.map((r) => {
    const d = r.d;
    const hasPref = p && (d.topic ? d.topic.prefPages.some((x) => x.code === p.code) : d.prefPages.some((x) => x.code === p.code));
    const parts = d.branches.filter((b) => r.cells.get(b)?.n != null).map((b) => `${esc(d.labels.get(b))} ${comma(r.cells.get(b).n)}`);
    const name = d.alias && d.alias !== d.name ? `${esc(d.alias)}<small class="off">（${esc(d.name)}）</small>` : esc(d.name);
    return `<tr><td class="hn"><a href="${href(diseasePath(d, hasPref ? p : null))}">${name}</a><small class="br">${parts.join('・')}</small></td>${numCell(r.total, max)}${numCell(r.ops, 0, { bar: false })}${losCell(r.los)}</tr>`;
  }).join('\n');
  return `<div class="tw"><table class="rt sortable"><thead><tr><th class="hn">病気（国の分類）</th><th class="n" data-sort="n">入院患者数</th><th class="n" data-sort="n">手術あり</th><th class="n" data-sort="n">平均在院日数</th></tr></thead><tbody>
${body}
</tbody></table></div>
<p class="note">病気の下の小さな字は手術の区分ごとの件数です（10件未満の区分は載っていません）。「〜」の付いた数は、伏せられた区分を0件〜9件として見た幅です。</p>`;
}

function mdcTable(h) {
  if (!h.mdc) return '';
  const rows = h.mdc.map((x, i) => ({ x, code: String(i + 1).padStart(2, '0') })).filter(({ x }) => x.op != null || x.no != null);
  if (!rows.length) return '';
  const cell = (v) => (v == null ? '<td class="n">—</td>' : `<td class="n">${comma(v)}</td>`);
  return `<section class="sec"><h2>分野ごとの入院患者数</h2><div class="tw"><table class="dt"><thead><tr><th>分野（主要診断群）</th><th class="n">手術あり</th><th class="n">手術なし</th></tr></thead><tbody>${rows.map(({ x, code }) => `<tr><th>${esc(MDC_SHORT[code])}</th>${cell(x.op)}${cell(x.no)}</tr>`).join('')}</tbody></table></div><p class="note">「—」は10件未満または0件で、国が公表していない区分です。</p></section>`;
}

function basics(h) {
  const g = GROUP_INFO[h.group];
  const b = h.beds;
  const bedRows = [['DPCの対象の病床', b.dpc], ['回復期リハビリテーション病棟など', b.kaifuku], ['地域包括ケア病棟', b.chiiki], ['地域包括医療病棟', b.chiikiIryo], ['精神病床', b.seishin], ['療養病床', b.ryoyo], ['結核病床', b.kekkaku]]
    .filter(([, v]) => v).map(([k, v]) => `<li><span>${esc(k)}</span><b>${comma(v)}床</b></li>`).join('');
  const shihyo = safeUrl(h.urls.shihyo);
  const qi = safeUrl(h.urls.qi);
  const links = [shihyo ? `<a href="${esc(shihyo)}" rel="nofollow noopener" target="_blank">病院が公開している「病院指標」</a>` : '', qi && qi !== shihyo ? `<a href="${esc(qi)}" rel="nofollow noopener" target="_blank">「医療の質指標」</a>` : ''].filter(Boolean).join('・');
  return `<section class="card"><h2>病院の基本情報</h2>
<dl class="dl">
<div><dt>正式名</dt><dd>${esc(h.name)}</dd></div>
<div><dt>所在地</dt><dd>${esc(h.prefInfo?.name || '')}${esc(h.city || '')}</dd></div>
<div><dt>類型</dt><dd>${esc(g.name)}<small>${esc(g.desc)}</small></dd></div>
${h.kind ? `<div><dt>DPC調査への参加</dt><dd>${esc(h.kind)}</dd></div>` : ''}
${b.total ? `<div><dt>病床数</dt><dd>${comma(b.total)}床</dd></div>` : ''}
${h.fee ? `<div><dt>DPCの病床の入院基本料</dt><dd>${esc(h.fee)}</dd></div>` : ''}
${h.months != null && h.months < 12 ? `<div><dt>データの期間</dt><dd>${h.months}か月分（年度の途中から、または途中までのデータです）</dd></div>` : ''}
<div><dt>告示番号</dt><dd>${esc(h.id)}</dd></div>
</dl>
${bedRows ? `<ul class="kv">${bedRows}</ul>` : ''}
${h.notes.length ? `<p class="note">合併・分割：${h.notes.map(esc).join(' ')}</p>` : ''}
${links ? `<p>${links}（病院のサイトへ移動します）</p>` : ''}
</section>`;
}

function nearby(ctx, h) {
  const same = ctx.hospitals.filter((x) => x !== h && x.muni && h.muni && x.muni === h.muni && x.index).slice(0, 8);
  const pref = ctx.hospitals.filter((x) => x !== h && x.pref === h.pref && x.index && !same.includes(x)).slice(0, 12 - same.length);
  const li = (x) => `<li><a href="${href(hospitalPath(x))}">${esc(x.short)}<small>${esc(x.city || '')}・入院患者${comma(x.stats.n)}人</small></a></li>`;
  return `<section class="sec"><h2>近くの病院</h2>${same.length ? `<h3>${esc(h.city || '')}</h3><ul class="cl">${same.map(li).join('')}</ul>` : ''}${pref.length ? `<h3>${esc(h.prefInfo?.name || '')}の入院患者数の多い病院</h3><ul class="cl">${pref.map(li).join('')}</ul>` : ''}${h.prefInfo ? `<p><a href="${href(prefPath(h.prefInfo))}">${esc(h.prefInfo.name)}の病院をすべて見る</a></p>` : ''}</section>`;
}

function qa(h) {
  const s = h.stats;
  const top = h.rows.slice(0, 3);
  const items = [];
  if (s.ope != null) items.push([`${h.short}の手術件数は？`, `${fyText()}（${periodText()}に退院）の国のDPCデータでは、手術を受けて退院した患者は${comma(s.ope)}人${s.anes != null ? `、全身麻酔は${comma(s.anes)}件` : ''}でした。`]);
  if (top.length) items.push([`${h.short}で入院患者が多い病気は？`, `入院患者数が多い病気は、${top.map((r, i) => `${i + 1}位「${r.d.alias || r.d.name}」（${rangeText(r.total.v, r.total.m, '人')}）`).join('、')}でした。`]);
  if (s.los != null) items.push([`${h.short}の平均在院日数は？`, `${fmt(s.los)}日でした${s.los0 != null ? `（前年度は${fmt(s.los0)}日）` : ''}。在院日数は病気や手術の種類、転院の有無などで大きく変わるため、短いほど良いとは限りません。`]);
  if (!items.length) return '';
  return `<section class="card faq"><h2>よくある質問</h2>${items.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}</section>`;
}

export function renderHospital(ctx, h) {
  const fy = fyText();
  const p = h.prefInfo;
  const g = GROUP_INFO[h.group];
  const med = ctx.groupMedian[h.group];
  const bcItems = [['トップ', ''], ['都道府県から探す', 'ken/']];
  if (p) bcItems.push([p.name, prefPath(p)]);
  bcItems.push([h.short, null]);
  const bc = breadcrumbs(bcItems);
  const s = h.stats;
  const where = `${p?.name || ''}${h.city || ''}`;
  const lead = s.n != null
    ? `${esc(periodText())}にこの病院を退院した患者（国のDPC調査の対象）は${comma(s.n)}人で、そのうち手術を受けた人は${comma(s.ope ?? 0)}人でした。病気ごとの入院患者数・手術件数と、救急車での搬送、平均在院日数などを、国の公開データからまとめています。`
    : '国のDPC調査の公開データから、病気ごとの入院患者数・手術件数をまとめています。';
  const body = `${bc.html}
<header class="ph"><p class="eyebrow">${esc(where)}・${esc(g.short)}</p><h1>${esc(h.short)}の手術件数・入院患者数</h1>${h.short !== h.name ? `<p class="official">正式名：${esc(h.name)}</p>` : ''}<p class="lead">${lead}</p></header>
${caution('hospital')}
${kpis(h, med)}
${badges(h)}
<section class="sec"><h2>病気ごとの入院患者数と手術件数</h2>${diseaseRows(ctx, h)}</section>
${mdcTable(h)}
${qa(h)}
${basics(h)}
${nearby(ctx, h)}
${shareButtons(abs(hospitalPath(h)), `${h.short}の手術件数・入院患者数（${fy}）`)}`;
  const title = `${h.short}の手術件数・入院患者数【${fy}】${where}｜${SITE_NAME}`;
  const description = `${h.name}（${where}）の${fy}の入院患者数${s.n != null ? `${comma(s.n)}人` : ''}、手術${s.ope != null ? `${comma(s.ope)}人` : ''}、全身麻酔${s.anes != null ? `${comma(s.anes)}件` : ''}。病気ごとの患者数・手術件数、平均在院日数、救急車での搬送を国のDPC公開データで見られます。`;
  return layout({ title, description, path: hospitalPath(h), body, ld: [bc.ld], noindex: !h.index });
}
