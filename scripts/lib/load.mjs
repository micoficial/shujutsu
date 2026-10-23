// data/raw/src/ の Excel を読み、病院・病気・手術の区分をまとめる。
// 表の見出しが想定と違ったら止める（列がずれたまま黙って変な数字を出さないため）
import fs from 'node:fs';
import path from 'node:path';
import { readXlsx } from './xlsx.mjs';

const clean = (s) => String(s ?? '').replace(/[\s\r\n　]+/g, '').replace(/※\d*/g, '');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const id5 = (v) => {
  const s = String(v ?? '').trim();
  return /^\d{5}$/.test(s) ? s : null;
};

function expect(cond, msg) {
  if (!cond) throw new Error(`データの形が想定と違います：${msg}`);
}

function sheet(file, name) {
  const wb = readXlsx(file);
  const key = Object.keys(wb).find((k) => clean(k) === clean(name));
  expect(key, `${path.basename(file)} に「${name}」のシートがありません（${Object.keys(wb).join('、')}）`);
  return wb[key];
}

// 見出し行の列 c が label で始まるか
function head(rows, r, c, label, file) {
  expect(clean(rows[r]?.[c]).startsWith(clean(label)), `${file} の ${r + 1}行${c + 1}列目は「${label}」のはずが「${rows[r]?.[c]}」`);
}

// 告示番号の頭の数字 → 施設の類型
export const GROUPS = {
  1: { key: 'univ', name: '大学病院本院群', short: '大学病院本院' },
  2: { key: 'tokutei', name: 'DPC特定病院群', short: 'DPC特定病院' },
  3: { key: 'hyojun', name: 'DPC標準病院群', short: 'DPC標準病院' },
  9: { key: 'junbi', name: 'DPC準備病院', short: 'DPC準備病院' },
  0: { key: 'dekidaka', name: '出来高算定病院', short: '出来高算定病院' },
};

const DCODE = /^\d{5}[0-9x]$/; // 病気（診断群分類の頭6桁）。6桁目が x のものもある
export const REST = '97（輸血以外の再掲）';

function loadTree(file) {
  const wb = readXlsx(file);
  const pick = (name) => {
    const key = Object.keys(wb).find((k) => clean(k).includes(clean(name)));
    expect(key, `電子点数表に「${name}」のシートがありません`);
    return wb[key];
  };
  const mdcRows = pick('ＭＤＣ名称');
  head(mdcRows, 0, 0, 'MDCｺｰﾄﾞ', '電子点数表');
  const mdc = new Map();
  for (const r of mdcRows.slice(2)) if (/^\d\d$/.test(String(r[0] ?? ''))) mdc.set(String(r[0]), String(r[1]).trim());

  const nameRows = pick('分類名称');
  head(nameRows, 0, 2, '名称', '電子点数表');
  const diseases = new Map();
  for (const r of nameRows.slice(2)) {
    const code = `${r[0] ?? ''}${r[1] ?? ''}`;
    if (DCODE.test(code)) diseases.set(code, { code, mdc: String(r[0]), name: String(r[2]).trim() });
  }

  // 手術：分類ごと・対応コード（診断群分類番号の9,10桁目）ごとの術式
  const opRows = pick('手術');
  head(opRows, 0, 5, '対応ｺｰﾄﾞ', '電子点数表');
  head(opRows, 1, 6, '点数表名称', '電子点数表');
  head(opRows, 1, 7, 'Ｋコード', '電子点数表');
  const ops = new Map(); // code → Map(branch → [{v, name, k, with}])
  const kname = new Map();
  for (const r of opRows.slice(2)) {
    const code = `${r[0] ?? ''}${r[1] ?? ''}`;
    if (!DCODE.test(code)) continue;
    const end = String(r[18] ?? '99999999');
    if (end !== '99999999' && +end < 20240601) continue;
    const branch = String(r[5] ?? '').trim();
    if (!/^\d\d$/.test(branch)) continue;
    const name = String(r[6] ?? '').trim();
    const k = String(r[7] ?? '').trim();
    if (!name) continue;
    const extra = [];
    for (let c = 8; c <= 14; c += 2) if (r[c]) extra.push(String(r[c]).trim());
    if (k && !/^KKK/.test(k)) kname.set(k, name);
    for (let c = 8; c <= 14; c += 2) if (r[c] && r[c + 1]) kname.set(String(r[c + 1]).trim(), String(r[c]).trim());
    const m = ops.get(code) || ops.set(code, new Map()).get(code);
    const list = m.get(branch) || m.set(branch, []).get(branch);
    if (!list.some((x) => x.k === k && x.name === name)) list.push({ v: String(r[2] ?? ''), name, k, with: extra });
  }
  // 出来高で算定する手術等（移植など）、手術・処置等1・2 に出てくる手術の名前も控える
  const dekiRows = Object.entries(wb).find(([k]) => clean(k).includes('出来高算定手術等コード'))?.[1] || [];
  for (const r of dekiRows.slice(2)) if (/^K/.test(String(r[1] ?? '')) && r[2] && !kname.has(String(r[1]))) kname.set(String(r[1]), String(r[2]).trim());
  for (const [sheetName, pairs] of [['手術・処置等１', [[5, 6], [7, 8]]], ['手術・処置等２', [[4, 5], [6, 7]]]]) {
    const rows = Object.entries(wb).find(([k]) => clean(k).includes(clean(sheetName)))?.[1] || [];
    for (const r of rows.slice(2)) {
      for (const [nc, kc] of pairs) {
        const k = String(r[kc] ?? '').trim();
        if (/^K\d/.test(k) && r[nc] && !kname.has(k)) kname.set(k, String(r[nc]).trim());
      }
    }
  }
  return { mdc, diseases, ops, kname };
}

// 団体コード（6桁）の頭5桁 → 市区町村名。政令指定都市の区は2枚目のシートにある
function loadCities(file) {
  const city = new Map();
  for (const rows of Object.values(readXlsx(file))) {
    head(rows, 0, 0, '団体コード', '団体コード');
    for (const r of rows.slice(1)) {
      const code = String(r[0] ?? '');
      if (/^\d{6}$/.test(code) && r[2]) city.set(code.slice(0, 5), String(r[2]).trim());
    }
  }
  return city;
}

export function loadAll(dir) {
  const f = (k) => path.join(dir, `${k}.xlsx`);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const year = manifest.report.year;
  const Y = `令和${year}年度`;
  const Y0 = `令和${year - 1}年度`;
  const tree = loadTree(f('tree'));
  const city = loadCities(f('city'));

  // ---- 施設概要表 ----
  const hosp = new Map();
  let periodText = '';
  {
    const rows = sheet(f('shisetsu'), '施設概要表');
    const cols = ['告示番号', '通番', '市町村番号', '都道府県', '施設名', '病院類型', 'DPC算定病床数', 'DPC算定病床の入院基本料', 'DPC算定病床割合',
      '回復期リハビリテーション病棟入院料等病床数', '地域包括ケア病棟入院料病床数', '地域包括医療病棟入院料病床数', '精神病床数', '療養病床数', '結核病床数', '病床総数'];
    cols.forEach((c, i) => head(rows, 0, i, c, '施設概要表'));
    head(rows, 0, 16, Y, '施設概要表');
    periodText = String(rows[0][16]);
    head(rows, 0, 17, '病院指標URL', '施設概要表');
    head(rows, 0, 18, '医療の質指標URL', '施設概要表');
    for (const r of rows.slice(1)) {
      const id = id5(r[0]);
      if (!id) continue;
      const g = GROUPS[id[0]];
      expect(g, `告示番号 ${id} の類型がわかりません`);
      const muni = String(r[2] ?? '').trim();
      hosp.set(id, {
        id, prev: id5(r[1]), muni: /^\d{5}$/.test(muni) ? muni : null, pref: /^\d{5}$/.test(muni) ? +muni.slice(0, 2) : null,
        prefLabel: String(r[3] ?? '').trim(), name: String(r[4] ?? '').trim(), kind: String(r[5] ?? '').trim(), group: g.key,
        beds: { dpc: num(r[6]), kaifuku: num(r[9]), chiiki: num(r[10]), chiikiIryo: num(r[11]), seishin: num(r[12]), ryoyo: num(r[13]), kekkaku: num(r[14]), total: num(r[15]) },
        fee: r[7] && r[7] !== '-' ? String(r[7]).trim() : null, months: num(r[16]),
        urls: { shihyo: String(r[17] ?? '').trim(), qi: String(r[18] ?? '').trim() },
        city: city.get(muni) || null,
        stats: {}, mdc: null, dis: new Map(), notes: [],
      });
    }
    // 合併・分割の注記
    const wb = readXlsx(f('shisetsu'));
    const mk = Object.keys(wb).find((k) => k.includes('合併'));
    if (mk) {
      let note = null;
      for (const r of wb[mk].slice(2)) {
        if (r[8]) note = String(r[8]).replace(/\r?\n　?/g, '').trim();
        for (const c of [2, 5]) {
          const h = hosp.get(id5(r[c]));
          if (h && note && !h.notes.includes(note)) h.notes.push(note);
        }
      }
    }
  }
  const H = (v) => hosp.get(id5(v));

  // ---- 在院日数の状況（一般病棟のみ） ----
  {
    const rows = sheet(f('zaiin'), '在院日数の状況');
    head(rows, 0, 3, Y0, '在院日数の状況');
    head(rows, 0, 11, Y, '在院日数の状況');
    ['件数', '平均値', '変動係数', '最小値', 'パーセンタイル'].forEach((c, i) => head(rows, 1, 11 + i, c, '在院日数の状況'));
    for (const r of rows.slice(3)) {
      const h = H(r[0]);
      if (!h) continue;
      Object.assign(h.stats, { n: num(r[11]), los: num(r[12]), losP50: num(r[16]), n0: num(r[3]), los0: num(r[4]) });
    }
  }
  // ---- 手術・化学療法・放射線療法・全身麻酔 ----
  {
    const rows = sheet(f('koudo'), '高度医療');
    head(rows, 1, 3, '総数', '高度医療');
    ['手術有', '化学療法有', '放射線療法有', '救急車搬送有', 'いずれか有'].forEach((c, i) => head(rows, 2, 4 + i, c, '高度医療'));
    head(rows, 1, 9, '全身麻酔', '高度医療');
    for (const r of rows.slice(3)) {
      const h = H(r[0]);
      if (!h) continue;
      Object.assign(h.stats, { total: num(r[3]), ope: num(r[4]), chemo: num(r[5]), radio: num(r[6]), amb: num(r[7]), anes: num(r[9]) });
    }
  }
  // ---- 救急車・救急医療入院・紹介 ----
  {
    const rows = sheet(f('kyukyusha'), '救急車による搬送の有無');
    head(rows, 0, 3, '救急車による搬送の率', '救急車');
    head(rows, 0, 5, '救急車による搬送', '救急車');
    head(rows, 1, 4, Y, '救急車');
    head(rows, 1, 6, Y, '救急車');
    for (const r of rows.slice(2)) {
      const h = H(r[0]);
      if (h) Object.assign(h.stats, { ambRate: num(r[4]), ambMonth: num(r[6]), ambMonth0: num(r[5]) });
    }
  }
  {
    const rows = sheet(f('kyukyu'), '予定・救急医療入院');
    head(rows, 0, 5, '救急医療入院の率', '救急医療入院');
    head(rows, 0, 9, '救急医療入院', '救急医療入院');
    head(rows, 1, 6, Y, '救急医療入院');
    head(rows, 1, 10, Y, '救急医療入院');
    for (const r of rows.slice(2)) {
      const h = H(r[0]);
      if (h) Object.assign(h.stats, { emgRate: num(r[6]), emgMonth: num(r[10]), emgMonth0: num(r[9]) });
    }
  }
  {
    const rows = sheet(f('shokai'), '他院よりの紹介の有無');
    head(rows, 0, 3, '他院よりの紹介ありの率', '紹介');
    head(rows, 1, 4, Y, '紹介');
    for (const r of rows.slice(2)) {
      const h = H(r[0]);
      if (h) Object.assign(h.stats, { refRate: num(r[4]), refMonth: num(r[6]) });
    }
  }
  {
    const rows = sheet(f('keiro'), '退院先');
    head(rows, 0, 13, Y, '退院先');
    const labels = ['家庭への退院（当院に通院）', '家庭への退院（他院への通院）', '家庭への退院（その他）', '他の病院・診療所への転院', '介護老人保健施設に入所', '介護老人福祉施設に入所', '社会福祉施設、有料老人ホーム等に入所', '終了（死亡等）', 'その他', '介護医療院'];
    labels.forEach((c, i) => head(rows, 1, 13 + i, c, '退院先'));
    for (const r of rows.slice(2)) {
      const h = H(r[0]);
      if (!h) continue;
      const v = labels.map((_, i) => num(r[13 + i]));
      if (v.every((x) => x == null)) continue;
      h.stats.home = (v[0] || 0) + (v[1] || 0) + (v[2] || 0);
      h.stats.transfer = v[3] || 0;
      h.stats.care = (v[4] || 0) + (v[5] || 0) + (v[6] || 0) + (v[9] || 0);
    }
  }
  // ---- MDC別の患者数（手術あり・なし） ----
  {
    const rows = sheet(f('mdc'), '件数');
    head(rows, 1, 3, '手術', 'MDC別件数');
    for (let i = 0; i < 18; i++) head(rows, 1, 4 + i, String(i + 1).padStart(2, '0'), 'MDC別件数');
    let cur = null;
    for (const r of rows.slice(3)) {
      if (id5(r[0])) cur = H(r[0]);
      if (!cur) continue;
      const kind = String(r[3] ?? '').trim();
      expect(kind === '無し' || kind === '有り', `MDC別件数の「手術」が ${kind}`);
      cur.mdc ||= Array.from({ length: 18 }, () => ({ op: null, no: null }));
      for (let i = 0; i < 18; i++) cur.mdc[i][kind === '有り' ? 'op' : 'no'] = num(r[4 + i]);
    }
  }

  // ---- 疾患別手術別集計（病院 × 病気 × 手術の区分） ----
  const diseaseBranches = new Map(); // code → [branch...]（表に出てくる順）
  for (const file of fs.readdirSync(dir).filter((x) => /^op\d\d\.xlsx$/.test(x)).sort()) {
    const wb = readXlsx(path.join(dir, file));
    const rows = Object.values(wb)[0];
    head(rows, 3, 0, '告示番号', file);
    head(rows, 3, 2, '施設名', file);
    const colmap = [];
    let d = null;
    let measure = null;
    for (let c = 3; c < rows[3].length; c++) {
      if (rows[0][c]) {
        d = String(rows[0][c]).trim();
        expect(DCODE.test(d), `${file} の病気のコード ${d}`);
        measure = null;
      }
      if (rows[2][c]) measure = String(rows[2][c]).trim();
      expect(measure === '件数' || measure === '在院日数', `${file} の ${c + 1}列目の区分 ${measure}`);
      const b = String(rows[3][c] ?? '').trim();
      expect(/^\d\d$/.test(b) || b === REST, `${file} の手術の区分 ${b}`);
      colmap[c] = { d, measure, b };
      if (measure === '件数') {
        const list = diseaseBranches.get(d) || diseaseBranches.set(d, []).get(d);
        if (!list.includes(b)) list.push(b);
      }
    }
    for (const r of rows.slice(4)) {
      const h = H(r[0]);
      if (!h) continue;
      for (let c = 3; c < colmap.length; c++) {
        const v = num(r[c]);
        if (v == null) continue;
        const { d: code, measure: ms, b } = colmap[c];
        const m = h.dis.get(code) || h.dis.set(code, new Map()).get(code);
        const cell = m.get(b) || m.set(b, { n: null, los: null }).get(b);
        if (ms === '件数') cell.n = v; else cell.los = v;
      }
    }
  }

  // ---- 全国の件数（施設類型別の合計） ----
  const national = new Map(); // code → Map(branch → {n, los, byGroup})
  {
    const rows = Object.values(readXlsx(f('optype')))[0];
    head(rows, 0, 0, '疾患コード', '施設類型別');
    head(rows, 0, 3, '手術診断群分類番号', '施設類型別');
    const gcols = [['univ', '大学病院本院群', 4], ['tokutei', 'DPC特定病院群', 6], ['hyojun', 'DPC標準病院群', 8], ['junbi', 'DPC準備病院', 10], ['dekidaka', '出来高算定病院', 12]];
    for (const [, label, c] of gcols) head(rows, 0, c, label, '施設類型別');
    let code = null;
    let ms = null;
    for (const r of rows.slice(1)) {
      if (r[0]) code = String(r[0]).trim();
      if (r[2]) ms = String(r[2]).trim();
      const b = String(r[3] ?? '').trim();
      if (!code || !b) continue;
      const m = national.get(code) || national.set(code, new Map()).get(code);
      const cell = m.get(b) || m.set(b, { n: 0, los: null, byGroup: {}, losByGroup: {} }).get(b);
      if (ms === '件数') {
        for (const [k, , c] of gcols) { const v = num(r[c]) || 0; cell.byGroup[k] = v; cell.n += v; }
      } else if (ms === '在院日数') {
        let s = 0;
        let w = 0;
        for (const [k, , c] of gcols) { const v = num(r[c]); if (v != null) { cell.losByGroup[k] = v; s += v * (cell.byGroup[k] || 0); w += cell.byGroup[k] || 0; } }
        cell.los = w ? s / w : null;
      }
    }
  }

  // ---- 診断群分類ごとの全国集計 → 病気（6桁）ごとに合算 ----
  const profile = new Map();
  {
    const rows = sheet(f('dpc'), '全体');
    head(rows, 0, 0, '診断群分類番号', '診断群分類毎の集計');
    head(rows, 0, 7, '件数', '診断群分類毎の集計');
    head(rows, 0, 10, '性別', '診断群分類毎の集計');
    head(rows, 0, 14, '年齢分布', '診断群分類毎の集計');
    head(rows, 0, 66, '在院日数', '診断群分類毎の集計');
    head(rows, 0, 142, '手術', '診断群分類毎の集計');
    const ages = ['0～2歳', '3～5歳', '6～15歳', '16～20歳', '21～40歳', '41～60歳', '61～79歳', '80歳以上'];
    ages.forEach((a, i) => head(rows, 1, 14 + i * 2, a, '診断群分類毎の集計'));
    head(rows, 1, 30, '65歳以上', '診断群分類毎の集計');
    head(rows, 1, 32, '75歳以上', '診断群分類毎の集計');
    head(rows, 1, 38, '救急車による搬送', '診断群分類毎の集計');
    head(rows, 1, 66, '平均値', '診断群分類毎の集計');
    for (const r of rows.slice(3)) {
      const dpc = String(r[0] ?? '').trim();
      if (!DCODE.test(dpc.slice(0, 6))) continue;
      const n = num(r[7]);
      if (!n) continue;
      const code = dpc.slice(0, 6);
      const p = profile.get(code) || profile.set(code, { n: 0, male: 0, ages: ages.map(() => 0), over65: 0, over75: 0, amb: 0, losSum: 0, k: new Map(), dpcCount: 0 }).get(code);
      p.n += n;
      p.dpcCount++;
      p.male += num(r[10]) || 0;
      ages.forEach((_, i) => { p.ages[i] += num(r[14 + i * 2]) || 0; });
      p.over65 += num(r[30]) || 0;
      p.over75 += num(r[32]) || 0;
      p.amb += num(r[38]) || 0;
      p.losSum += (num(r[66]) || 0) * n;
      for (let c = 142; c < 172; c += 3) {
        const k = String(r[c] ?? '').trim();
        const kn = num(r[c + 1]);
        if (k && kn) p.k.set(k, (p.k.get(k) || 0) + kn);
      }
    }
  }

  return { manifest, year, periodText, tree, city, hosp, diseaseBranches, national, profile };
}
