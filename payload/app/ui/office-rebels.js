// 반란과 공작(2026-11-05 사용자: Potent Rebellions 참고 ②③④) — 집무실 「첩보 보고」 화면 옆 칸 + 「반란과 공작」 창.
// 앱: src/features/rebels-app.ts(rbState·rbAidAnswer·rbAidStop·rbSow). 문구는 L(한, 영)만 — 언어 팩 호환.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const pct = (p) => Math.round(Number(p || 0) * 100) + '%';
  const css = () => { if (document.getElementById('rbCss')) return; const st = h('style'); st.id = 'rbCss'; st.textContent =
    '#rbBox{margin:0 0 8px;padding:8px 10px;border:1px solid #b8975a88;background:#b8975a12;font-size:12.5px;line-height:1.45}#rbBox b{display:block;font-weight:600;margin-bottom:3px}'
    + '#rbBox small{display:block;opacity:.8}#rbBox .warn{color:#e0a060}#rbBox .bad{color:#ff8a7a}#rbBox button{margin-top:6px;font-size:12px;padding:3px 8px;cursor:pointer}'
    + '#rbWin{position:fixed;inset:0;z-index:9000;background:#000a;display:flex;align-items:center;justify-content:center}'
    + '#rbWin .rb-box{width:min(720px,94vw);max-height:88vh;overflow:auto;display:flex;flex-direction:column;gap:10px;padding:16px 18px;background:#14161c;color:#e8e4d8;border:1px solid #b8975a;font-size:13px;line-height:1.5}'
    + '#rbWin h3{margin:0;font-size:16px;color:#e0c48a}#rbWin h4{margin:4px 0 2px;font-size:13.5px;color:#e0c48a;border-bottom:1px solid #b8975a44;padding-bottom:2px}'
    + '#rbWin .rb-card{padding:8px 10px;border:1px solid #8885;background:#ffffff08}#rbWin .rb-card.hot{border-color:#e0a060}#rbWin .rb-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px}'
    + '#rbWin button{padding:4px 10px;cursor:pointer;font-size:12.5px}#rbWin button:disabled{opacity:.5;cursor:default}#rbWin small{opacity:.75}#rbWin .rb-none{opacity:.6}'
    + '#rbWin ul{margin:2px 0;padding-left:18px}#rbWin .rb-msg{min-height:1em;color:#e0c48a}#rbWin .bad{color:#ff8a7a}#rbWin .good{color:#7fd88f}#rbWin .rb-top{display:flex;justify-content:space-between;align-items:center}';
    document.head.append(st); };
  let busy = false, S = null;
  const STATE = { on: ['진행 중', 'running'], done: ['끝남', 'finished'], lapsed: ['끊김(창고 부족)', 'lapsed (short)'], stopped: ['멈춤', 'stopped'], gone: ['반란국 사라짐', 'rebel state gone'] };

  async function act(fn, msg, btns) {
    btns.forEach((b) => { b.disabled = true; }); msg.textContent = L('처리 중…', 'Working…'); let r;
    try { r = await fn(); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    if (r && r.ok) { S = r.view || S; win(r.text || ''); refresh(); } else { msg.textContent = (r && r.error) || L('실패했습니다.', 'Failed.'); msg.classList.add('bad'); btns.forEach((b) => { b.disabled = false; }); }
  }
  function win(note) {
    document.getElementById('rbWin')?.remove(); if (!S || !S.ok) return;
    const ov = h('div'); ov.id = 'rbWin'; ov.setAttribute('data-i18n-skip', ''); const box = h('div', 'rb-box'); ov.append(box); ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    const top = h('div', 'rb-top'); const close = h('button', '', L('닫기', 'Close')); close.onclick = () => ov.remove(); top.append(h('h3', '', L('반란과 공작', 'Rebels & Covert Ops')), close); box.append(top);
    const msg = h('div', 'rb-msg', note || ''); box.append(msg);
    if (!S.running) box.append(h('small', '', L('게임이 켜져 있어야 답하거나 공작할 수 있습니다.', 'The game must be running to answer or act.')));

    // ② 지원 요청
    box.append(h('h4', '', L('반란국의 지원 요청', 'Requests from rebel states')));
    if (!S.asks.length) box.append(h('div', 'rb-none', L('지금은 없습니다. 우리와 가까운(국경이 닿거나 한 칸 거리) 나라 중 사이가 나쁜 나라에서 반란이 성공하면, 새 반란국이 서신으로 지원을 청해 옵니다. 우리 반란군을 돕거나 우리 행성에 불안을 심는 AI 도 가까운 나라뿐입니다.', 'None now. When a revolt succeeds in a nearby empire (bordering us, or one jump away) that we dislike, the new rebel state writes to ask for support. Only nearby AIs back our rebels or plant unrest on our worlds.')));
    for (const a of S.asks) {
      const c = h('div', 'rb-card hot'); c.append(h('b', '', L(`${a.country} — ${a.from}에 맞서 독립한 반란국`, `${a.country} — broke away from ${a.from}`)), h('div', '', a.sown ? L('우리가 심은 불씨로 반란이 일어난 것을 알고 고마워합니다.', 'They know the unrest we sowed made their revolution possible, and are grateful.') : L('매달 에너지·광물 지원을 청합니다.', 'They ask for monthly energy and minerals.')), h('small', '', L(`${a.due}까지 답하지 않으면 없던 일이 됩니다. 지원은 ${S.aidMonths / 12}년 동안이며, 해마다 ${a.from}에 들킬 수 있습니다(관계 크게 하락).`, `Lapses if unanswered by ${a.due}. Support runs ${S.aidMonths / 12} years; each year ${a.from} may find out (big opinion hit).`)));
      const row = h('div', 'rb-row'), bs = [];
      [[1, '조금', 'Token'], [2, '넉넉히', 'Generous'], [3, '크게', 'Lavish']].forEach(([t, ko, en]) => { const b = h('button', '', L(`${ko}: 매달 ${S.tiers[t - 1]}씩 (발각 ${pct(S.detect[t - 1])}/년)`, `${en}: ${S.tiers[t - 1]}/month (${pct(S.detect[t - 1])}/yr exposure)`)); b.disabled = !S.running; bs.push(b); row.append(b); b.onclick = () => act(() => window.sllm.rbAidAnswer({ country: a.country, tier: t }), msg, bs); });
      const no = h('button', '', L('거절', 'Decline')); no.disabled = !S.running; bs.push(no); no.onclick = () => act(() => window.sllm.rbAidAnswer({ country: a.country, tier: 0 }), msg, bs); row.append(no);
      c.append(row); box.append(c);
    }
    // 진행 중·지난 지원
    if (S.aids.length) {
      box.append(h('h4', '', L('우리의 반란군 지원', 'Our support for rebels')));
      for (const a of S.aids) {
        const c = h('div', 'rb-card'); c.append(h('b', '', `${a.country} · ${L(...a.name)} ${a.amt}/${L('달', 'mo')} · ${L(...(STATE[a.state] || STATE.done))}`), h('small', '', L(`${a.since} ~ ${a.until} · 보낸 양 ${a.paid}씩${a.caught ? ` · ${a.from}에 들킴` : ''}`, `${a.since} – ${a.until} · sent ${a.paid} each${a.caught ? ` · exposed to ${a.from}` : ''}`)));
        if (a.state === 'on') { const b = h('button', '', L('지원 멈추기', 'Stop support')); b.onclick = () => act(() => window.sllm.rbAidStop({ country: a.country }), msg, [b]); const row = h('div', 'rb-row'); row.append(b); c.append(row); }
        box.append(c);
      }
    }
    if (S.ours.length) { box.append(h('h4', '', L('우리 반란군의 뒷배', 'Who backs our rebels'))); const ul = h('ul'); for (const o of S.ours) ul.append(h('li', 'bad', L(`${o.at} · ${o.foe}이(가) ${o.country}을(를) 돕고 있음`, `${o.at} · ${o.foe} is backing ${o.country}`))); box.append(ul); }

    // ③ 취약 국가
    box.append(h('h4', '', L('국방: 흔들리는 나라', 'Defence: a shaken nation')));
    { const v = S.vuln, c = h('div', 'rb-card' + (v.on ? ' hot' : '')); c.append(h('b', v.on ? 'bad' : 'good', v.on ? L('백성이 흔들리고 있습니다', 'Our people are uneasy') : L('괜찮습니다', 'Steady')), h('div', '', v.text)); if (v.last) c.append(h('small', '', L(`마지막 판정 ${v.last}${v.use !== undefined ? ` · 함대 한도 ${v.use}% 사용` : ''} · 3달마다 다시 봅니다.`, `Last check ${v.last}${v.use !== undefined ? ` · ${v.use}% naval capacity used` : ''} · checked every 3 months.`))); box.append(c); }

    // ④ 선동
    box.append(h('h4', '', L('선동 공작', 'Sow unrest')));
    box.append(h('small', '', L(`첩보망이 있는 나라의 행성(수도 제외) 하나에 3년간 불안을 심습니다(안정도 −10, 범죄 +10). 영향력 ${S.sowInf}. 첩보망이 셀수록 들킬 확률이 낮습니다. 들키면 그 나라와의 관계 −80. 그 나라에서 5년 안에 반란이 나면, 반란국은 우리 덕인 줄 압니다.`, `Plant unrest on one non-capital world of an empire where we have a spy network, for 3 years (stability −10, crime +10). Costs ${S.sowInf} influence. A stronger network means less chance of exposure. If exposed, their opinion of us −80. If they suffer a revolt within 5 years, the rebels will know they owe us.`)));
    if (!S.targets.length) box.append(h('div', 'rb-none', L('첩보망이 있는 나라가 없습니다.', 'We have no spy networks.')));
    for (const t of S.targets) {
      const c = h('div', 'rb-card'); c.append(h('b', '', `${t.target}${t.agent ? ' · ' + L('공작원 ', 'agent ') + t.agent : ''}`), h('small', '', L(`첩보망 ${t.power} · 들킬 확률 ${pct(t.odds)}`, `Network ${t.power} · exposure ${pct(t.odds)}`)));
      const b = h('button', '', L(`불안 심기 (영향력 ${S.sowInf})`, `Sow unrest (${S.sowInf} influence)`)); b.disabled = !S.running || !!t.block; if (t.block) b.title = t.block;
      b.onclick = () => act(() => window.sllm.rbSow({ target: t.target }), msg, [b]); const row = h('div', 'rb-row'); row.append(b); if (t.block) row.append(h('small', '', t.block)); c.append(row); box.append(c);
    }
    if (S.sows.length) { const ul = h('ul'); for (const w of S.sows) ul.append(h('li', w.caught ? 'bad' : '', L(`${w.at} · ${w.target}의 ${w.planet}${w.active ? ` (${w.until}까지)` : ''}${w.caught ? ' · 들킴' : ''}`, `${w.at} · ${w.planet} (${w.target})${w.active ? ` until ${w.until}` : ''}${w.caught ? ' · exposed' : ''}`))); box.append(ul); }
    if (S.aiSows.length) { box.append(h('h4', '', L('우리 행성에 심어진 불안', 'Unrest planted on our worlds'))); const ul = h('ul'); for (const w of S.aiSows) ul.append(h('li', 'bad', L(`${w.at} · ${w.planet} — ${w.spotted ? w.foe + '의 소행' : '배후 모름'} (${w.until}까지)`, `${w.at} · ${w.planet} — ${w.spotted ? 'by ' + w.foe : 'culprit unknown'} (until ${w.until})`))); box.append(ul); }
    document.body.append(ov);
  }
  function refresh() { document.getElementById('rbBox')?.remove(); void add(); }
  async function add() {
    const root = document.getElementById('embRoot'), tt = document.getElementById('embTitle');
    if (busy || !root || !tt || tt.textContent !== L('첩보 보고', 'Espionage Reports')) return;
    const side = root.querySelector('.emb-side'); if (!side || document.getElementById('rbBox')) return;
    busy = true; try { S = await window.sllm.rbState(); } catch (e) { S = null; } busy = false;
    if (!S || !S.ok || document.getElementById('rbBox') || !side.isConnected) return;
    css();
    const box = h('div'); box.id = 'rbBox'; box.setAttribute('data-i18n-skip', '');
    box.append(h('b', '', L('반란과 공작', 'Rebels & Covert Ops')));
    if (S.asks.length) box.append(h('small', 'warn', L(`지원 요청 ${S.asks.length}건 — 답하기`, `${S.asks.length} request(s) for support — answer`)));
    const on = S.aids.filter((a) => a.state === 'on').length; if (on) box.append(h('small', '', L(`반란군 지원 ${on}곳 진행 중`, `Supporting ${on} rebel state(s)`)));
    if (S.vuln.on) box.append(h('small', 'bad', L('국방 경고: 흔들리는 나라', 'Defence warning: a shaken nation')));
    const sows = S.sows.filter((w) => w.active).length; if (sows) box.append(h('small', '', L(`선동 공작 ${sows}건 진행 중`, `${sows} unrest operation(s) running`)));
    if (!S.asks.length && !on && !S.vuln.on && !sows) box.append(h('small', '', L('반란국 지원 · 국방 취약 · 선동 공작', 'Rebel support · defence weakness · sowing unrest')));
    const b = h('button', '', L('열기', 'Open')); b.type = 'button'; b.onclick = () => win(''); box.append(b);
    const cy = document.getElementById('cyBox'); if (cy) cy.after(box); else side.prepend(box);
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.rbState) return;
    const watch = () => { const root = document.getElementById('embRoot'); if (!root) return setTimeout(watch, 300); new MutationObserver(() => { void add(); }).observe(root, { childList: true }); void add(); };
    watch();
  });
})();
