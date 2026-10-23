// トップ・都道府県・このサイトについて・検索・404
import { SITE_NAME, TAGLINE, OPERATOR, OPERATOR_ID, CONTACT, PREFS, REGIONS, GROUP_INFO, GROUP_ORDER, TREE_NAME, CITY_NAME } from '../lib/meta.mjs';
import { TOPIC_GROUPS } from '../lib/topics.mjs';
import { esc, comma, fmt, rangeText } from '../lib/format.mjs';
import {
  layout, breadcrumbs, href, abs, hospitalPath, topicPath, diseasePath, prefPath, caution, numCell, losCell, fyText, periodText, buildInfo,
} from '../lib/html.mjs';

const isOps = (t) => t.mainKey !== 'patients';

function topicCards(ctx, pref = null) {
  return TOPIC_GROUPS.map((g) => {
    const ts = ctx.topics.filter((t) => t.group === g);
    const li = ts.map((t) => {
      if (pref) {
        const list = t.byPref.get(pref.code) || [];
        if (!list.length) return '';
        const top = list[0];
        const has = list.length >= 3;
        const v = t.main(top);
        return `<li><a href="${href(topicPath(t, has ? pref : null))}"><b>${esc(t.name)}</b><small>${comma(list.length)}病院・最多 ${esc(top.h.short)}（${esc(rangeText(v.v, v.m, isOps(t) ? '件' : '人'))}）</small></a></li>`;
      }
      const c = isOps(t) ? `${esc(t.cols[0].label)} 全国${comma(t.natCols[0].n)}件` : `入院患者 全国${comma(t.natPatients)}人`;
      return `<li><a href="${href(topicPath(t))}"><b>${esc(t.name)}</b><small>${c}</small></a></li>`;
    }).join('');
    return li ? `<div class="tg"><h3>${esc(g)}</h3><ul class="tl">${li}</ul></div>` : '';
  }).join('');
}

function prefGrid(ctx) {
  return `<div class="chips-r">${REGIONS.map(([region, codes]) => `<div class="chips-g"><span class="chips-h">${esc(region)}</span><div class="chips">${codes.map((c) => {
    const p = ctx.prefs[c - 1];
    return `<a class="chip" href="${href(prefPath(p))}">${esc(p.short)}<small>${p.hospitals.length}</small></a>`;
  }).join('')}</div></div>`).join('')}</div>`;
}

export function renderTop(ctx) {
  const fy = fyText();
  const t = ctx.totals;
  const big = ctx.hospitals.slice(0, 10);
  const examples = ['がん研究会有明病院', '聖路加国際病院', '倉敷中央病院', '亀田総合病院'].map((n) => ctx.hospitals.find((h) => h.short === n)).filter(Boolean);
  const body = `<section class="hero">
<p class="eyebrow">${esc(fy)}（${esc(periodText())}退院）の国のDPC公開データ</p>
<h1>病院の手術件数を、<br>国の公開データで調べる</h1>
<p class="lead">全国${comma(t.hospitals)}病院の、病気ごとの入院患者数と手術件数。厚生労働省が公開しているDPC（診断群分類）のデータを、だれでも無料で見やすく整理しました。</p>
<form class="sb sb-big" role="search" action="${href('search/')}">
<input class="sb-i" name="q" type="search" placeholder="病院名を入れてください" autocomplete="off" aria-label="病院名で検索" enterkeyhint="search">
<div class="sb-r" hidden></div>
</form>
${examples.length ? `<p class="eg">例：${examples.map((h) => `<a href="${href(hospitalPath(h))}">${esc(h.short)}</a>`).join('　')}</p>` : ''}
</section>
${caution('rank')}
<section class="sec"><h2>病気・手術からランキングを見る</h2><div class="tgs">${topicCards(ctx)}</div><p><a href="${href('ranking/')}">ランキングの一覧</a>　<a href="${href('shippei/')}">すべての病気（${ctx.diseases.length}分類）から探す</a></p></section>
<section class="sec"><h2>都道府県から探す</h2>${prefGrid(ctx)}<p class="note">数字はページのある病院の数です。</p></section>
<section class="sec"><h2>入院患者数の多い病院（全国）</h2><ol class="cl cl-n">${big.map((h) => `<li><a href="${href(hospitalPath(h))}">${esc(h.short)}<small>${esc(h.prefInfo?.name || '')}${esc(h.city || '')}・入院患者${comma(h.stats.n)}人・手術${comma(h.stats.ope)}人</small></a></li>`).join('')}</ol></section>
<section class="card"><h2>このサイトでわかること</h2>
<ul class="ul">
<li>病院ごとに、${esc(fy)}に退院した患者の数を病気（約${Math.round(ctx.diseases.length / 10) * 10}分類）ごとに、手術の種類別に見られます。</li>
<li>胃がん・大腸がん・乳がん・人工膝関節・カテーテルアブレーション・白内障など、よく調べられる病気・手術は、全国と都道府県ごとの件数ランキングにしています。</li>
<li>救急車で運ばれて入院した患者の数、全身麻酔の件数、平均在院日数なども載せています。</li>
</ul>
<p>もとのデータは厚生労働省が毎年公表している「退院患者調査」の結果です。国の資料はExcelの表が100個近くに分かれていて、病院どうしを比べるのは大変です。このサイトはそれを病院・病気・地域ごとのページに組み直しています。<a href="${href('about/')}">データと数字の読み方</a></p></section>`;
  const ld = [{ '@type': 'WebSite', name: SITE_NAME, url: abs(''), inLanguage: 'ja', potentialAction: { '@type': 'SearchAction', target: `${abs('search/')}?q={q}`, 'query-input': 'required name=q' } }];
  return layout({ title: `${SITE_NAME}｜病院ごとの手術件数・入院患者数（${fy}・DPCデータ）`, description: `全国${comma(t.hospitals)}病院の手術件数・入院患者数を、厚生労働省のDPC公開データ（${periodText()}退院）から病気ごとに。胃がん・乳がん・人工関節・白内障などの手術件数ランキングを全国・都道府県別に無料で見られます。`, path: '', body, ld, ogTitle: `${SITE_NAME}｜${TAGLINE}` });
}

export function renderPrefIndex(ctx) {
  const fy = fyText();
  const bc = breadcrumbs([['トップ', ''], ['都道府県から探す', null]]);
  const rows = ctx.prefs.map((p) => `<tr><th><a href="${href(prefPath(p))}">${esc(p.name)}</a></th><td class="n">${comma(p.hospitals.length)}</td><td class="n">${comma(p.total)}</td><td class="n">${comma(p.ope)}</td></tr>`).join('');
  const body = `${bc.html}
<header class="ph"><h1>都道府県から探す</h1><p class="lead">都道府県ごとに、病院の入院患者数・手術件数と、病気・手術ごとのランキングを見られます（${esc(fy)}）。</p></header>
${prefGrid(ctx)}
<section class="sec"><h2>都道府県ごとの合計</h2><div class="tw"><table class="dt"><thead><tr><th>都道府県</th><th class="n">病院</th><th class="n">入院患者数</th><th class="n">手術を受けた人</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="note">国のDPC調査に参加し、ページのある病院の合計です（病院の所在地で数えています）。</p></section>`;
  return layout({ title: `都道府県から探す 病院の手術件数・入院患者数【${fy}】｜${SITE_NAME}`, description: `47都道府県の病院の手術件数・入院患者数と、病気・手術ごとのランキング（${fy}・厚生労働省のDPC公開データ）。`, path: 'ken/', body, ld: [bc.ld] });
}

export function renderPref(ctx, p) {
  const fy = fyText();
  const bc = breadcrumbs([['トップ', ''], ['都道府県から探す', 'ken/'], [p.name, null]]);
  const hs = p.hospitals;
  const maxN = Math.max(1, ...hs.map((h) => h.stats.n || 0));
  const rows = hs.map((h, i) => `<tr><td class="rk" data-v="${i + 1}">${i + 1}</td><td class="hn"><a href="${href(hospitalPath(h))}">${esc(h.short)}</a><small>${esc(h.city || '')}・${esc(GROUP_INFO[h.group].short)}</small></td>${numCell({ v: h.stats.n || 0, m: 0 }, maxN)}${numCell({ v: h.stats.ope || 0, m: 0 }, 0, { bar: false })}${numCell({ v: h.stats.anes || 0, m: 0 }, 0, { bar: false })}<td class="n d" data-v="${(h.stats.ambMonth ?? -1).toFixed(1)}">${h.stats.ambMonth != null ? fmt(h.stats.ambMonth) : '—'}</td>${losCell(h.stats.los)}</tr>`).join('\n');
  // 県内の患者が多い病気（トピック以外）
  const ds = ctx.diseases.filter((d) => !d.topic && d.prefPages.some((x) => x.code === p.code))
    .map((d) => ({ d, n: (d.byPref.get(p.code) || []).reduce((s, r) => s + r.total.v, 0) })).sort((a, b) => b.n - a.n).slice(0, 40);
  const body = `${bc.html}
<header class="ph"><p class="eyebrow">${esc(fy)}・国のDPC公開データ</p><h1>${esc(p.name)}の病院 手術件数・入院患者数</h1>
<p class="lead">${esc(periodText())}に${esc(p.name)}の病院（国のDPC調査に参加した${comma(hs.length)}病院）を退院した患者は${comma(p.total)}人で、手術を受けた人は${comma(p.ope)}人でした。病気・手術ごとのランキングと、病院の一覧です。</p></header>
${caution('rank')}
<section class="sec"><h2>${esc(p.name)}の病気・手術ごとのランキング</h2><div class="tgs">${topicCards(ctx, p)}</div></section>
<section class="sec"><h2>${esc(p.name)}の病院（入院患者数の多い順）</h2><div class="tw"><table class="rt has-rk sortable"><thead><tr><th class="rk" data-sort="rank">順位</th><th class="hn">病院</th><th class="n" data-sort="n">入院患者数</th><th class="n" data-sort="n">手術あり</th><th class="n" data-sort="n">全身麻酔</th><th class="n" data-sort="n">救急車搬送<small>人/月</small></th><th class="n" data-sort="n">平均在院日数</th></tr></thead><tbody>
${rows}
</tbody></table></div><p class="note">入院患者数などは国のDPC調査の対象になった入院（一般病棟）の数です。</p></section>
${ds.length ? `<section class="sec"><h2>${esc(p.name)}のそのほかの病気</h2><ul class="tl tl-s">${ds.map(({ d, n }) => `<li><a href="${href(diseasePath(d, p))}"><b>${esc(d.name)}</b><small>県内の公表分 ${comma(n)}人</small></a></li>`).join('')}</ul><p><a href="${href('shippei/')}">すべての病気から探す</a></p></section>` : ''}`;
  return layout({ title: `${p.name}の病院 手術件数・入院患者数ランキング【${fy}】｜${SITE_NAME}`, description: `${p.name}の${comma(hs.length)}病院の入院患者数・手術件数・全身麻酔・救急車搬送・平均在院日数と、胃がん・乳がん・人工関節など病気ごとの手術件数ランキング（${fy}・DPC公開データ）。`, path: prefPath(p), body, ld: [bc.ld] });
}

export function renderAbout(ctx) {
  const info = buildInfo();
  const m = info.manifest;
  const fy = fyText();
  const bc = breadcrumbs([['トップ', ''], ['このサイトについて', null]]);
  const g = ctx.totals.byGroup;
  const body = `${bc.html}
<header class="ph"><h1>このサイトについて・数字の読み方</h1><p class="lead">${SITE_NAME}は、厚生労働省が公開しているDPC（診断群分類）のデータから、病院ごとの入院患者数・手術件数を、だれでも無料で調べられるようにしたサイトです。</p></header>
<section class="card"><h2>使っているデータ</h2>
<ul class="ul">
<li>厚生労働省「<a href="${esc(m.report.url)}" rel="noopener">${esc(m.report.title.replace(/について$/, ''))}</a>」：病院ごと・病気ごと・手術の区分ごとの退院患者数と平均在院日数、病院ごとの救急車搬送・紹介・全身麻酔などの集計。${esc(periodText())}に退院した患者が対象です。${m.report.notes?.length ? `（${esc(m.report.notes.join(' '))}）` : ''}</li>
<li>厚生労働省「<a href="${esc(m.tree.page)}" rel="noopener">${TREE_NAME}</a>」（${esc(m.files.tree.date || '')}）：病気の名前と、手術の区分に含まれる術式の名前。</li>
<li>総務省「<a href="https://www.soumu.go.jp/denshijiti/code.html" rel="noopener">${CITY_NAME}</a>」：市区町村の名前。</li>
</ul>
<p>厚生労働省のホームページの情報は「公共データ利用規約（第1.0版）」にもとづき、出典を記載すれば商用を含めて利用できます。${SITE_NAME}は、これらのデータを${OPERATOR}が加工して作成しています。<b>国（厚生労働省）が作成したものではありません。</b></p>
<p>集計の対象は、DPC調査にデータを提出した病院です：大学病院本院群${g.univ}、DPC特定病院群${g.tokutei}、DPC標準病院群${comma(g.hyojun)}、DPC準備病院${g.junbi}、出来高算定病院${comma(g.dekidaka)}（${comma(ctx.totals.all)}病院）。このうち件数がある${comma(ctx.totals.hospitals)}病院のページを作っています。</p></section>
<section class="card" id="dpc"><h2>DPCとは</h2>
<p>DPC（Diagnosis Procedure Combination：診断群分類）は、入院した患者を「病気」と「行われた手術・処置」の組み合わせで分類するしくみです。急性期の病院の入院医療費の支払いに使われ、参加する病院は入院患者のデータを国に提出しています。国はそれを集計し、病院ごとの件数を毎年公表しています。</p>
<p>病気は、入院中に<b>最も医療資源を使った病名</b>で決まります（診断群分類の頭6桁）。手術は、病気ごとに決められた「区分」（診断群分類番号の9・10桁目）に分けて数えられます。区分「99」は手術なし、「97」はその他の手術、「01」「02」…は病気ごとに定められた主な手術です。</p></section>
<section class="card" id="yomikata"><h2>数字の読み方</h2>
<ul class="ul">
<li><b>件数が多いことは、治療の質や安全性が高いことを直接示すものではありません。</b>件数は病院の規模、地域の人口、専門とする分野、紹介の受け方などでも変わります。このサイトの順位は件数の多い順に並べただけのもので、病院の評価やおすすめではありません。</li>
<li>件数は<b>${esc(periodText())}に退院した患者の数</b>です（${esc(fy)}。国の集計では6月〜翌年5月を1年度としています）。手術の件数は「その手術の区分に当てはまる手術を受けて退院した患者の数」で、手術の回数ではありません。</li>
<li>国の集計の対象外：入院が1日以内（日帰り）の患者、入院から24時間以内に亡くなった患者、臓器移植を受けた患者、自費の患者、治験の対象の患者など。白内障や大腸ポリープなど、日帰りや外来で行われることの多い手術は、実際の件数よりかなり少なくなります。</li>
<li><b>10件未満の区分は「－」で伏せられています</b>（0件の場合も「－」です）。このサイトでは、伏せられた区分を0件として足した数を表示し、伏せられた区分があるときは「120〜138」のように、伏せられた区分をそれぞれ9件と見た場合までの幅を示しています。順位は公表された件数（幅の小さい方）で決めています。</li>
<li>病院の所在地で数えています。患者が住んでいる都道府県ではありません。</li>
<li><b>平均在院日数</b>は、病気の重さ、手術の種類、ほかの病院への転院の有無などで大きく変わります。短いほど良いとは限りません。</li>
<li>「同じ類型の中央値」は、病院ページで比べるための目安で、大学病院本院・DPC特定病院群などの類型ごとに、件数がある病院の真ん中の値です。</li>
<li>病院の名前・病床数などは、国の施設概要表の記載のままです。合併・分割があった病院は、その旨を病院ページに載せています。</li>
</ul></section>
<section class="card" id="ranking"><h2>ランキングの決め方</h2>
<ul class="ul">
<li>「胃がん」「人工膝関節」などのランキングは、関係する病気の、決まった手術の区分の件数を足したものです。どの区分を足しているかは、各ページの「数えている手術」に術式名で載せています。</li>
<li>全国のページは上位100病院、都道府県のページは件数が公表されたすべての病院を載せています。件数が公表された病院が${3}か所未満の都道府県はページを作らず、全国のページの下にまとめています。</li>
<li>入院患者数は、その病気で入院したすべての患者（手術なしを含む）の数です。</li>
</ul></section>
<section class="card"><h2>更新</h2><p>国は毎年度末ごろに新しい年度の結果を公表しています。このサイトは毎週、国のページを確認し、新しいデータが出ていれば自動で作り直します（最終更新：${esc(info.built)}、データは${esc(fy)}分）。</p></section>
<section class="card" id="privacy"><h2>運営者・お問い合わせ・プライバシー</h2>
<dl class="dl"><div><dt>運営</dt><dd>${OPERATOR}（法人番号 ${OPERATOR_ID}）</dd></div><div><dt>お問い合わせ</dt><dd>${CONTACT}</dd></div></dl>
<p>このサイトはAIを使って作られ、データの集計や文章の作成も自動で行っています。数字の確認は、出典の国の資料をご覧ください。医療についての個別のご相談にはお答えできません。</p>
<p>このサイトはCookieを使わず、アクセス解析も行っていません。検索に入力した文字は、お使いの端末の中だけで処理され、外部に送られません。</p></section>`;
  return layout({ title: `このサイトについて・数字の読み方｜${SITE_NAME}`, description: `${SITE_NAME}で使っているデータ（厚生労働省のDPC公開データ）、件数の数え方、10件未満の伏せ字の扱い、ランキングの決め方、見るときの注意。`, path: 'about/', body, ld: [bc.ld] });
}

export function renderSearch() {
  const bc = breadcrumbs([['トップ', ''], ['病院を検索', null]]);
  const body = `${bc.html}
<header class="ph"><h1>病院を検索</h1></header>
<form class="sb sb-big sb-page" role="search" action="${href('search/')}">
<input class="sb-i" name="q" type="search" placeholder="病院名を入れてください" autocomplete="off" aria-label="病院名で検索" enterkeyhint="search">
<div class="sb-r" hidden></div>
</form>
<div id="results" class="sec"></div>
<p class="note">病院名の一部を漢字で入れてください（例：「済生会」「赤十字」）。カタカナとひらがな、法人名の有無はゆるく照らし合わせますが、漢字の名前をひらがなの読みで探すことはできません。</p>`;
  return layout({ title: `病院を検索｜${SITE_NAME}`, description: `病院名から、手術件数・入院患者数のページを探せます。`, path: 'search/', body, ld: [bc.ld], noindex: true });
}

export function render404() {
  const body = `<header class="ph"><h1>ページが見つかりません</h1><p class="lead">URLが変わったか、ページがなくなった可能性があります。</p></header>
<form class="sb sb-big" role="search" action="${href('search/')}">
<input class="sb-i" name="q" type="search" placeholder="病院名を入れてください" autocomplete="off" aria-label="病院名で検索" enterkeyhint="search">
<div class="sb-r" hidden></div>
</form>
<p><a href="${href('')}">トップへ</a>　<a href="${href('ranking/')}">病気・手術から探す</a>　<a href="${href('ken/')}">都道府県から探す</a></p>`;
  return layout({ title: `ページが見つかりません｜${SITE_NAME}`, description: 'ページが見つかりません。', path: '404.html', body, noindex: true });
}

export { GROUP_ORDER };
