// 종속국 통치(2026-11-04 사용자) — 종속국 창(vassal.html) 「통치」 탭의 카드: 조공 감면 요청 답하기 · 감독관 파견/소환.
// 앱: src/features/vassal-court-app.ts · 규칙: src/vassal-court.ts. 2026-11-05: 탭·카드 화면(window.VassalUI). 문구는 L(한, 영)만 — 언어 팩 호환.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const IDS = ['vcBox', 'vcRelief'];
  let busy = false, loading = false;
  function clear() { IDS.forEach((i) => document.getElementById(i)?.remove()); }
  async function act(fn, card) {
    if (busy) return; busy = true; card.say(L('처리 중…', 'Working…')); let r; try { r = await fn(); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; } busy = false;
    const ok = r && r.ok, text = ok ? L('반영했습니다.', 'Done.') : (r && r.error) || L('실패했습니다.', 'Failed.');
    if (ok) { window.VassalUI.refresh(); setTimeout(() => { const m = document.querySelector('#vcBox .vk-msg'); if (m) m.textContent = text; }, 300); } else card.say(text, true);
  }
  async function add() {
    const U = window.VassalUI, ch = U && U.ch; if (loading || !ch || ch.role !== 'vassal' || !ch.active || !U.host('rule') || document.getElementById('vcBox')) return;
    loading = true; let S = null; try { S = await window.sllm.vcState(); } catch (e) { S = null; } loading = false;
    if (!U.ch || U.ch.key !== ch.key) { void add(); return; } if (document.getElementById('vcBox')) return;
    const v = S && S.vassals && S.vassals.find((x) => x.idx === ch.idx || x.name === ch.name); if (!v) return;
    // 조공 감면 요청
    if (v.relief) {
      const r = v.relief, c = U.card('rule', 'vcRelief', L('조공 감면', 'Tribute relief'), '⚖', { order: 5, wide: r.state === 'pending' });
      if (c) {
        if (r.state === 'pending') {
          c.chip(L('답을 기다림', 'Awaiting answer'), 'bad'); U.dot('rule', 'relief', 'warn'); U.todo('relief', [{ text: L('조공 감면 요청에 답하기', 'Answer the tribute-relief request'), tab: 'rule' }]);
          const row = h('div', 'vk-row');
          const b1 = h('button', 'btn yes', L(`전액 감면 · 매달 에너지 약 ${r.full} (1년) · 충성도 매달 +1`, `Full relief · ~${r.full} energy/month (1 yr) · loyalty +1/month`));
          const b2 = h('button', 'btn', L(`절반 감면 · 매달 에너지 약 ${r.half} (1년)`, `Half relief · ~${r.half} energy/month (1 yr)`));
          const b3 = h('button', 'btn no', L('거절 · 충성도 매달 −1 (1년)', 'Refuse · loyalty −1/month (1 yr)'));
          for (const [b, k] of [[b1, 'full'], [b2, 'half'], [b3, 'no']]) { b.type = 'button'; b.disabled = !S.running; b.onclick = () => act(() => window.sllm.vcRelief(v.idx, k), c); row.append(b); }
          c.body.append(h('div', 'vk-ask', r.text), row, c.msg);
        } else {
          c.chip(r.state === 'full' ? L('전액 감면 중', 'Full relief') : L('절반 감면 중', 'Half relief'), 'good'); U.dot('rule', 'relief', null); U.todo('relief', []);
          const kv = h('div', 'vk-kv'); kv.append(h('span', '', L('매달 돌려줌', 'Returned monthly')), h('span', '', L(`에너지 ${r.state === 'full' ? r.full : r.half}`, `${r.state === 'full' ? r.full : r.half} energy`)));
          if (r.until) kv.append(h('span', '', L('끝나는 날', 'Ends')), h('span', '', r.until));
          c.body.append(kv);
        }
      }
    } else { U.dot('rule', 'relief', null); U.todo('relief', []); }
    // 감독관
    const c = U.card('rule', 'vcBox', L('감독관', 'Overseer'), '◉', { order: 30 }); if (!c) return;
    if (v.overseer) {
      c.chip(L(`충성도 매달 +${S.loyaltyPlus}`, `loyalty +${S.loyaltyPlus}/month`), 'good');
      const kv = h('div', 'vk-kv'); kv.append(h('span', '', L('머무는 사람', 'Posted')), h('span', '', v.overseer.name), h('span', '', L('부임', 'Since')), h('span', '', v.overseer.since));
      const rc = h('button', 'btn no', L('소환', 'Recall')); rc.type = 'button'; rc.disabled = !S.running; rc.onclick = () => act(() => window.sllm.vcOverseer(v.idx, 0), c);
      const row = h('div', 'vk-row'); row.append(rc); c.body.append(kv, row);
    } else {
      c.chip(L('없음', 'None'));
      const sel = h('select'); const o0 = h('option', '', L('지도자 고르기', 'Choose a leader')); o0.value = ''; sel.append(o0);
      for (const p of S.leaders || []) { const o = h('option', '', `${p.name} (Lv${p.lv})`); o.value = String(p.lid); sel.append(o); }
      const go = h('button', 'btn', L(`파견 · 영향력 ${S.cost}`, `Send · ${S.cost} influence`)); go.type = 'button'; go.disabled = !S.running;
      go.onclick = () => { if (!sel.value) { c.say(L('보낼 지도자를 고르세요.', 'Choose a leader to send.'), true); return; } act(() => window.sllm.vcOverseer(v.idx, Number(sel.value)), c); };
      const row = h('div', 'vk-row'); row.append(sel, go); c.body.append(row);
    }
    c.body.append(h('p', 'vk-d', L('감독관이 머무는 동안 충성도가 오르고 해마다 보고서가 옵니다. 감독관이 죽거나 물러나면 자동으로 끝납니다. 게임 외교 화면에서 계약을 재협상하면 종속국 통치자가 새 조건에 대한 서신을 보냅니다.', 'While the overseer stays, loyalty rises and an annual report arrives. The posting ends automatically if the overseer dies or is dismissed. Renegotiating the agreement in the game\'s diplomacy screen makes the subject\'s ruler write about the new terms.')), c.msg);
    if (!S.running) c.body.append(h('p', 'vk-d', L('게임이 켜져 있어야 명령을 내릴 수 있습니다.', 'The game must be running to issue orders.')));
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.vcState) return;
    const watch = () => { const pane = document.getElementById('pane'); if (!pane) return setTimeout(watch, 200); new MutationObserver(() => { void add(); }).observe(pane, { childList: true }); void add(); };
    document.addEventListener('vassal-refresh', () => { clear(); void add(); });
    watch();
  });
})();
