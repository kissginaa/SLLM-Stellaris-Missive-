// 시나리오 전용 개발자 도구(2026-11-07 사용자: 「개발자 모드에 시나리오 전용 인터페이스를 따로 — 이 시나리오에서만 뜨게, 무작위 귀족 반란」)
// 설정 → 개발자 도구(#devTools) 맨 아래에 「회랑의 삼파전 (시나리오 전용)」 칸을 붙인다. 회랑 시나리오 세이브일 때만(scnNobles().on), 개발자 모드일 때만 단추가 눌린다.
// 본체: src/features/scenario-domains-app.ts 의 scnDev(본체도 개발자 모드·시나리오를 다시 확인한다). 문구는 L(한, 영) — 언어 팩 호환.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  let box = null;
  const devOn = () => !!($('devOn') && $('devOn').checked);
  function build() {
    const sec = h('div'); sec.id = 'scnDevBox'; sec.setAttribute('data-i18n-skip', '');
    sec.append(h('div', 'sec cap', L('회랑의 삼파전 (시나리오 전용)', 'The Corridor Triangle (scenario only)')));
    sec.append(h('p', 'hint', L('이 시나리오 세이브에서만 보입니다. 반란은 게임 상태를 실제로 바꿉니다(성계가 새 나라로 떨어져 나감) — 시험용 세이브에서 쓰세요.', 'Shown only in this scenario’s saves. A revolt really changes the game (systems break away as a new nation) — use a test save.')));
    const side = h('select'); side.id = 'scnDevSide';
    for (const [v, t] of [['', L('진영 무작위', 'Random side')], ['a', L('은하 얼라이언스', 'Galactic Alliance')], ['b', L('인류 제국', 'Human Empire')]]) { const o = h('option', '', t); o.value = v; side.append(o); }
    const coal = h('label'); const cb = h('input'); cb.type = 'checkbox'; cb.id = 'scnDevCoal'; coal.append(cb, document.createTextNode(' ' + L('이웃 귀족 둘까지 함께(연합 반란)', 'Bring up to two neighbours (coalition revolt)')));
    const st = h('p'); st.id = 'scnDevStatus'; st.setAttribute('role', 'status'); st.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere';
    const out = h('textarea'); out.readOnly = true; out.rows = 8; out.hidden = true; out.style.cssText = 'width:100%;box-sizing:border-box;font:12px monospace';
    // 점검판(2026-11-08): 상태 점검 결과를 ✓/✗ 표로
    const rep = h('div'); rep.id = 'scnDevReport'; rep.hidden = true; rep.style.cssText = 'margin:6px 0;display:grid;grid-template-columns:auto auto 1fr;gap:3px 10px;font-size:12px;align-items:baseline';
    const run = async (b, req, label) => {
      b.disabled = true; st.textContent = `${label}: ${L('진행 중…', 'working…')}`;
      try {
        const r = await window.sllm.scnDev(req);
        st.textContent = `${label}: ${r && r.ok ? (r.message || L('완료', 'done')) : ((r && r.error) || L('실패', 'failed'))}`;
        if (r && Array.isArray(r.lines) && r.lines.length) { out.value = r.lines.join('\n'); out.hidden = false; } else out.hidden = true;
        if (r && Array.isArray(r.report)) {
          rep.textContent = ''; rep.hidden = false;
          for (const it of r.report) {
            const mk = h('b', '', it.ok === true ? '✓' : it.ok === false ? '✗' : '·'); mk.style.color = it.ok === true ? '#5fdc8a' : it.ok === false ? '#ff6b6b' : '#9aa7b4';
            rep.append(mk, h('span', '', it.k), h('span', '', it.t));
          }
        } else if (req && req.a !== 'check') { /* 다른 단추는 점검표를 그대로 둔다 */ }
      } catch (e) { st.textContent = `${label}: ${L('실패', 'failed')} — ${(e && e.message) || e}`; }
      finally { sync(); }
    };
    const btn = (id, t, req) => { const b = h('button', '', t); b.id = id; b.dataset.scnDev = '1'; b.onclick = () => { void run(b, typeof req === 'function' ? req() : req, t); }; return b; };
    const row1 = h('div'); row1.append(side, document.createTextNode(' '), coal, document.createTextNode(' '), btn('scnDevRevolt', L('무작위 귀족 반란 일으키기', 'Trigger a random noble revolt'), () => ({ a: 'revolt', side: side.value, coalition: cb.checked })));
    const row0 = h('div'); row0.style.marginBottom = '6px';
    row0.append(btn('scnDevCheck', L('상태 점검(로그·수비대·반란·오류 한 번에)', 'Health check (logs · garrisons · revolts · errors at once)'), { a: 'check' }), document.createTextNode(' '), btn('scnDevMirror', L('수비대 전쟁 상태 지금 맞추기', 'Sync garrison war state now'), { a: 'mirror' }));
    const row2 = h('div'); row2.style.marginTop = '6px';
    row2.append(btn('scnDevYear', L('귀족 연례 판단 지금 돌리기', 'Run the yearly noble pass now'), { a: 'year' }), document.createTextNode(' '), btn('scnDevMonths', L('성계 쟁탈 여섯 달 진행', 'Advance system contests six months'), { a: 'months' }), document.createTextNode(' '), btn('scnDevReveal', L('모든 반란 밀약 드러내기', 'Reveal all conspiracies'), { a: 'reveal' }), document.createTextNode(' '), btn('scnDevState', L('영지·밀약 상태 보기', 'Show domain & plot state'), { a: 'state' }), document.createTextNode(' '), btn('scnDevGarrison', L('영지 수비대 모두 다시 짜기', 'Rebuild all noble garrisons'), { a: 'garrison' }), document.createTextNode(' '), btn('scnDevGek', L('무작위 하극상 일으키기', 'Start a random usurpation'), { a: 'gek' }), document.createTextNode(' '), btn('scnDevInd', L('독립 요구 일으키기(가장 큰 귀족)', 'Start a plea for independence (largest noble)'), { a: 'ind' }));
    // 2026-11-08 회랑의 귀족 · 귀족 건강 · 내부자·새 공작 카드(사용자: 「개발자 도구에서 즉각 테스트되게」) — 회랑 자리 판에서
    const sp = () => document.createTextNode(' ');
    const row3 = h('div'); row3.style.marginTop = '6px';
    row3.append(h('b', '', L('회랑의 귀족: ', 'Corridor nobles: ')), btn('scnDevCnTake', L('정복지 만들기(위 진영의 귀족 영지 하나를 회랑에)', 'Take land (one noble domain of the side above)'), () => ({ a: 'cn_take', side: side.value })), sp(),
      btn('scnDevCnLow', L('우리 귀족 충성 15로', 'Drop a noble’s loyalty to 15'), { a: 'cn_low' }), sp(), btn('scnDevCnSpy', L('우리 귀족 곁에 첩자 심기', 'Plant a spy beside our noble'), { a: 'cn_spy' }), sp(),
      btn('scnDevCnBetrayF', L('배신 — 독립', 'Betrayal — independence'), { a: 'cn_betray', kind: 'free' }), sp(), btn('scnDevCnBetrayB', L('배신 — 귀순', 'Betrayal — defection'), { a: 'cn_betray', kind: 'betray' }), sp(), btn('scnDevCnYear', L('회랑의 귀족 연례 지금', 'Corridor noble yearly pass now'), { a: 'cn_year' }));
    const row4 = h('div'); row4.style.marginTop = '6px';
    row4.append(h('b', '', L('건강·내부자: ', 'Health & insiders: ')), btn('scnDevHpYear', L('건강 연례 지금(지병·소문·병사)', 'Health yearly pass now (illness · rumor · death)'), { a: 'hp_year' }), sp(), btn('scnDevHpHarm', L('아무 귀족 건강 −35', 'Random noble health −35'), { a: 'hp_harm' }), sp(), btn('scnDevHpState', L('건강 기록 보기(진짜 값)', 'Show health records (true values)'), { a: 'hp_state' }), sp(),
      btn('scnDevInCards', L('새 카드 24장 손패로 + 첩보력', '24 new cards to hand + intel'), { a: 'in_cards' }), sp(), btn('scnDevInFoe', L('방첩 대전 지금 시작(보안망 가득)', 'Start a counter-intel duel now (full security)'), { a: 'in_foe' }), sp(), btn('scnDevInChief', L('첩보부장 +4승(자동 대응 열기)', 'Spymaster +4 wins (unlock auto)'), { a: 'in_chief' }), sp(), btn('scnDevInIns', L('내부자 20명 모두 매수(공작원 섹터)', 'Buy all 20 insiders (posted sector)'), { a: 'in_ins' }), sp(), btn('scnDevInDbl', L('내부자 이중 첩자로', 'Turn insiders into double agents'), { a: 'in_dbl' }));
    sec.append(row0, rep, row1, row2, row3, row4, st, out);
    return sec;
  }
  function sync() { if (!box) return; for (const b of box.querySelectorAll('[data-scn-dev]')) b.disabled = !devOn(); const s = $('scnDevSide'); if (s) s.disabled = !devOn(); const c = $('scnDevCoal'); if (c) c.disabled = !devOn(); }
  async function check() {
    const host = $('devTools'); if (!host || !window.sllm || !window.sllm.scnNobles || !window.sllm.scnDev) return;
    let on = false; try { const r = await window.sllm.scnNobles(); on = !!(r && r.ok && r.on); } catch (e) { on = false; }
    if (!on) { if (box) { box.remove(); box = null; } return; }
    if (!box) { box = build(); host.append(box); }
    sync();
  }
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { void check(); }, 600);
    setInterval(() => { void check(); }, 30000); // 세이브를 바꾸면 칸이 생기거나 사라진다
    setInterval(sync, 1500); // 개발자 모드 상자는 본체가 바꾸기도 한다(change 이벤트 없이)
    document.addEventListener('change', (e) => { if (e.target && e.target.id === 'devOn') sync(); });
    document.addEventListener('sllm-language', () => { if (box) { box.remove(); box = null; void check(); } });
  });
})();
