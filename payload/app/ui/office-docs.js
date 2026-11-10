// 집무실 「국가 문서함」(알파 11, 2026-10-25). 앱: src/features/collectibles-app.ts(docsList·docsOpen), 서식: ui/state-docs.js.
// 보증서·감정서·국가 공인 문서를 모아 열람한다. 문구는 L('한국어', 'English')(언어 팩 호환). 문서 제목은 앱이 화면 언어로 만들어 준다.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  let S = null, filter = 'all', err = '';
  const show = (id) => { if (!document.getElementById(id)) return; for (const v of document.querySelectorAll('.view')) v.classList.toggle('on', v.id === id); }; // 없는 화면으로 가면 모든 화면이 꺼져 빈 홀로그램만 남는다(2026-10-29 테스터)
  const css = '#docsRoot{display:block;overflow-y:auto;padding:12px 16px}.docs-tabs{display:flex;gap:6px;margin:4px 0 12px}.docs-tabs button{border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--text);padding:5px 12px;border-radius:4px;cursor:pointer}.docs-tabs button[aria-pressed=true]{border-color:var(--hi);color:var(--hi)}'
    + '.docs-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}.docs-card{text-align:left;border:1px solid var(--line);border-left:4px solid #9a7b3c;background:#f4ecd8;color:#2b2418;padding:10px 12px;border-radius:3px;cursor:pointer;font-family:"Noto Serif KR",Georgia,serif}'
    + '.docs-card.t-xura{border-left-color:#1d5c63}.docs-card.t-riggan{border-left-color:#6a2c3c}.docs-card.t-muutagan{border-left-color:#2b6e6a}.docs-card.t-state{border-left-color:#24365c}.docs-card b{display:block;font-size:14px}.docs-card small{display:block;color:#8a7a5c;font-family:Consolas,monospace;font-size:11px;margin-top:4px}.docs-empty{color:var(--muted);padding:30px 0;text-align:center}.docs-err{color:#e88}';
  async function load() { try { S = await window.sllm.docsList(); err = S && !S.ok ? S.error : ''; } catch (e) { S = null; err = String(e); } draw(); }
  function draw() {
    const root = $('docsRoot'); if (!root) return; root.replaceChildren();
    const tabs = h('div', 'docs-tabs');
    for (const [id, ko, en] of [['all', '전체', 'All'], ['warranty', '보증서', 'Certificates'], ['appraisal', '감정서', 'Appraisals'], ['contract', '계약서', 'Contracts'], ['pledge', '국가 공인 문서', 'State records']]) {
      const b = h('button', '', L(ko, en)); b.type = 'button'; b.setAttribute('aria-pressed', String(filter === id)); b.onclick = () => { filter = id; draw(); }; tabs.append(b);
    }
    root.append(tabs);
    if (err) root.append(h('p', 'docs-err', err));
    const docs = (S && S.ok ? S.docs : []).filter((d) => filter === 'all' || d.kind === filter || (filter === 'pledge' && d.kind === 'crisis'));
    if (!docs.length) { root.append(h('p', 'docs-empty', L('보관된 문서가 없습니다. 상인에게서 수집품을 사면 보증서가, 큐레이터에게 빌려준 물건이 돌아오면 감정서가 여기에 쌓입니다.', 'No documents yet. Certificates arrive when you buy collectibles from merchants; appraisals arrive when items lent to the Curators come back.'))); return; }
    const list = h('div', 'docs-list'); list.setAttribute('data-i18n-skip', '');
    for (const d of docs) { const c = h('button', 'docs-card t-' + d.theme); c.type = 'button'; c.append(h('b', '', d.title), h('small', '', d.no + ' · ' + d.date)); c.onclick = () => window.SLLMDocs.openId(d.id).catch((e) => { err = e.message; draw(); }); list.append(c); }
    root.append(list);
  }
  function build() {
    const after = $('loreCall') || $('fbCall') || $('retCall') || $('gcCall'); const holo = $('policy') && $('policy').parentElement;
    if (!after || !holo || $('docs')) return;
    const st = h('style'); st.textContent = css; document.head.append(st);
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'docsCall';
    b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 8h20l8 8v24H10z"/><path d="M30 8v8h8"/><path d="M15 22h16M15 28h16M15 34h9"/><circle cx="33" cy="35" r="5"/><path d="M31 39l-1 5 3-2 3 2-1-5"/></svg>';
    b.append(h('span', '', L('국가 문서함', 'State archive')));
    b.onclick = () => { show('docs'); load(); };
    after.after(b);
    const sec = h('section', 'view app'); sec.id = 'docs'; sec.setAttribute('aria-label', L('국가 문서함', 'State archive'));
    const hd = h('div', 'apph'), back = h('button', 'back', '‹ ' + L('바탕화면', 'Desktop')); back.type = 'button'; back.onclick = () => show('desktop');
    hd.append(back, h('h3', '', L('국가 문서함', 'State archive'))); const body = h('div', 'appb'); body.id = 'docsRoot';
    sec.append(hd, body); holo.append(sec);
  }
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { build(); }, 160); // 서재 아이콘(140ms) 뒤
    if (window.sllm.onDocsUpdate) window.sllm.onDocsUpdate(() => { if ($('docs') && $('docs').classList.contains('on')) load(); });
    document.addEventListener('sllm-language', () => { const b = $('docsCall'); if (b) b.querySelector('span').textContent = L('국가 문서함', 'State archive'); draw(); });
  });
})();
