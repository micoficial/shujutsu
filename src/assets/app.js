// 病院名の検索（索引は端末に読み込んで照らし合わせる。入力した文字は外に送らない）、表の並べ替え、リンクのコピー
(() => {
  const script = document.currentScript;
  const base = script ? script.src.replace(/assets\/app\.js.*$/, '') : '/';
  const ver = script ? (script.src.split('?v=')[1] || '') : '';
  let index = null;
  let loading = null;

  const KIND = /国立大学法人|公立大学法人|学校法人|国立研究開発法人|地方独立行政法人|独立行政法人|社会医療法人|特定医療法人|医療法人社団|医療法人財団|医療法人|一般財団法人|公益財団法人|一般社団法人|公益社団法人|社会福祉法人|国家公務員共済組合連合会/g;
  const norm = (s) => s.normalize('NFKC').toLowerCase()
    .replace(KIND, '')
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/がん研究会/g, 'がん研')
    .replace(/[\s・･.,，、。\-‐－—―ー〜~&＆'’"“”()（）［］\[\]]/g, '');

  function load() {
    if (index) return Promise.resolve(index);
    if (!loading) {
      loading = fetch(`${base}assets/index.json${ver ? `?v=${ver}` : ''}`)
        .then((r) => r.json())
        .then((j) => {
          index = j;
          index.n = j.h.map((row) => `${norm(row[1])}|${row[2] ? norm(row[2]) : ''}`);
          return index;
        });
    }
    return loading;
  }

  function search(q, limit) {
    const k = norm(q);
    if (!k) return [];
    const out = [];
    const { h, n } = index;
    for (let i = 0; i < h.length; i++) {
      const p = n[i].indexOf(k);
      if (p < 0) continue;
      const short = h[i][2] ? norm(h[i][2]) : n[i].split('|')[0];
      // 呼び名の先頭一致・名前の短さ・索引の順（入院患者の多い病院が先）で並べる
      out.push([short.startsWith(k) ? 0 : 1, short.length, i]);
    }
    out.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
    return out.slice(0, limit).map(([, , i]) => h[i]);
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const label = (row) => row[2] || row[1];
  const meta = (row) => `${index.prefs[row[3]] || ''}${row[4] || ''}${row[5] ? `・入院患者${Number(row[5]).toLocaleString('ja-JP')}人` : ''}`;
  const url = (row) => `${base}byoin/${row[0]}/`;

  function bind(form) {
    const input = form.querySelector('.sb-i');
    const box = form.querySelector('.sb-r');
    if (!input || !box) return;
    let rows = [];
    let sel = -1;
    const close = () => { box.hidden = true; sel = -1; };
    const render = () => {
      if (!input.value.trim()) { close(); return; }
      rows = search(input.value, 8);
      box.innerHTML = rows.length
        ? rows.map((r, i) => `<a href="${url(r)}"${i === sel ? ' class="on"' : ''}>${esc(label(r))}<small>${esc(meta(r))}</small></a>`).join('')
        : '<div class="sb-none">見つかりませんでした。名前の一部を漢字で入れてください（例：「聖路加」「済生会」）。ひらがなの読みでは探せません。</div>';
      box.hidden = false;
    };
    input.addEventListener('focus', () => { load().then(() => input.value && render()); });
    input.addEventListener('input', () => { sel = -1; load().then(render); });
    input.addEventListener('keydown', (e) => {
      if (box.hidden || !rows.length) return;
      if (e.key === 'ArrowDown') { sel = Math.min(rows.length - 1, sel + 1); render(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(-1, sel - 1); render(); e.preventDefault(); }
      else if (e.key === 'Escape') close();
    });
    form.addEventListener('submit', (e) => {
      if (sel >= 0 && rows[sel]) { e.preventDefault(); location.href = url(rows[sel]); }
    });
    document.addEventListener('click', (e) => { if (!form.contains(e.target)) close(); });
  }
  document.querySelectorAll('form.sb').forEach(bind);

  // 検索ページ
  const results = document.getElementById('results');
  if (results) {
    const q = new URLSearchParams(location.search).get('q') || '';
    const input = document.querySelector('.sb-page .sb-i');
    if (input) input.value = q;
    if (q) {
      results.textContent = '読み込み中…';
      load().then(() => {
        const rows = search(q, 100);
        results.innerHTML = `<p>「${esc(q)}」の結果：${rows.length >= 100 ? '100件以上（上位100件）' : `${rows.length}件`}</p>`
          + (rows.length ? `<ul class="cl">${rows.map((r) => `<li><a href="${url(r)}">${esc(label(r))}<small>${esc(meta(r))}</small></a></li>`).join('')}</ul>` : '');
      }).catch(() => { results.textContent = '索引を読み込めませんでした。時間をおいてお試しください。'; });
    }
  }

  // 表の並べ替え（見出しを押す）。数字の列は多い順→少ない順、順位の列は元の順
  document.querySelectorAll('table.sortable').forEach((table) => {
    const tbody = table.tBodies[0];
    if (!tbody) return;
    const ths = [...table.tHead.rows[0].cells];
    ths.forEach((th, col) => {
      if (!th.dataset.sort) return;
      th.tabIndex = 0;
      const go = () => {
        const desc = th.dataset.sort === 'rank' ? false : th.getAttribute('aria-sort') !== 'descending';
        ths.forEach((x) => x.removeAttribute('aria-sort'));
        th.setAttribute('aria-sort', desc ? 'descending' : 'ascending');
        const rows = [...tbody.rows];
        const val = (tr) => parseFloat(tr.cells[col]?.dataset.v ?? '-1');
        rows.sort((a, b) => (desc ? val(b) - val(a) : val(a) - val(b)));
        rows.forEach((tr) => tbody.appendChild(tr));
      };
      th.addEventListener('click', go);
      th.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  });

  // リンクのコピー
  document.querySelectorAll('.share').forEach((el) => {
    const btn = el.querySelector('.sh-copy');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const u = el.dataset.url || location.href;
      const done = () => { btn.textContent = 'コピーしました'; setTimeout(() => { btn.textContent = 'リンクをコピー'; }, 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText(u).then(done, () => prompt('このリンクをコピーしてください', u));
      else prompt('このリンクをコピーしてください', u);
    });
  });
})();
