// 집무실 「긴급회의」 아이콘(2026-10-23 초안). 누르면 회의실(ui/emergency-room.html)이 집무실 자리에 열린다. 앱: src/features/emergency-app.ts.
// 수동 소집만(02 최신 확정): 알람·자동 제안 없음. office.html 은 이 파일만 더한다. 문구는 L(한, 영)만(언어 팩 호환).
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  function build() {
    const after = $('prtCall') || $('petCall') || document.querySelector('[data-app="policy"]');
    if (!after || $('emCall')) return;
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'emCall';
    b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 34h28l-3-14a11 11 0 0 0-22 0z"/><path d="M8 38h32"/><path d="M24 6v4M10 12l3 3M38 12l-3 3"/></svg>';
    b.append(h('span', '', L('긴급회의', 'Emergency council')));
    b.title = L('평의회를 직접 소집해 위기를 논의합니다', 'Convene the council yourself to discuss a crisis');
    b.onclick = async () => { try { const r = await window.sllm.emOpen(); if (r && !r.ok && r.error) { const t = h('div', 'cab-msg', r.error); document.body.append(t); setTimeout(() => t.remove(), 4000); } } catch (e) { /* 무시 */ } };
    after.after(b);
    // 비상대권(2026-11-05): 긴급회의 옆 아이콘 → 작은 창. 앱: src/features/emp-app.ts
    const e = h('button', 'ic'); e.type = 'button'; e.id = 'empCall';
    e.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M24 5l15 6v11c0 10-6.5 17-15 21-8.5-4-15-11-15-21V11z"/><path d="M24 16v10M24 31v1"/></svg>';
    e.append(h('span', '', L('비상대권', 'Emergency powers')));
    e.title = L('전시 비상대권을 선포하거나 거둡니다', 'Declare or withdraw wartime emergency powers');
    e.onclick = () => openEmp(); b.after(e);
  }
  // ---- 비상대권 창
  const EMP_COL = ['#8fe3a8', '#ffd36b', '#ffa45c', '#ff6a5a'];
  function empCss() { if ($('empCss')) return; const st = h('style'); st.id = 'empCss'; st.textContent = [
    '#empWrap{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45)}',
    '#empBox{width:min(560px,92vw);max-height:86vh;overflow-y:auto;background:var(--bg,#0d1520);color:var(--text);border:1px solid var(--hi);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:10px;box-shadow:0 10px 40px rgba(0,0,0,.5)}',
    '#empBox h3{margin:0;font-size:15px;display:flex;justify-content:space-between;align-items:center}',
    '#empBox .em-x{border:0;background:transparent;color:var(--text);font-size:18px;cursor:pointer}',
    '#empBox .em-note{font-size:12px;opacity:.75;line-height:1.6}',
    '#empBox .em-lv{display:flex;gap:4px}',
    '#empBox .em-lv div{flex:1;padding:6px 4px;border-radius:5px;text-align:center;font-size:12px;border:1px solid color-mix(in srgb,var(--hi) 30%,transparent);opacity:.5}',
    '#empBox .em-lv div.on{opacity:1;font-weight:700}',
    '#empBox .em-fx{font-size:12.5px;padding:6px 10px;border-radius:6px;background:color-mix(in srgb,var(--hi) 10%,transparent);line-height:1.6}',
    '#empBox .em-say{padding:8px 12px;border-left:3px solid var(--hi);font-size:13.5px;line-height:1.6}',
    '#empBox .em-btns{display:flex;flex-wrap:wrap;gap:6px}',
    '#empBox button.em-b{border:1px solid var(--hi);background:color-mix(in srgb,var(--hi) 12%,transparent);color:var(--text);border-radius:5px;padding:5px 12px;cursor:pointer;font-size:12.5px}',
    '#empBox button.em-b:disabled{opacity:.45;cursor:default}',
    '#empBox .em-err{font-size:12.5px;color:#ffd2cb}',
  ].join(''); document.head.append(st); }
  async function openEmp() {
    empCss(); let w = $('empWrap'); if (w) w.remove();
    w = h('div'); w.id = 'empWrap'; const box = h('div'); box.id = 'empBox'; w.append(box); document.body.append(w);
    w.onclick = (ev) => { if (ev.target === w) w.remove(); };
    const head = h('h3', '', L('비상대권', 'Emergency powers')); const x = h('button', 'em-x', '×'); x.type = 'button'; x.onclick = () => w.remove(); head.append(x); box.append(head);
    const body = h('div'); box.append(body); body.append(h('div', 'em-note', L('게임에 묻는 중…', 'Asking the game…')));
    let S; try { S = await window.sllm.empState(); } catch (err) { S = { ok: false, error: String(err && err.message || err) }; }
    draw(body, S);
  }
  function draw(body, S, err) {
    body.textContent = '';
    if (!S || !S.state) { body.append(h('div', 'em-err', (S && S.error) || L('상태를 읽지 못했습니다.', 'Could not read the state.'))); return; }
    const st = S.state, R = S.rules;
    body.append(h('div', 'em-note', L(`전쟁 중에만 한 단계씩 올릴 수 있고(올린 뒤 ${R.cooldownDays}일은 다시 못 올림), 내리기는 언제든 됩니다. 전쟁 없이 ${R.peaceAsk}개월이 지나면 내려놓을지 쥘지 정해야 하며, ${R.peaceLock}개월이 되도록 정하지 않으면 쥔 것으로 굳습니다. 쥐고 있으면 ${R.grip}, 해마다 평의회가 반발합니다. 전쟁 뒤 스스로 내려놓으면 ${R.ret}.`,
      `Raise one step at a time, only in wartime (then wait ${R.cooldownDays} days); lower any time. After ${R.peaceAsk} months without war you must choose to lay them down or hold on; undecided by month ${R.peaceLock}, they set in place. Holding on: ${R.grip}, and the council pushes back every year. Laying them down after a war: ${R.ret}.`)));
    const lv = h('div', 'em-lv'); for (const x of S.levels) { const d = h('div', x.lv === st.lv ? 'on' : '', x.name); if (x.lv === st.lv) { d.style.borderColor = EMP_COL[x.lv]; d.style.color = EMP_COL[x.lv]; } lv.append(d); } body.append(lv);
    const cur = S.levels[st.lv]; body.append(h('div', 'em-fx', L(`지금: ${cur.name} — ${cur.fx}`, `Now: ${cur.name} — ${cur.fx}`) + (st.st === 'hold' ? L(` · 쥐고 있음: ${R.grip}`, ` · Holding on: ${R.grip}`) : '') + ' · ' + (st.war ? L('전쟁 중', 'At war') : L('평시', 'At peace'))));
    if (S.say) body.append(h('div', 'em-say', S.say));
    if (st.st === 'ask' && st.lv > 0) body.append(h('div', 'em-note', L('전쟁이 끝났습니다. 내려놓으시겠습니까, 쥐고 계시겠습니까?', 'The war is over. Lay them down, or hold on?')));
    const btns = h('div', 'em-btns'), msg = h('div', 'em-err', err || ''); body.append(btns, msg);
    const act = async (a) => { for (const b of btns.querySelectorAll('button')) b.disabled = true;
      let r; try { r = await window.sllm.empSet(a); } catch (e2) { r = { ok: false, error: String(e2 && e2.message || e2) }; }
      if (r && r.state) draw(body, r, r.ok ? '' : r.error); else { msg.textContent = (r && r.error) || L('실패했습니다.', 'Failed.'); for (const b of btns.querySelectorAll('button')) b.disabled = false; } };
    const add = (label, a, on) => { const b = h('button', 'em-b', label); b.type = 'button'; b.disabled = !on; b.onclick = () => act(a); btns.append(b); };
    add(L('한 단계 올리기', 'Raise one step'), 'up', st.lv < 3 && st.war && !st.cd);
    add(L('한 단계 내리기', 'Lower one step'), 'down', st.lv > 0);
    add(L('모두 거두기', 'Withdraw all'), 'release', st.lv > 0);
    if (st.lv > 0 && !st.war) add(L('조금 더 쥐고 있기', 'Hold on a little longer'), 'hold', st.st !== 'hold');
    if (st.cd && st.lv < 3 && st.war) msg.textContent = msg.textContent || L('최근에 올려서 잠시 더 올릴 수 없습니다.', 'Raised recently — you cannot raise again yet.');
  }
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(build, 30); // 시민 청원·시위 아이콘이 먼저 생긴 뒤 그 옆에
    document.addEventListener('sllm-language', () => { const e = $('empCall'); if (e) { e.querySelector('span').textContent = L('비상대권', 'Emergency powers'); e.title = L('전시 비상대권을 선포하거나 거둡니다', 'Declare or withdraw wartime emergency powers'); } const b = $('emCall'); if (b) { b.querySelector('span').textContent = L('긴급회의', 'Emergency council'); b.title = L('평의회를 직접 소집해 위기를 논의합니다', 'Convene the council yourself to discuss a crisis'); } });
  });
})();
