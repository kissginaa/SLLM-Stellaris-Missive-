// 「동기화 로그」(기계) / 「공명 보고」(군체) 단추와 보고서 창(알파 11, 2026-10-25). 비서가 없는 단일 의식 제국에서 비서 업무 보고 자리를 채운다.
// body[data-gestalt] 가 있을 때만 보인다(office.html draw()). 문구는 한·영 짝(pick) — 언어 팩과 맞는다. 보고서 문장은 앱(src/gestalt-report.ts)이 만든다.
(() => {
  const P = (ko, en) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(ko, en) : ko);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const NAME = { machine: ['동기화 로그', 'Synchronization log'], hive: ['공명 보고', 'Resonance report'], gestalt: ['의식 보고', 'Consciousness report'] };
  const ICON = { deviant: '⚠', planet: '◆', pledge: '◇', crisis: '✸', war: '✕', feeling: '◎', none: '·' };
  function label() { const b = $('gstCall'); if (!b) return; const k = document.body.dataset.gestalt || ''; b.hidden = !NAME[k]; if (NAME[k]) b.querySelector('span').textContent = P(NAME[k][0], NAME[k][1]); }
  function close() { $('gstPanel')?.remove(); }
  async function open() {
    close();
    const el = h('div', 'gst-panel'); el.id = 'gstPanel'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.dataset.i18nSkip = '';
    const card = h('div', 'gst-card'), head = h('div', 'gst-head'), title = h('b', '', P('불러오는 중…', 'Loading…')), x = h('button', 'gst-x', P('닫기', 'Close')), list = h('ol', 'gst-list'), foot = h('small', 'gst-foot', P('게임 자료로 만든 보고입니다(AI 호출 없음). 매달 새로 고쳐집니다.', 'Built from game data (no AI calls). It updates every month.'));
    x.type = 'button'; x.onclick = close; head.append(title, x); card.append(head, list, foot); el.append(card); document.body.append(el); x.focus();
    el.addEventListener('click', (e) => { if (e.target === el) close(); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } });
    let r = null; try { r = await window.sllm.gestaltReport(); } catch (e) { r = null; }
    if (!r || !r.ok) { title.textContent = P('보고를 만들지 못했습니다', 'Could not build the report'); return; }
    title.textContent = r.title + (r.date ? ' · ' + r.date : '');
    for (const it of r.items || []) { const li = h('li', 'gst-' + it.tag); li.append(h('i', '', ICON[it.tag] || '·'), h('span', '', it.text)); list.append(li); }
  }
  document.addEventListener('DOMContentLoaded', () => {
    const call = $('secCall'); if (!call || $('gstCall')) return;
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'gstCall'; b.hidden = true;
    b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="7" width="30" height="34" rx="2"/><path d="M15 15h18M15 21h18M15 27h12"/><circle cx="33" cy="33" r="5"/><path d="M33 30v3l2 2"/></svg>';
    b.append(h('span', '', '')); b.onclick = open; call.after(b);
    const st = document.createElement('style'); st.textContent = '#gstCall[hidden]{display:none}.gst-panel{position:fixed;inset:0;z-index:60;background:#0008;display:flex;align-items:center;justify-content:center}.gst-card{width:min(620px,92vw);max-height:80vh;overflow:auto;background:var(--panel,#0b2230);color:var(--text,#dcecf0);border:1px solid var(--hi,#5fd4e4);padding:14px 16px}.gst-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}.gst-head b{color:var(--hi,#5fd4e4);font-size:15px}.gst-x{background:transparent;color:var(--dim,#7fa3ad);border:1px solid var(--dim,#7fa3ad);padding:2px 10px;cursor:pointer}.gst-list{list-style:none;margin:0;padding:0}.gst-list li{display:flex;gap:8px;padding:6px 0;border-bottom:1px solid #ffffff14;line-height:1.45}.gst-list li i{font-style:normal;color:var(--hi,#5fd4e4);width:1.2em;flex:none}.gst-list li.gst-deviant i,.gst-list li.gst-crisis i{color:var(--bad,#e0705f)}.gst-foot{display:block;margin-top:8px;color:var(--dim,#7fa3ad)}';
    document.head.append(st);
    new MutationObserver(label).observe(document.body, { attributes: true, attributeFilter: ['data-gestalt'] });
    document.addEventListener('sllm-language', label); label();
  });
  window.SLLMGestaltReport = { open };
})();
