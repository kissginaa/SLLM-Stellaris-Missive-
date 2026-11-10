// 예술가 극단 「순회 공연 의뢰」(알파 11, 2026-10-25). 통신 단말기의 예술가 극단 줄에서 연다. 앱: src/features/collectibles-app.ts(tourState·tourRequest).
// 에너지 250 → 900일 동안 행복도 +4% · 인구 증가 +2.5%(세계의 축제를 75% 깎은 판). 고정 문구는 P(한, 영)(언어 팩 호환).
(() => {
  const P = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const css = '.at-ov{position:fixed;inset:0;z-index:8800;background:rgba(5,7,10,.8);display:flex;justify-content:center;align-items:flex-start;overflow:auto;padding:40px 12px}'
    + '.at-box{width:min(620px,100%);background:linear-gradient(160deg,#2a1838,#1a1124 60%,#2b1a12);color:#f3e7f5;border:1px solid #8a5fb0;border-radius:6px;box-shadow:0 20px 60px rgba(0,0,0,.6)}'
    + '.at-head{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid rgba(200,160,230,.3)}.at-head h3{margin:0;font-size:18px}.at-head small{display:block;color:#cdb6dc;font-size:12px;font-weight:400;margin-top:3px;font-style:italic}.at-head button{margin-left:auto}'
    + '.at-box button{background:#3a2550;color:#f3e7f5;border:1px solid #9a72c0;border-radius:4px;padding:6px 14px;cursor:pointer;font:inherit}.at-box button:disabled{opacity:.5;cursor:default}.at-box button.armed{background:#8a3a6a;border-color:#e08ac0}'
    + '.at-body{padding:14px 20px 18px;font-size:14px;line-height:1.7}.at-body dl{display:grid;grid-template-columns:110px 1fr;gap:4px 10px;margin:10px 0}.at-body dt{color:#cdb6dc}.at-msg{color:#f0d080;min-height:20px;margin:8px 0}.at-hist{font-size:12.5px;color:#cdb6dc;margin-top:10px}.at-hist button{padding:0 8px;font-size:11.5px;margin-left:6px}';
  let styled = false;
  async function open() {
    if (!styled) { const s = h('style'); s.textContent = css; document.head.append(s); styled = true; }
    document.querySelectorAll('.at-ov').forEach((x) => x.remove());
    const ov = h('div', 'at-ov'), box = h('div', 'at-box'), head = h('div', 'at-head'), t = h('h3', '', P('순회 공연 의뢰 — 예술가 극단', 'Commission a tour — The Artisan Troupe')), close = h('button', '', P('닫기', 'Close'));
    t.append(h('small', '', P('「창의적인 하루 되시길! 축제만큼 화려하진 않아도, 마음은 같답니다.」', '“Have a creative day! Less grand than the Festival, but with the same heart.”'))); close.type = 'button'; head.append(t, close);
    const body = h('div', 'at-body'); box.append(head, body); ov.append(box); document.body.append(ov);
    const shut = () => { ov.remove(); document.removeEventListener('keydown', key); }; const key = (e) => { if (e.key === 'Escape') shut(); };
    close.onclick = shut; ov.onclick = (e) => { if (e.target === ov) shut(); }; document.addEventListener('keydown', key);
    let S = null, armed = false, timer = 0, busy = false, msg = '';
    const draw = () => {
      body.replaceChildren();
      if (!S) { body.append(h('p', '', P('불러오는 중…', 'Loading…'))); return; }
      if (!S.ok) { body.append(h('p', 'at-msg', S.error)); return; }
      body.append(h('p', '', P('극단이 우리 제국의 여러 행성을 돌며 공연합니다. 세계의 축제를 작게 줄인 판으로, 사고나 소동은 없습니다.', 'The Troupe tours and performs across our worlds: a smaller Festival of Worlds, with no stampedes or scandals.')));
      const dl = h('dl');
      for (const [k, v] of [[P('공연료', 'Fee'), S.cost + ' EC'], [P('기간', 'Season'), P(`${S.days}일`, `${S.days} days`)], [P('효과', 'Effect'), P('제국 전역 행복도 +4% · 인구 증가 +2.5%', 'Empire-wide happiness +4% · population growth +2.5%')], [P('극단과의 관계', 'Relations'), S.score === null ? '—' : String(S.score)]]) { dl.append(h('dt', '', k), h('dd', '', v)); }
      body.append(dl);
      const why = !S.reachable ? P('지금은 극단과 통신이 닿지 않습니다.', 'The Troupe cannot be reached right now.') : S.active ? P(`순회 공연이 ${S.until}까지 진행 중입니다.`, `A tour is under way until ${S.until}.`) : S.festival ? P('세계의 축제가 진행 중입니다.', 'A Festival of Worlds is under way.') : S.refused ? P('극단이 우리를 탐탁지 않게 여깁니다(관계 −25 미만).', 'The Troupe is not fond of us (relations below −25).') : '';
      const b = h('button', armed ? 'armed' : '', armed ? P('정말 의뢰할까요? (250 EC)', 'Commission for real? (250 EC)') : P('🎭 순회 공연 의뢰', '🎭 Commission the tour')); b.type = 'button'; b.disabled = busy || !!why;
      b.onclick = async () => {
        if (!armed) { armed = true; clearTimeout(timer); timer = setTimeout(() => { armed = false; draw(); }, 3000); draw(); return; }
        clearTimeout(timer); armed = false; busy = true; msg = P('극단에 연락하는 중…', 'Contacting the Troupe…'); draw();
        try { const r = await window.sllm.tourRequest(); if (r.ok) { S = r.state; msg = P('계약이 체결되었습니다. 계약서가 국가 문서함에 들어갔습니다.', 'Contract signed. It is in the State archive.'); if (window.SLLMDocs && r.docId) window.SLLMDocs.openId(r.docId).catch(() => {}); } else msg = r.error; } catch (e) { msg = e.message; }
        busy = false; draw();
      };
      body.append(b, h('div', 'at-msg', msg || why));
      if (S.history && S.history.length) { const hi = h('div', 'at-hist'); hi.append(h('b', '', P('지난 공연', 'Past tours'))); for (const x of S.history) { const row = h('div', '', `${x.start} ~ ${x.until}`); if (x.docId && window.SLLMDocs) { const d = h('button', '', P('계약서', 'Contract')); d.type = 'button'; d.onclick = () => window.SLLMDocs.openId(x.docId).catch(() => {}); row.append(d); } hi.append(row); } body.append(hi); }
    };
    draw();
    try { S = await window.sllm.tourState(); } catch (e) { S = { ok: false, error: e.message }; }
    draw();
  }
  window.SLLMTour = { open };
})();
