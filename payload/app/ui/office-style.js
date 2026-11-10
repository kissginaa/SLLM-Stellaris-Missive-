// 집무실 종류(2026-10-19): 제국 가치관에 따라 집무실 배경이 달라진다. 「집무실 꾸미기」 단추로 자동/직접 고르기(세이브마다).
// 배경 그림: assets/rooms/office-<종류>.png (GPT 가 그림, docs/GPT_SECRETARY_TODO_KO.md). 없으면 기본 office-ai-v1.png 그대로.
// body[data-office="<종류>"] 와 CSS 변수 --office-bg 로 방 배경과 비서 장면의 책상 전경(office-art.css)이 함께 바뀐다.
// 언어 팩 규칙: 문구는 L('한국어', 'English')(SLLMI18n.pick)으로만.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  let st = null, applied = '', req = 0;
  const FALLBACK = { machine: 'gestalt' }; // 기계 지성 집무실 그림이 오기 전에는 단일 의식(군체) 집무실 그림(알파 11)
  function apply(key) {
    if (!key || key === applied) return; applied = key; const my = ++req;
    document.body.dataset.office = key;
    if (key === 'standard') { document.body.style.removeProperty('--office-bg'); return; }
    const src = 'assets/rooms/office-' + key + '.png', im = new Image();
    im.onload = () => { if (my === req) document.body.style.setProperty('--office-bg', "url('" + src + "')"); };
    im.onerror = () => { if (my !== req) return; if (FALLBACK[key]) { const f = 'assets/rooms/office-' + FALLBACK[key] + '.png', i2 = new Image(); i2.onload = () => { if (my === req) document.body.style.setProperty('--office-bg', "url('" + f + "')"); }; i2.onerror = () => { if (my === req) document.body.style.removeProperty('--office-bg'); }; i2.src = f; return; } document.body.style.removeProperty('--office-bg'); }; // 그림이 아직 없으면 비슷한 집무실(기계 → 군체), 그것도 없으면 기본
    im.src = src;
  }
  function applyEmblem(state) {
    let layer = document.getElementById('officeEmblems');
    const room = document.getElementById('room');
    if (!room) return;
    if (!layer) {
      layer = document.createElement('div'); layer.id = 'officeEmblems';
      layer.setAttribute('aria-hidden', 'true');
      for (const side of ['left', 'right']) { const emblem = document.createElement('i'); emblem.className = 'office-emblem ' + side; layer.append(emblem); }
      room.append(layer);
    }
    const url = state && state.emblemUrl;
    const valid = typeof url === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(url);
    layer.hidden = !valid;
    if (valid) layer.style.setProperty('--office-emblem', 'url("' + url + '")');
    else layer.style.removeProperty('--office-emblem');
  }

  async function refresh() { try { st = await window.sllm.officeStyle(); if (st) { apply(st.applied); applyEmblem(st); } } catch (e) { /* 무시 */ } }
  function closeMenu() { $('ofsMenu')?.remove(); }
  function openMenu(btn) {
    if ($('ofsMenu')) { closeMenu(); return; }
    const m = h('div', 'ofs-menu'); m.id = 'ofsMenu'; m.dataset.i18nSkip = ''; m.setAttribute('role', 'menu');
    m.append(h('b', '', L('집무실 꾸미기', 'Office style')));
    const pickIt = async (key) => { try { const r = await window.sllm.officeStyleSet(key); if (r && r.state) { st = r.state; apply(st.applied); applyEmblem(st); } } catch (e) { /* 무시 */ } closeMenu(); };
    const row = (key, label, sub) => { const b = h('button', 'ofs-opt' + ((st && st.choice) === key ? ' on' : '')); b.type = 'button'; b.setAttribute('role', 'menuitemradio'); b.append(h('span', '', label)); if (sub) b.append(h('small', '', sub)); b.onclick = () => pickIt(key); m.append(b); };
    row('auto', L('자동 · 제국 가치관 따라', 'Auto · follow our ethics'), st ? (st.autoKnown ? st.autoLabel : L('가치관을 아직 모름 → 기본', 'Ethics unknown yet → standard')) : '');
    for (const o of (st && st.options) || []) row(o.key, o.label, '');
    m.append(h('p', '', L('그림이 아직 없는 집무실은 기본 집무실로 보입니다.', 'Styles without artwork yet show the standard office.')));
    document.body.append(m);
    const r = btn.getBoundingClientRect(); m.style.left = Math.max(8, Math.min(window.innerWidth - 270, r.left)) + 'px'; m.style.top = Math.min(window.innerHeight - m.offsetHeight - 8, r.bottom + 6) + 'px';
  }
  document.addEventListener('DOMContentLoaded', () => {
    const call = $('secCall'); const row = call && call.parentElement;
    if (row && !$('ofsBtn')) {
      const b = h('button', 'ic'); b.type = 'button'; b.id = 'ofsBtn';
      b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 40V18L24 8l16 10v22z"/><path d="M8 40h32M17 40V27h14v13M24 8v6"/></svg>';
      b.append(h('span', '', L('집무실 꾸미기', 'Office style')));
      b.onclick = (e) => { e.stopPropagation(); openMenu(b); };
      call.after(b);
    }
    document.addEventListener('click', (e) => { const m = $('ofsMenu'); if (m && !m.contains(e.target)) closeMenu(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('ofsMenu')) { e.stopPropagation(); closeMenu(); } }, true);
    document.addEventListener('sllm-language', () => { const s = $('ofsBtn')?.querySelector('span'); if (s) s.textContent = L('집무실 꾸미기', 'Office style'); closeMenu(); });
    refresh(); setInterval(refresh, 15000); document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); }); // 세이브·가치관이 바뀌면 따라간다
  });
  window.SLLMOfficeStyle = { refresh, apply };
})();
