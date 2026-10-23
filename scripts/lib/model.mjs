// 読み込んだデータから、ページに出す集計を作る
// 件数は、10件未満で「－」になった区分を 0 として足す（v）。伏せられた区分の数（m）も持ち、表示では「v〜v+9m」の幅にする
import { REST, GROUPS } from './load.mjs';
import { countable, branchLabel, procedures, onlyGeneric } from './ops.mjs';
import { shortName, periodOf } from './format.mjs';
import { PREFS, PREF, GROUP_ORDER } from './meta.mjs';
import { TOPICS } from './topics.mjs';

export const MIN_AREA = 3; // 都道府県ごとのページを作る最少の病院数

const median = (arr) => {
  const a = arr.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const i = (a.length - 1) / 2;
  return (a[Math.floor(i)] + a[Math.ceil(i)]) / 2;
};

// 件数の比べ方：公表された件数（下限）→ 幅の上限 → 名前
export const byMetric = (get) => (a, b) => {
  const x = get(a);
  const y = get(b);
  return (y.v - x.v) || ((y.v + 9 * y.m) - (x.v + 9 * x.m)) || a.h.name.localeCompare(b.h.name, 'ja');
};

// 同じ件数は同じ順位（1,2,2,4…）
function ranked(list, get) {
  let prev = null;
  let rank = 0;
  return list.map((row, i) => {
    const v = get(row).v;
    if (v !== prev) { rank = i + 1; prev = v; }
    return { ...row, rank };
  });
}

export function buildModel(D) {
  const period = periodOf(D.periodText, D.year);
  const tree = D.tree;

  // ---- 病気 ----
  const soleTopic = new Map(); // 病気 → その病気だけを扱うトピック（病気のページの代わりになる）
  for (const t of TOPICS) if (t.codes.length === 1) soleTopic.set(t.codes[0], t);
  const dis = new Map();
  for (const [code, branchesAll] of D.diseaseBranches) {
    const info = tree.diseases.get(code);
    if (!info) throw new Error(`電子点数表に病気 ${code} の名前がありません`);
    const branches = countable(branchesAll);
    const kc = D.profile.get(code)?.k;
    const nat = D.national.get(code) || new Map();
    const natTotal = branches.reduce((s, b) => s + (nat.get(b)?.n || 0), 0);
    const natOps = branches.filter((b) => b !== '99').reduce((s, b) => s + (nat.get(b)?.n || 0), 0);
    dis.set(code, {
      code, name: info.name, mdc: info.mdc, branches, generic: onlyGeneric(branchesAll),
      labels: new Map(branches.map((b) => [b, branchLabel(tree, code, b, branchesAll, kc)])),
      procs: new Map(branches.map((b) => [b, procedures(tree, code, b, kc)])),
      nat, natTotal, natOps, profile: D.profile.get(code) || null, topic: soleTopic.get(code) || null, rows: [],
    });
  }
  // ふだんの呼び名（トピックの名前）を病気にも付ける
  for (const t of TOPICS) for (const c of t.codes) {
    const d = dis.get(c);
    if (!d) throw new Error(`トピック ${t.slug} の病気 ${c} がデータにありません`);
    if (t.codes.length === 1 && t.alias !== false) d.alias = t.alias || t.name;
    (d.topics ||= []).push(t);
  }

  // ---- 病院 ----
  const hospitals = [];
  for (const h of D.hosp.values()) {
    h.short = shortName(h.name);
    h.prefInfo = PREF.get(h.pref) || null;
    h.rows = [];
    for (const [code, cells] of h.dis) {
      const d = dis.get(code);
      if (!d) continue;
      let v = 0; let m = 0; let ops = 0; let opsM = 0; let losN = 0; let losS = 0;
      for (const b of d.branches) {
        const c = cells.get(b);
        if (c?.n != null) {
          v += c.n;
          if (b !== '99') ops += c.n;
          if (c.los != null) { losN += c.n; losS += c.n * c.los; }
        } else {
          m++;
          if (b !== '99') opsM++;
        }
      }
      if (!v) continue;
      const row = { h, d, code, cells, total: { v, m }, ops: { v: ops, m: opsM }, los: losN ? losS / losN : null };
      h.rows.push(row);
      d.rows.push(row);
    }
    h.rows.sort((a, b) => b.total.v - a.total.v || a.code.localeCompare(b.code));
    h.page = (h.stats.n || 0) >= 10 || h.rows.length > 0;
    h.index = h.rows.length >= 3; // 公表された病気が少ない病院のページは検索に出さない（noindex）
    if (h.page) hospitals.push(h);
  }
  hospitals.sort((a, b) => (b.stats.n || 0) - (a.stats.n || 0) || a.id.localeCompare(b.id));

  // 類型ごとの中央値（病院ページの比較用）
  const groupMedian = {};
  for (const g of GROUP_ORDER) {
    const list = hospitals.filter((h) => h.group === g && (h.stats.n || 0) >= 10);
    groupMedian[g] = { count: list.length };
    for (const k of ['n', 'ope', 'anes', 'chemo', 'radio', 'ambMonth', 'emgMonth', 'refRate', 'los', 'home']) groupMedian[g][k] = median(list.map((h) => h.stats[k]));
  }

  // ---- トピック（ランキング） ----
  const topics = TOPICS.map((t) => {
    for (const col of t.cols) for (const [code, bs] of col.cells) {
      const d = dis.get(code);
      for (const b of bs) if (!d.branches.includes(b)) throw new Error(`トピック ${t.slug} の区分 ${code}-${b} がデータにありません（${d.branches.join(',')}）`);
    }
    const rows = [];
    for (const h of hospitals) {
      const cols = t.cols.map((col) => {
        let v = 0; let m = 0; let losN = 0; let losS = 0;
        for (const [code, bs] of col.cells) {
          const cells = h.dis.get(code);
          for (const b of bs) {
            const c = cells?.get(b);
            if (c?.n != null) { v += c.n; if (c.los != null) { losN += c.n; losS += c.n * c.los; } } else m++;
          }
        }
        return { v, m, los: losN ? losS / losN : null };
      });
      let pv = 0; let pm = 0; let losN = 0; let losS = 0;
      for (const code of t.codes) {
        const d = dis.get(code);
        const cells = h.dis.get(code);
        for (const b of d.branches) {
          const c = cells?.get(b);
          if (c?.n != null) { pv += c.n; if (c.los != null) { losN += c.n; losS += c.n * c.los; } } else pm++;
        }
      }
      const patients = { v: pv, m: pm, los: losN ? losS / losN : null };
      if (!pv && !cols.some((c) => c.v)) continue;
      rows.push({ h, cols, patients });
    }
    const main = t.sort === 'patients' || !t.cols.length ? (r) => r.patients : (r) => r.cols[0];
    rows.sort(byMetric(main));
    const listed = rows.filter((r) => main(r).v > 0);
    // 全国の件数（伏せ字のない合計）
    const natCols = t.cols.map((col) => {
      let n = 0;
      const byGroup = {};
      for (const [code, bs] of col.cells) for (const b of bs) {
        const x = dis.get(code).nat.get(b);
        n += x?.n || 0;
        for (const g of GROUP_ORDER) byGroup[g] = (byGroup[g] || 0) + (x?.byGroup?.[g] || 0);
      }
      return { n, byGroup };
    });
    const natPatients = t.codes.reduce((s, c) => s + dis.get(c).natTotal, 0);
    const byPref = new Map();
    for (const r of listed) {
      const p = r.h.pref;
      (byPref.get(p) || byPref.set(p, []).get(p)).push(r);
    }
    const t2 = { ...t, mainKey: t.sort === 'patients' || !t.cols.length ? 'patients' : t.cols[0].key, main, rows, listed: ranked(listed, main), natCols, natPatients, byPref: new Map() };
    for (const [p, list] of byPref) t2.byPref.set(p, ranked(list, main));
    t2.prefPages = PREFS.filter((p) => (t2.byPref.get(p.code) || []).length >= MIN_AREA);
    return t2;
  });

  // 病気からたどるトピックを、集計済みのものに差し替える
  const bySlug = new Map(topics.map((t) => [t.slug, t]));
  for (const d of dis.values()) {
    if (d.topic) d.topic = bySlug.get(d.topic.slug);
    if (d.topics) d.topics = d.topics.map((t) => bySlug.get(t.slug));
  }

  // 病院ページに出す「県内で何位か」
  for (const t of topics) {
    for (const [p, list] of t.byPref) {
      const hasPage = list.length >= MIN_AREA;
      for (const r of list) {
        (r.h.badges ||= []).push({ t, rank: r.rank, of: list.length, v: t.main(r), hasPage, pref: p });
      }
    }
  }
  for (const h of hospitals) (h.badges || []).sort((a, b) => a.rank / a.of - b.rank / b.of || b.v.v - a.v.v);

  // ---- 病気ごとのランキング（トピックで置き換えない病気） ----
  const diseases = [...dis.values()].filter((d) => d.rows.length);
  for (const d of diseases) {
    d.rows.sort(byMetric((r) => r.total));
    d.listed = ranked(d.rows, (r) => r.total);
    d.byPref = new Map();
    const tmp = new Map();
    for (const r of d.rows) (tmp.get(r.h.pref) || tmp.set(r.h.pref, []).get(r.h.pref)).push(r);
    for (const [p, list] of tmp) d.byPref.set(p, ranked(list, (r) => r.total));
    d.prefPages = d.topic ? [] : PREFS.filter((p) => (d.byPref.get(p.code) || []).length >= MIN_AREA);
  }
  diseases.sort((a, b) => a.code.localeCompare(b.code));

  // ---- 都道府県 ----
  const prefs = PREFS.map((p) => {
    const hs = hospitals.filter((h) => h.pref === p.code);
    return { ...p, hospitals: hs, total: hs.reduce((s, h) => s + (h.stats.n || 0), 0), ope: hs.reduce((s, h) => s + (h.stats.ope || 0), 0) };
  });

  const totals = {
    hospitals: hospitals.length, indexed: hospitals.filter((h) => h.index).length, all: D.hosp.size,
    patients: hospitals.reduce((s, h) => s + (h.stats.n || 0), 0), ope: hospitals.reduce((s, h) => s + (h.stats.ope || 0), 0),
    byGroup: Object.fromEntries(GROUP_ORDER.map((g) => [g, [...D.hosp.values()].filter((h) => h.group === g).length])),
  };
  return { period, dis, diseases, hospitals, topics, prefs, groupMedian, totals, GROUPS };
}
