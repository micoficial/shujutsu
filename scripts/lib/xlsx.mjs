// 依存なしの小さな xlsx 読み取り（ZIP を開いて sharedStrings と sheet の XML を読む）
import fs from 'node:fs';
import zlib from 'node:zlib';

function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP の終端が見つかりません');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('ZIP の目次が壊れています');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    files.set(name, { method, csize, local });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return {
    names: [...files.keys()],
    read(name) {
      const f = files.get(name);
      if (!f) return null;
      const lnl = buf.readUInt16LE(f.local + 26);
      const lel = buf.readUInt16LE(f.local + 28);
      const start = f.local + 30 + lnl + lel;
      const data = buf.subarray(start, start + f.csize);
      return f.method === 8 ? zlib.inflateRawSync(data) : Buffer.from(data);
    },
  };
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unesc = (s) => s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (_, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1));
  return ENT[e];
});

// <si> の文字（ふりがな <rPh> は除く）
function siText(si) {
  si = si.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let out = '';
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  let m;
  while ((m = re.exec(si))) out += m[1] ? unesc(m[1]) : '';
  return out;
}

function colIndex(ref) {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

// シート名 → 行の配列（各行は列の配列。空のセルは undefined）
export function readXlsx(file, { sheets: want } = {}) {
  const z = unzip(fs.readFileSync(file));
  const wb = z.read('xl/workbook.xml').toString('utf8');
  const rels = z.read('xl/_rels/workbook.xml.rels').toString('utf8');
  const target = new Map();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
    const t = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
    if (id && t) target.set(id, t.replace(/^\/?xl\//, '').replace(/^\//, ''));
  }
  const ssBuf = z.read('xl/sharedStrings.xml');
  const ss = [];
  if (ssBuf) {
    const s = ssBuf.toString('utf8');
    for (const m of s.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)) ss.push(m[1] ? siText(m[1]) : '');
  }
  const out = {};
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = unesc(/\bname="([^"]+)"/.exec(m[0])?.[1] || '');
    const rid = /\br:id="([^"]+)"/.exec(m[0])?.[1];
    if (want && !want.includes(name)) continue;
    const xml = z.read(`xl/${target.get(rid)}`).toString('utf8');
    out[name] = parseSheet(xml, ss);
  }
  return out;
}

function parseSheet(xml, ss) {
  const rows = [];
  const rowRe = /<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g;
  const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m;
  while ((m = rowRe.exec(xml))) {
    const attrs = m[1] ?? m[3];
    const r = +(/\br="(\d+)"/.exec(attrs)?.[1] || rows.length + 1) - 1;
    const row = [];
    if (m[2]) {
      let c;
      cellRe.lastIndex = 0;
      let ci = 0;
      while ((c = cellRe.exec(m[2]))) {
        const a = c[1];
        const ref = /\br="([A-Z]+)\d+"/.exec(a)?.[1];
        const idx = ref ? colIndex(ref) : ci;
        ci = idx + 1;
        const t = /\bt="([^"]+)"/.exec(a)?.[1];
        const body = c[2] || '';
        let v;
        if (t === 'inlineStr') v = siText(body);
        else {
          const vv = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
          if (vv == null) continue;
          if (t === 's') v = ss[+vv];
          else if (t === 'str' || t === 'e') v = unesc(vv);
          else if (t === 'b') v = vv === '1';
          else v = +vv;
        }
        row[idx] = v;
      }
    }
    rows[r] = row;
  }
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return rows;
}
