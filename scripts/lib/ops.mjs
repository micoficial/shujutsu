// 手術の区分（診断群分類番号の9,10桁目）の名前を、電子点数表の術式名から作る
import { REST } from './load.mjs';

const base = (name) => name.split('　')[0].trim();
const detail = (name) => name.split('　').slice(1).join(' ').trim();

// 病気の区分のうち、件数の合計に使うもの（97の再掲は97の一部なので除く）
export const countable = (branches) => branches.filter((b) => b !== REST);
// 99（手術なし）と97（その他）しかない病気
export const onlyGeneric = (branches) => countable(branches).every((b) => b === '99' || b === '97');
const specific = (b) => /^\d\d$/.test(b) && b !== '99' && b !== '97';

// 区分の中の術式。全国でよく行われている順（kcount：Kコード → 全国の件数）に並べる
export function procedures(tree, code, b, kcount) {
  const list = (tree.ops.get(code)?.get(b) || []).filter((o) => !/^KKK/.test(o.k));
  const seen = new Set();
  const out = list.filter((o) => {
    const key = `${o.k}|${o.name}|${o.with.join('+')}`;
    return seen.has(key) ? false : seen.add(key);
  });
  const n = (o) => kcount?.get(o.k) || 0;
  return out.map((o, i) => ({ ...o, i })).sort((a, b2) => n(b2) - n(a) || (+a.v || 99) - (+b2.v || 99) || a.i - b2.i);
}

export function branchLabel(tree, code, b, branches, kcount) {
  if (b === '99') return '手術なし';
  if (b === '97') return onlyGeneric(branches) ? '手術あり' : 'その他の手術';
  const items = procedures(tree, code, b, kcount);
  if (!items.length) return `区分${b}の手術`;
  const plus = items[0].with.length ? `＋${items[0].with[0].replace(/加算$/, '')}` : '';
  const bases = [...new Set(items.map((o) => base(o.name)))];
  // 同じ術式名が別の区分にもあるときは、細かい名前まで出して見分ける
  const shared = countable(branches).filter((x) => x !== b && specific(x))
    .some((x) => procedures(tree, code, x, kcount).some((o) => base(o.name) === bases[0]));
  let label;
  if (bases.length === 1 || plus) {
    const d = shared && !plus ? detail(items[0].name) : '';
    label = `${d ? `${bases[0]}（${d}）` : bases[0]}${plus}`;
    if (items.length > 1 && (shared || bases.length > 1)) label += 'など';
  } else {
    label = `${bases[0]}、${bases[1]}${bases.length > 2 ? 'など' : ''}`;
    if (label.length > 46) label = `${bases[0]}など`;
  }
  return label;
}
