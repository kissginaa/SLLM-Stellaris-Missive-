// 사로잡은 적 제독(2026-11-04 사용자) — 함대 사령부 창(fleet.html) 왼쪽 「사로잡은 적 제독」 칸 + 심문실(오른쪽 칸 위에 겹쳐 띄움).
// 앱: src/features/captive-app.ts · 규칙: src/captive.ts. 본문(fleet.html)은 다시 그려도(#side 비움) 이 칸을 다시 붙인다(MutationObserver).
// 문구는 L(한, 영)만 — 언어 팩 호환.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  if (!window.sllm || !window.sllm.captiveState) return;
  const css = () => { if (document.getElementById('capCss')) return; const st = h('style'); st.id = 'capCss'; st.textContent =
    '#capSec{display:flex;flex-direction:column;gap:6px}#capSec .adm b{color:var(--bad,#e88)}#capSec .meter{height:5px;border-radius:3px;background:color-mix(in srgb,var(--bg,#06141b) 70%,transparent);border:1px solid var(--line2);margin-top:6px;overflow:hidden}#capSec .meter i{display:block;height:100%;background:var(--gold,#e8c872)}'
    + '#capRoom{grid-column:2;grid-row:1;z-index:5;display:flex;flex-direction:column;min-height:0;border:1px solid var(--gold,#e8c872);border-radius:8px;overflow:hidden;background:#04090ccc url(\'assets/rooms/admiral-inquiry-v1.png\') center 55%/cover no-repeat}'
    + '#capRoom .hd{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#060c11e6;border-bottom:1px solid var(--line2)}#capRoom .hd b{color:var(--gold);font-size:15px}#capRoom .hd small{color:var(--dim)}#capRoom .hd .sp{flex:1}'
    + '#capRoom .co{min-width:150px;font-size:11.5px;color:var(--dim)}#capRoom .co .meter{height:6px;border-radius:3px;border:1px solid var(--line);margin-top:3px;overflow:hidden}#capRoom .co .meter i{display:block;height:100%;background:var(--gold)}#capRoom .co .meter i.hi{background:var(--good)}'
    + '#capRoom .talk{flex:1;min-height:0;overflow-y:auto;padding:14px 16px;background:linear-gradient(#060c11cc,#060c11ee)}#capRoom .ln.captive b{color:var(--bad,#e88)}'
    + '#capRoom .acts{display:flex;flex-wrap:wrap;gap:6px;padding:8px 14px;background:#060c11ee;border-top:1px solid var(--line2)}#capRoom .acts .btn{padding:5px 11px;font-size:12px}#capRoom .acts .btn.red{border-color:var(--bad);color:var(--bad);background:none}'
    + '#capRoom .inp{display:flex;gap:10px;align-items:flex-end;padding:10px 14px;background:#060c11f2;border-top:1px solid var(--line2)}#capRoom textarea{flex:1;height:54px;resize:none;background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:8px 10px;color:var(--text)}'
    + '#capRoom .msg{color:var(--bad);font-size:12px;padding:0 14px 6px;min-height:1em;background:#060c11f2}#capRoom .msg.ok{color:var(--good)}';
    document.head.append(st); };
  let S = null, open = 0, msg = '', msgOk = false, draft = '', confirmExec = false;
  const say = (t, ok) => { msg = t || ''; msgOk = !!ok; };

  function side() {
    const sd = document.getElementById('side'); if (!sd || !S || !S.sid) return;
    const old = document.getElementById('capSec'); if (old) old.remove();
    if (!S.captives || !S.captives.length) return;
    css();
    const sec = h('div'); sec.id = 'capSec'; sec.setAttribute('data-i18n-skip', '');
    sec.append(h('p', 'sec', L('사로잡은 적 제독', 'CAPTURED ENEMY ADMIRALS')));
    for (const c of S.captives) {
      const b = h('button', 'adm' + (open === c.slot ? ' on' : '')); b.type = 'button';
      b.append(h('b', '', c.name), h('small', '', L(`${c.fname} · ${c.date} 사로잡음 · 협조도 ${c.coop}`, `${c.fname} · captured ${c.date} · willingness ${c.coop}`)));
      const m = h('div', 'meter'), i = h('i'); i.style.width = c.coop + '%'; m.append(i); b.append(m);
      b.onclick = () => { open = open === c.slot ? 0 : c.slot; say(''); confirmExec = false; if (open) window.dispatchEvent(new CustomEvent('sllm-fleet-overlay', { detail: 'captive' })); side(); room(); };
      sec.append(b);
    }
    // 자동 작전 버튼 바로 아래(없으면 맨 위)
    const first = sd.firstElementChild; if (first && first.nextSibling) sd.insertBefore(sec, first.nextSibling); else sd.prepend(sec);
  }

  const whoOf = (l, c) => l.who === 'captive' ? L(`포로 · ${c.name} 제독`, `Captive · Admiral ${c.name}`) : l.who === 'ruler' ? L('지도자', 'Leader') : L('기록', 'Record');
  function room() {
    const main = document.getElementById('main'); if (!main) return;
    let r = document.getElementById('capRoom');
    const c = S && S.captives && S.captives.find((x) => x.slot === open);
    if (!c) { open = 0; if (r) r.remove(); return; }
    css();
    if (!r) { r = h('div'); r.id = 'capRoom'; r.setAttribute('data-i18n-skip', ''); main.append(r); }
    const keepScroll = r.querySelector('.talk'); const atBottom = !keepScroll || keepScroll.scrollTop + keepScroll.clientHeight >= keepScroll.scrollHeight - 30;
    const ta0 = r.querySelector('textarea'); if (ta0) draft = ta0.value;
    r.textContent = '';
    // 머리
    const hd = h('div', 'hd'), t = h('div'); t.style.display = 'flex'; t.style.flexDirection = 'column'; t.style.lineHeight = '1.3';
    t.append(h('b', '', L(`심문실 — ${c.name} 제독`, `Interrogation — Admiral ${c.name}`)), h('small', '', L(`${c.fname} 함대 사령관 · ${c.date} 사로잡음 · 질문 ${c.turns}/${S.maxTurns}`, `Fleet commander of ${c.fname} · captured ${c.date} · questions ${c.turns}/${S.maxTurns}`)));
    const co = h('div', 'co'); co.append(h('span', '', L(`협조도 ${c.coop}/100 (회유 ${S.recruitAt}+)`, `Willingness ${c.coop}/100 (defect at ${S.recruitAt}+)`)));
    const m = h('div', 'meter'), mi = h('i', c.canRecruit ? 'hi' : ''); mi.style.width = c.coop + '%'; m.append(mi); co.append(m);
    const x = h('button', 'btn sub', L('닫기', 'Close')); x.type = 'button'; x.onclick = () => { open = 0; say(''); side(); room(); };
    hd.append(t, h('span', 'sp'), co, x); r.append(hd);
    // 대화
    const talk = h('div', 'talk');
    if (!c.talk.length) talk.append(h('div', 'ln desk', L('포로가 심문실로 끌려왔습니다. 먼저 말을 걸어 보세요.', 'The captive has been brought in. Speak first.')));
    for (const l of c.talk) {
      const ln = h('div', 'ln ' + (l.who === 'ruler' ? 'player' : l.who === 'captive' ? 'admiral captive' : 'desk'));
      if (l.who !== 'note') ln.append(h('b', '', whoOf(l, c)));
      ln.append(h('div', '', l.text)); talk.append(ln);
    }
    if (S.busy) talk.append(h('div', 'ln desk', L('…', '…')));
    r.append(talk);
    // 처리
    const acts = h('div', 'acts'), dis = !S.running || S.busy;
    const mk = (label, act, cls, off, title) => { const b = h('button', 'btn' + (cls ? ' ' + cls : ''), label); b.type = 'button'; b.disabled = dis || !!off; if (title) b.title = title; b.onclick = () => doAct(c, act); acts.append(b); return b; };
    mk(L('몸값 받고 돌려보내기 (에너지 300·영향력 25)', 'Ransom (300 energy · 25 influence)'), 'ransom');
    mk(c.questioned ? L('심문 완료', 'Interrogated') : L(`심문해 첩보 얻기 (첩보 수준 +${c.intel})`, `Extract intel (intel +${c.intel})`), 'interrogate', '', c.questioned);
    mk(L(`회유해 우리 지휘관으로 (협조도 ${S.recruitAt} 이상)`, `Recruit (willingness ${S.recruitAt}+)`), 'recruit', '', !c.canRecruit, c.canRecruit ? '' : L('협조도가 모자랍니다', 'Not willing enough yet'));
    mk(L('조건 없이 석방', 'Release'), 'release', 'sub');
    mk(confirmExec === 'execute' ? L('정말 처형합니까? 한 번 더 누르세요', 'Really execute? Click again') : L('처형 (악명 +5)', 'Execute (infamy +5)'), 'execute', 'red');
    mk(confirmExec === 'secret' ? L('정말 비밀리에 처형합니까? 한 번 더 누르세요', 'Really execute in secret? Click again') : L('비밀 처형 (숨은 악명 +8 · 상대는 모름)', 'Secret execution (hidden infamy +8 · they never know)'), 'secret', 'red');
    if (!S.running) acts.append(h('small', '', L('처리는 게임이 켜져 있을 때만 됩니다.', 'Actions need the game running.')));
    r.append(acts);
    const ms = h('div', 'msg' + (msgOk ? ' ok' : ''), msg); r.append(ms);
    // 입력
    const inp = h('div', 'inp'), ta = h('textarea'); ta.maxLength = 600; ta.placeholder = c.turns >= S.maxTurns ? L('더는 입을 열지 않습니다. 처리 방법을 고르세요.', 'They will say no more. Choose what to do.') : L('포로에게 할 말 — 위협·회유·질문 모두 협조도를 움직입니다.', 'Speak to the captive — threats, offers and questions all move their willingness.');
    ta.value = draft; ta.disabled = S.busy || c.turns >= S.maxTurns;
    const send = h('button', 'btn', L('말하기', 'Say')); send.type = 'button'; send.disabled = ta.disabled;
    const go = async () => { const text = ta.value.trim(); if (!text || S.busy) return; draft = ''; ta.value = ''; say(''); let res; try { res = await window.sllm.captiveSay(c.slot, text); } catch (e) { res = { ok: false, error: String(e && e.message || e) }; } if (!res.ok) { draft = text; say(res.error); } if (res.state) S = res.state; side(); room(); };
    send.onclick = go; ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); void go(); } };
    inp.append(ta, send); r.append(inp);
    if (atBottom) talk.scrollTop = talk.scrollHeight; else talk.scrollTop = keepScroll.scrollTop;
  }

  async function doAct(c, act) {
    if ((act === 'execute' || act === 'secret') && confirmExec !== act) { confirmExec = act; room(); return; }
    confirmExec = false; say(L('처리 중…', 'Working…'), true); room();
    let res; try { res = await window.sllm.captiveAct(c.slot, act); } catch (e) { res = { ok: false, error: String(e && e.message || e) }; }
    if (res.state) S = res.state;
    if (res.ok) say(res.text || L('반영했습니다.', 'Done.'), true); else say(res.error || L('실패했습니다.', 'Failed.'));
    if (!S.captives.find((x) => x.slot === open)) { open = 0; if (res.ok && res.text) setTimeout(() => alertBox(res.text), 0); }
    side(); room();
  }
  // 포로가 사라진 뒤 결과 한 줄(심문실이 닫히므로 옆 칸에 잠깐)
  function alertBox(text) { const sd = document.getElementById('side'); if (!sd) return; const p = h('div', '', text); p.style.cssText = 'border:1px solid var(--gold);border-radius:6px;padding:8px 10px;font-size:12px;color:var(--gold)'; p.setAttribute('data-i18n-skip', ''); sd.prepend(p); setTimeout(() => p.remove(), 9000); }

  function boot() {
    const sd = document.getElementById('side'); if (!sd) return;
    window.addEventListener('sllm-fleet-overlay', (e) => { if (e.detail !== 'captive' && open) { open = 0; side(); room(); } }); // 악명 칸(fleet-infamy.js)이 열리면 닫기
    new MutationObserver(() => { if (S && S.captives && S.captives.length && !document.getElementById('capSec')) side(); }).observe(sd, { childList: true });
    window.sllm.onCaptiveUpdate && window.sllm.onCaptiveUpdate((v) => { S = v; side(); room(); });
    window.sllm.captiveState().then((v) => { S = v; side(); room(); }).catch(() => {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
