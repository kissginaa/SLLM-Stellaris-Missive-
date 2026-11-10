// 신규 식민지 이름 짓기(명명식, 2026-11-04 사용자) — 집무실 「행성 총독」 칸의 「행성 이름 짓기」(기다리는 식민지가 있을 때만 보임).
// 앱: src/features/colname-app.ts · 규칙: src/colname.ts. 후보 3개(게임 이름 표) + 「기본 이름 그대로」 + 「정착민에게 물어보기」(LLM). 문구는 L(한, 영)만 — 언어 팩 호환.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const show = (id) => { if (!$(id)) return; for (const v of document.querySelectorAll('.view')) v.classList.toggle('on', v.id === id); };
  const css = () => { if ($('cnCss')) return; const st = h('style'); st.id = 'cnCss'; st.textContent = [
    '#cnRoot{display:flex;flex-direction:column;gap:12px;overflow-y:auto;padding:12px 16px}',
    '#cnRoot .cn-note{font-size:12px;opacity:.75;line-height:1.6}',
    '#cnRoot .cn-card{padding:10px 12px;border:1px solid color-mix(in srgb,var(--hi) 40%,transparent);border-radius:8px;background:color-mix(in srgb,var(--hi) 6%,transparent)}',
    '#cnRoot .cn-card h4{margin:0 0 2px;font-size:14px}',
    '#cnRoot .cn-card small{display:block;opacity:.65;font-size:11px;margin-bottom:8px}',
    '#cnRoot .cn-btns{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0}',
    '#cnRoot button.cn-b{border:1px solid var(--hi);background:color-mix(in srgb,var(--hi) 12%,transparent);color:var(--text);border-radius:5px;padding:5px 11px;cursor:pointer;font-size:12.5px}',
    '#cnRoot button.cn-b.keep{border-style:dashed;opacity:.85}',
    '#cnRoot button.cn-b.ask{box-shadow:0 0 0 1px #ffd36b inset}',
    '#cnRoot button.cn-b:disabled{opacity:.45;cursor:default}',
    '#cnRoot .cn-asked{display:flex;flex-direction:column;gap:4px;margin-top:6px}',
    '#cnRoot .cn-asked button{text-align:left}',
    '#cnRoot .cn-asked i{display:block;font-size:11.5px;opacity:.7;font-style:normal}',
    '#cnRoot .cn-msg{font-size:12px;opacity:.8;min-height:1em}',
    '#cnRoot label.cn-opt{font-size:12px;display:flex;gap:6px;align-items:center;opacity:.85}',
  ].join(''); document.head.append(st); };

  function view(holo) {
    if ($('colName')) return;
    const sec = h('section', 'view app'); sec.id = 'colName'; sec.setAttribute('aria-label', L('행성 이름 짓기', 'Name new colonies'));
    const hd = h('div', 'apph'); const back = h('button', 'back', '‹ ' + L('바탕화면', 'Desktop')); back.type = 'button'; back.onclick = () => show('desktop');
    hd.append(back, h('h3', '', L('행성 이름 짓기', 'Name new colonies'))); const body = h('div', 'appb'); body.id = 'cnRoot';
    sec.append(hd, body); holo.append(sec);
  }
  async function mount(root) {
    css(); root.textContent = '';
    let S; try { S = await window.sllm.colNameState(); } catch (e) { S = null; }
    if (!S || !S.ok) { root.append(h('div', 'cn-note', L('세이브를 불러온 뒤에 열 수 있습니다.', 'Load a save first.'))); return; }
    root.append(h('div', 'cn-note', L('우리가 직접 개척한 행성에 첫 정착민이 내리면 여기에 올라옵니다. 이름 표의 후보를 고르거나, 정착민에게 직접 물어보거나, 기본 이름을 그대로 둘 수 있습니다.', 'When the first settlers land on a world we colonised ourselves, it appears here. Pick a name from the list, ask the settlers, or keep the default name.')));
    const opt = h('label', 'cn-opt'), cb = h('input'); cb.type = 'checkbox'; cb.checked = !!S.notify; cb.onchange = () => { void window.sllm.colNameNotify(cb.checked); };
    opt.append(cb, document.createTextNode(L('새 식민지 알림 받기', 'Notify me about new colonies'))); root.append(opt);
    if (!S.pending.length) { root.append(h('div', 'cn-note', L('이름을 기다리는 식민지가 없습니다.', 'No colonies are waiting for a name.'))); return; }
    if (!S.running) root.append(h('div', 'cn-note', L('이름을 바꾸려면 게임이 켜져 있어야 합니다.', 'The game must be running to rename a planet.')));
    for (const p of S.pending) {
      const card = h('div', 'cn-card'); card.append(h('h4', '', p.name), h('small', '', [p.cls, p.sys ? L(`${p.sys} 성계`, `${p.sys} system`) : '', p.date].filter(Boolean).join(' · ')));
      const btns = h('div', 'cn-btns'), asked = h('div', 'cn-asked'), msg = h('div', 'cn-msg'); card.append(btns, asked, msg);
      const lock = (on) => { for (const b of card.querySelectorAll('button')) b.disabled = on; };
      const pick = async (arg, label) => { lock(true); msg.textContent = L('게임에 전하는 중…', 'Sending to the game…');
        let r; try { r = await window.sllm.colNamePick({ idx: p.idx, ...arg }); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
        if (r && r.ok) { msg.textContent = arg.keep ? L('기본 이름을 그대로 둡니다.', 'Keeping the default name.') : L(`이제 「${r.name || label}」입니다.`, `It is now "${r.name || label}".`); setTimeout(() => { void mount(root); void refreshIcon(); }, 900); }
        else { msg.textContent = (r && r.error) || L('실패했습니다.', 'Failed.'); lock(false); } };
      for (const c of p.cands) { const b = h('button', 'cn-b', c.text); b.type = 'button'; b.disabled = !S.running; b.onclick = () => pick({ key: c.key }, c.text); btns.append(b); }
      if (!p.cands.length) btns.append(h('span', 'cn-note', L('이름 표에서 후보를 찾지 못했습니다.', 'No names found in the name lists.')));
      const ask = h('button', 'cn-b ask', p.asked ? L('정착민에게 다시 물어보기', 'Ask the settlers again') : L('정착민에게 물어보기', 'Ask the settlers')); ask.type = 'button';
      ask.onclick = async () => { lock(true); msg.textContent = L('정착민들이 의논하는 중…', 'The settlers are talking it over…');
        let r; try { r = await window.sllm.colNameAsk(p.idx); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
        if (r && r.ok) { void mount(root); } else { msg.textContent = (r && r.error) || L('실패했습니다.', 'Failed.'); lock(false); } };
      const keep = h('button', 'cn-b keep', L('기본 이름 그대로', 'Keep the default name')); keep.type = 'button'; keep.onclick = () => pick({ keep: true }, p.name);
      btns.append(ask, keep);
      if (p.asked) for (const a of p.asked) { const b = h('button', 'cn-b', a.name); b.type = 'button'; b.disabled = !S.running; if (a.why) b.append(h('i', '', a.why)); b.onclick = () => pick({ text: a.name }, a.name); asked.append(b); }
      root.append(card);
    }
  }
  function open() { const holo = $('policy') && $('policy').parentElement; if (!holo) return; view(holo); show('colName'); void mount($('cnRoot')); }
  async function refreshIcon() {
    let S = null; try { S = await window.sllm.colNameState(); } catch (e) { /* 다음에 */ }
    const n = S && S.ok ? S.pending.length : 0, row = $('govGrp') && $('govGrp').querySelector('.row');
    let b = $('cnCall');
    if (!n) { if (b) b.remove(); return; }
    if (!b && row) {
      b = h('button', 'ic'); b.type = 'button'; b.id = 'cnCall';
      b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="20" cy="26" r="11"/><path d="M9 26c4-2 18-2 22 0"/><path d="M30 10l8 8-12 12-9 1 1-9z"/></svg>';
      b.append(h('span', '', L('행성 이름 짓기', 'Name colonies'))); b.onclick = open; row.prepend(b);
    }
    if (b) b.title = L(`이름을 기다리는 식민지 ${n}곳`, `${n} colon${n === 1 ? 'y' : 'ies'} waiting for a name`);
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.colNameState) return;
    setTimeout(refreshIcon, 700); setInterval(refreshIcon, 20000); // 「행성 총독」 칸(office-govgroup.js, 300ms) 뒤
    if (window.sllm.onOfficeGo) window.sllm.onOfficeGo((v) => { if (v === 'colname') { void refreshIcon(); open(); } });
    document.addEventListener('sllm-language', () => { const b = $('cnCall'); if (b) b.querySelector('span').textContent = L('행성 이름 짓기', 'Name colonies'); });
  });
})();
