// 국가 문서 서식 그리기(알파 11, 2026-10-25). 앱이 글을 만들어 주고(src/state-docs.ts renderDoc), 여기서는 모양만 그린다.
// window.SLLMDocs.render(view) → 문서 요소, .open(view) → 화면 위에 띄움, .openId(id) → 앱에서 읽어 띄움.
// 고정 문구는 P(한, 영)(언어 팩 호환). 문서 글은 앱이 이미 화면 언어로 만들어 준 것이라 자동 번역에서 뺀다(data-i18n-skip).
(() => {
  const P = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const NS = 'http://www.w3.org/2000/svg';
  const svg = (html, cls, vb = '0 0 100 100') => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', vb); if (cls) s.setAttribute('class', cls); s.innerHTML = html; return s; };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const SCALE = '<g fill="none" stroke="#9a7b3c" stroke-width="2.2"><circle cx="50" cy="50" r="44"/><circle cx="50" cy="50" r="36" stroke-width="1"/><path d="M50 18 L50 82 M30 34 L70 34 M34 34 L28 56 L40 56 Z M66 34 L60 56 L72 56 Z M38 82 L62 82"/><circle cx="50" cy="18" r="3" fill="#9a7b3c"/></g>';
  const MASK = '<g fill="none" stroke="#7a4fa0" stroke-width="2.2"><circle cx="50" cy="50" r="44"/><circle cx="50" cy="50" r="36" stroke-width="1"/><path d="M30 36c6 4 14 4 20 0 6 4 14 4 20 0v10c0 12-9 22-20 22S30 58 30 46z"/><path d="M38 46c2-2 6-2 8 0M54 46c2-2 6-2 8 0M42 58c5 4 11 4 16 0"/></g>';
  const LOGO = {
    xura: '<g fill="none" stroke="#eef4f3" stroke-width="3"><path d="M30 4 L54 18 L54 42 L30 56 L6 42 L6 18 Z"/><path d="M18 20 L42 40 M42 20 L18 40"/></g>',
    riggan: '<g fill="none" stroke="#eef4f3" stroke-width="3"><circle cx="30" cy="30" r="25"/><path d="M30 8 L30 52 M12 30 L48 30"/><circle cx="30" cy="30" r="9"/></g>',
    muutagan: '<g fill="none" stroke="#f1e3b8" stroke-width="3"><path d="M30 5 L40 22 L30 55 L20 22 Z"/><path d="M20 22 L40 22 M10 34 Q30 26 50 34"/></g>',
  };
  function seal(v, color) {
    const c = color || '#a3241c';
    return svg(`<defs><path id="sdc" d="M50 50 m-38 0 a38 38 0 1 1 76 0 a38 38 0 1 1 -76 0"/></defs><g fill="none" stroke="${c}"><circle cx="50" cy="50" r="47" stroke-width="2.5"/><circle cx="50" cy="50" r="43" stroke-width=".8"/><circle cx="50" cy="50" r="27" stroke-width="1.6"/></g>`
      + `<text font-size="7.6" fill="${c}" letter-spacing="1.4" font-family="Georgia,serif"><textPath href="#sdc">${esc(v.seal.ring)}</textPath></text>`
      + `<text x="50" y="47" text-anchor="middle" font-size="9" fill="${c}" font-weight="700">${esc(v.seal.center[0])}</text><text x="50" y="60" text-anchor="middle" font-size="9" fill="${c}" font-weight="700">${esc(v.seal.center[1])}</text>`, 'sd-seal');
  }
  function table(v) {
    const t = h('table');
    for (const f of v.fields) {
      const tr = h('tr'), k = h('td', 'k', f.k), d = h('td');
      if (f.cls === 'grade') d.append(h('span', 'sd-grade sd-g' + (f.grade || 1), f.v)); else { d.textContent = f.v; if (f.cls) d.className = 'sd-' + f.cls; }
      tr.append(k, d); t.append(tr);
    }
    return t;
  }
  const wm = (v) => { const w = h('div', 'sd-wm'); if (v.emblem) { const i = h('img'); i.src = v.emblem; i.alt = ''; w.append(i); } return w; };
  const micro = (s) => h('div', 'sd-micro', s.repeat(70));
  function sign(v, sealEl) {
    const row = h('div', 'sd-sign'), box = h('div', 'sd-sigbox');
    const line = h('div', 'sd-line', v.signer); if (v.signerRole) line.append(h('small', '', v.signerRole));
    box.append(h('div', 'sd-date', v.issued), h('div', 'sd-sig', v.signature), line); row.append(box, sealEl); return row;
  }
  function body(v) { const b = h('div', 'sd-body'); if (v.bodyHead) b.append(h('h4', '', v.bodyHead)); b.append(h('p', '', v.body)); return b; }
  function picOrNull(v) { if (!v.img) return null; const p = h('div', 'sd-pic'), i = h('img'); i.src = v.img; i.alt = ''; p.append(i); return p; }

  function curator(v) {
    const art = v.theme === 'artist';
    const doc = h('article', 'sd-doc ' + (art ? 't-artist' : 't-curator')), fr = h('div', 'sd-frame'), inn = h('div', 'sd-inner'); fr.append(inn); doc.append(fr);
    const head = h('div', 'sd-head'); head.append(h('div', 'sd-org', v.org), svg(art ? MASK : SCALE, 'sd-emb'), h('h1', 'sd-title', v.title), h('div', 'sd-sub', v.sub));
    const meta = h('div', 'sd-meta'); meta.append(h('span', '', P('문서 번호  ', 'Document No.  ') + v.no), h('span', '', v.ref2 || ''));
    const grid = h('div', 'sd-grid'), pic = picOrNull(v); grid.append(table(v)); if (pic) { grid.classList.add('with-img'); grid.append(pic); }
    inn.append(wm(v), head, meta, grid, body(v), micro(art ? 'ARTISAN TROUPE · A CREATIVE DAY · ' : 'CURATOR ORDER · AUTHENTICATED · '), sign(v, seal(v, art ? '#6b3f8f' : null)));
    return doc;
  }
  function merchant(v) {
    const doc = h('article', 'sd-doc t-' + v.theme), band = h('div', 'sd-band');
    const name = h('div'); name.append(h('b', '', v.theme === 'xura' ? 'XURACORP' : v.theme === 'riggan' ? 'RIGGAN' : 'MUUTAGAN'), h('small', '', v.org));
    const r = h('div', 'r'); r.append(document.createTextNode(P('보증서 번호 ', 'Certificate No. ') + v.no), h('br'), document.createTextNode(v.ref2 || ''));
    band.append(svg(LOGO[v.theme], 'sd-logo', '0 0 60 60'), name, r);
    const g = (v.fields.find((f) => f.cls === 'grade') || {}).grade || 1;
    const mb = h('div', 'sd-mbody'), head = h('div', 'sd-head'); head.append(h('h1', 'sd-title', v.title), h('div', 'sd-sub', v.sub));
    const grid = h('div', 'sd-grid with-img'), holo = h('div', 'sd-holo'), hs = h('span'); hs.append(document.createTextNode(P('정품', 'GENUINE')), h('br'), document.createTextNode(P('보증', 'ARTICLE')), h('small', '', v.theme.toUpperCase())); holo.append(hs);
    const side = h('div'); side.style.display = 'flex'; side.style.flexDirection = 'column'; side.style.gap = '12px'; side.style.alignItems = 'center'; const pic = picOrNull(v); if (pic) side.append(pic); side.append(holo);
    grid.append(table(v), side);
    const bar = h('div', 'sd-sign'), bc = h('div', 'sd-bc'); bc.append(h('div', 'sd-barcode'), h('small', '', v.no.replace(/^SLLM-/, '')));
    const box = h('div', 'sd-sigbox'), line = h('div', 'sd-line', v.signer); line.append(h('small', '', v.signerRole)); box.append(h('div', 'sd-date', v.issued), h('div', 'sd-sig', v.signature), line); bar.append(bc, box);
    mb.append(wm(v), head, grid, body(v), bar, h('div', 'sd-fine', v.fine || ''));
    doc.append(band, h('div', 'sd-tier g' + g), mb); return doc;
  }
  function state(v) {
    const doc = h('article', 'sd-doc t-state'), fr = h('div', 'sd-frame'), inn = h('div', 'sd-inner'); fr.append(inn); doc.append(fr);
    const head = h('div', 'sd-head'); if (v.emblem) { const i = h('img', 'sd-emb-img'); i.src = v.emblem; i.alt = ''; head.append(i); }
    head.append(h('div', 'sd-gov', v.nation || v.org), h('div', 'sd-rule'), h('h1', 'sd-title', v.title), h('div', 'sd-sub', v.sub));
    const meta = h('div', 'sd-meta'); meta.append(h('span', '', P('문서 번호  ', 'Document No.  ') + v.no), h('span', '', ''));
    const sq = h('div', 'sd-squareseal'); sq.append(document.createTextNode(v.seal.center[0]), h('br'), document.createTextNode(v.seal.center[1]));
    inn.append(wm(v), head, meta, table(v), body(v), micro(((v.nation || 'STATE') + ' · OFFICIAL RECORD · ').toUpperCase()), sign(v, sq));
    if (v.stamp) { const s = h('div', 'sd-stamp ' + v.stamp.tone, v.stamp.text); if (v.stamp.sub) s.append(h('small', '', v.stamp.sub)); inn.append(s); }
    return doc;
  }
  function render(v) { const el = v.theme === 'curator' || v.theme === 'artist' ? curator(v) : v.theme === 'state' ? state(v) : merchant(v); el.setAttribute('data-i18n-skip', ''); return el; }
  function open(v) {
    document.querySelectorAll('.sd-overlay').forEach((x) => x.remove());
    const ov = h('div', 'sd-overlay'), bar = h('div', 'sd-bar'), pr = h('button', '', P('인쇄 · PDF', 'Print · PDF')), cl = h('button', '', P('닫기', 'Close'));
    pr.type = cl.type = 'button'; pr.onclick = () => window.print(); const close = () => { ov.remove(); document.removeEventListener('keydown', key); };
    const key = (e) => { if (e.key === 'Escape') close(); }; cl.onclick = close; ov.onclick = (e) => { if (e.target === ov) close(); };
    bar.append(pr, cl); ov.append(bar, render(v)); document.body.append(ov); document.addEventListener('keydown', key); return ov;
  }
  async function openId(id) { const r = await window.sllm.docsOpen(id); if (!r || !r.ok) throw new Error((r && r.error) || 'document'); return open(r.doc); }
  window.SLLMDocs = { render, open, openId };
})();
