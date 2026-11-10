// 함대 명명 건(2026-11-04 사용자) — 내각 회의실 스크린의 안건 목록 아래 「제독 건의」 카드. 앱: src/features/fleetname-app.ts · 규칙: src/fleetname.ts
// 회의실 본문(cabinet-room.html)은 건드리지 않는다: 목록(#plist)이 다시 그려질 때마다 카드를 덧붙이고, 누르면 회의실 위에 작은 창을 띄운다.
// 열 때만 LLM(제독이 이름 3개 + 까닭). 채택·직접 짓기·기각(그냥 넘어감). 장관 안건 채택(게임 의제·버프)과는 따로 처리된다. 문구는 ui(한, 영)만 — 언어 팩 호환.
(() => {
  const ui = (ko, en) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(ko, en) : ko);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  let S = null;
  const css = () => { if ($('fnCss')) return; const st = h('style'); st.id = 'fnCss'; st.textContent = [
    '.prop.fn{--ec:var(--gold,#d9b45a);background:#1c1a0f}',
    '.prop.fn .an{color:var(--gold,#d9b45a)}',
    '#fnBox{position:fixed;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;background:#000a;-webkit-app-region:no-drag}',
    '#fnBox .fn-p{width:min(560px,92vw);max-height:84vh;overflow-y:auto;padding:16px 18px;border:1px solid var(--gold,#d9b45a);border-radius:8px;background:#0b1015f2;display:flex;flex-direction:column;gap:10px}',
    '#fnBox h3{margin:0;color:var(--gold,#d9b45a);font-size:16px}',
    '#fnBox .fn-by{font-size:12px;color:var(--dim,#8aa4ac)}',
    '#fnBox .fn-c{display:flex;flex-direction:column;gap:6px}',
    '#fnBox button{border:1px solid var(--hi,#5fd4e4);background:#5fd4e41a;color:var(--text,#e3edf0);border-radius:5px;padding:6px 12px;cursor:pointer;text-align:left}',
    '#fnBox button i{display:block;font-style:normal;font-size:11.5px;color:var(--dim,#8aa4ac);margin-top:2px}',
    '#fnBox button:disabled{opacity:.45;cursor:default}',
    '#fnBox .fn-row{display:flex;gap:6px;flex-wrap:wrap}',
    '#fnBox input{flex:1;min-width:160px;padding:6px 8px;background:#000;border:1px solid #5fd4e455;color:var(--text,#e3edf0);border-radius:4px}',
    '#fnBox .fn-msg{font-size:12px;min-height:1em;color:var(--dim,#8aa4ac)}',
    '#fnBox .rej{border-style:dashed;opacity:.85}',
  ].join(''); document.head.append(st); };

  async function load() { try { S = await window.sllm.fleetNameState(); } catch (e) { S = null; } decorate(); }
  function decorate() {
    const pl = $('plist'); if (!pl || pl.hidden || !S || !S.ok) return;
    for (const old of pl.querySelectorAll('.prop.fn')) old.remove();
    for (const p of S.pending) {
      const b = h('button', 'prop fn'); b.type = 'button'; b.dataset.fn = p.id;
      const an = h('div', 'an', ui(`${p.fleet} 명명 건`, `Naming ${p.fleet}`)); an.setAttribute('data-i18n-skip', '');
      const by = h('div', 'by', ui(`제독 건의 · ${p.adm}`, `Admiral's proposal · ${p.adm}`) + (p.sys ? ' · ' + ui(`${p.sys} 전투 승리 기념`, `honouring the victory at ${p.sys}`) : ''));
      b.append(an, by); b.onclick = (e) => { e.stopPropagation(); open(p.id); }; pl.append(b);
    }
  }
  function close() { const x = $('fnBox'); if (x) x.remove(); }
  async function open(id, again) {
    css(); close();
    const p = S && S.pending.find((x) => x.id === id); if (!p) return;
    const box = h('div'); box.id = 'fnBox'; const pn = h('div', 'fn-p'); box.append(pn); document.body.append(box);
    box.onclick = (e) => { if (e.target === box) close(); };
    pn.append(h('h3', '', ui(`${p.fleet} 명명 건`, `Naming ${p.fleet}`)), h('div', 'fn-by', [ui(`${p.adm} 제독 건의`, `Proposed by Admiral ${p.adm}`), p.enemy ? ui(`${p.enemy} 상대 승리`, `victory over ${p.enemy}`) : '', p.sys, p.date].filter(Boolean).join(' · ')));
    const list = h('div', 'fn-c'), msg = h('div', 'fn-msg'); pn.append(list);
    const lock = (on) => { for (const b of pn.querySelectorAll('button,input')) b.disabled = on; };
    const pick = async (arg) => { lock(true); msg.textContent = arg.reject ? '' : ui('게임에 전하는 중…', 'Sending to the game…');
      let r; try { r = await window.sllm.fleetNamePick({ id: p.id, ...arg }); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
      if (r && r.ok) { S = r.view; msg.textContent = arg.reject ? ui('안건을 기각했습니다.', 'Proposal rejected.') : ui(`이제 「${r.name}」입니다.`, `It is now "${r.name}".`); setTimeout(() => { close(); decorate(); }, 900); }
      else { msg.textContent = (r && r.error) || ui('실패했습니다.', 'Failed.'); lock(false); void load(); } };
    if (!p.cands || again) {
      list.append(h('div', 'fn-by', ui(`${p.adm} 제독이 건의를 설명하는 중…`, `Admiral ${p.adm} is presenting the proposal…`))); pn.append(msg);
      let r; try { r = await window.sllm.fleetNameAsk(p.id, !!again); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
      if (!$('fnBox')) return;
      if (r && r.ok) { S = r.view; return open(id); }
      list.textContent = ''; msg.textContent = (r && r.error) || ui('실패했습니다.', 'Failed.');
      const re = h('button', '', ui('다시 묻기', 'Ask again')); re.type = 'button'; re.onclick = () => open(id, true); list.append(re); return;
    }
    for (const c of p.cands) { const b = h('button', '', c.name); b.type = 'button'; b.disabled = !S.running; if (c.why) b.append(h('i', '', c.why)); b.onclick = () => pick({ name: c.name }); list.append(b); }
    const own = h('div', 'fn-row'), inp = h('input'); inp.maxLength = 40; inp.placeholder = ui('직접 짓기', 'Your own name');
    const go = h('button', '', ui('이 이름으로', 'Use this name')); go.type = 'button'; go.disabled = !S.running; go.onclick = () => { if (inp.value.trim()) pick({ name: inp.value }); };
    own.append(inp, go);
    const row = h('div', 'fn-row'), re = h('button', '', ui('다른 이름 듣기', 'Hear other names')), rej = h('button', 'rej', ui('기각', 'Reject')), later = h('button', 'rej', ui('나중에', 'Later'));
    for (const b of [re, rej, later]) b.type = 'button';
    re.onclick = () => open(id, true); rej.onclick = () => pick({ reject: true }); later.onclick = close; row.append(re, rej, later);
    pn.append(own, row, msg);
    if (!S.running) msg.textContent = ui('이름을 바꾸려면 게임이 켜져 있어야 합니다.', 'The game must be running to rename the fleet.');
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.fleetNameState) return;
    const watch = () => { const pl = $('plist'); if (!pl) return setTimeout(watch, 200); new MutationObserver(() => { if (!pl.querySelector('.prop.fn') && !pl.hidden) decorate(); }).observe(pl, { childList: true, attributes: true, attributeFilter: ['hidden'] }); void load(); };
    watch();
  });
})();
