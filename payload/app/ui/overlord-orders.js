// 역방향: AI 종주국이 우리에게 내린 명령(2026-11-05 사용자: 「플레이어가 AI에게 당할 때만 역으로」) — 종속국 창(vassal.html)의 종주국 채널 「명령」·「현황」 탭 카드.
// 앱: src/features/overlord-pressure-app.ts · 규칙: src/overlord-pressure.ts. 문구는 L(한, 영)만 — 언어 팩 호환.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const IDS = ['voOrder', 'voFleet', 'voHist', 'voHeat', 'voThreat'];
  let loading = false;
  const clear = () => IDS.forEach((i) => document.getElementById(i)?.remove());
  const ANS = { ok: ['따름', 'Obeyed'], no: ['거절', 'Refused'], late: ['기한 넘김', 'Lapsed'], forced: ['강제로 빼앗김', 'Seized'], info: ['', ''] };
  async function add() {
    const U = window.VassalUI, ch = U && U.ch; if (loading || !ch || ch.role !== 'overlord' || !ch.active || !U.host('orders') || document.getElementById('voOrder')) return;
    loading = true; let V = null; try { V = await window.sllm.voState(); } catch (e) { V = null; } loading = false;
    if (!U.ch || U.ch.key !== ch.key) { void add(); return; } if (!V || !V.ok || document.getElementById('voOrder')) return;

    // 명령: 지금 답할 것
    const c = U.card('orders', 'voOrder', L('종주국 명령', 'Overlord orders'), '📜', { order: 10, wide: true });
    if (c) {
      const P = V.pending;
      if (P) {
        c.chip(L(`${P.due}까지 답하기`, `Answer by ${P.due}`), 'bad'); U.dot('orders', 'order', 'warn'); U.todo('order', [{ text: L(`종주국 명령에 답하기(${P.name})`, `Answer the overlord's order (${P.name})`), tab: 'orders' }]);
        const yes = h('button', 'btn yes', L('따른다', 'Obey')), no = h('button', 'btn no', L('거절한다', 'Refuse')); yes.type = no.type = 'button'; yes.disabled = no.disabled = !V.running;
        const go = async (acc) => {
          yes.disabled = no.disabled = true; c.say(L('처리 중…', 'Working…')); let r; try { r = await window.sllm.voAnswer({ id: P.id, accept: acc }); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
          if (r && r.ok) { U.refresh(); setTimeout(() => { const m = document.querySelector('#voOrder .vk-msg'); if (m) m.textContent = r.text; }, 300); } else { c.say((r && r.error) || L('실패했습니다.', 'Failed.'), true); yes.disabled = no.disabled = !V.running; }
        };
        yes.onclick = () => go(true); no.onclick = () => go(false);
        const row = h('div', 'vk-row'); row.append(yes, no);
        const head = h('div', 'vk-sub', `${P.icon} ${P.name}`.toUpperCase());
        c.body.append(head, h('div', 'vk-ask', P.text), row, h('p', 'vk-d', V.refuseText), c.msg);
      } else {
        c.chip(L('명령 없음', 'No orders'), 'good'); U.dot('orders', 'order', null); U.todo('order', []);
        c.body.append(h('p', 'vk-d', L('종주국은 가끔 대리전·함대 징발·함대 헌납·감시관 파견을 명합니다(명령 사이 1년 이상). 60일 안에 답하지 않으면 거절로 칩니다. 따르면 우리 백성의 간섭 반감이 쌓이고, 거절하면 종주국과의 관계가 나빠집니다.', 'Now and then the overlord orders a proxy war, a fleet levy, a fleet tithe or a court minder (at least a year apart). No answer within 60 days counts as refusal. Obeying builds resentment among our people; refusing sours the overlord.')));
      }
      if (!V.running) c.body.append(h('p', 'vk-d', L('게임이 켜져 있어야 답할 수 있습니다.', 'The game must be running to answer.')));
    }
    // 명령: 진행 중인 일(징발·대리전)
    if (V.levy || V.proxy) {
      const f = U.card('orders', 'voFleet', L('진행 중', 'In progress'), '⚓', { order: 20 });
      if (f) {
        const kv = h('div', 'vk-kv');
        if (V.levy) kv.append(h('span', '', L('징발당한 함대', 'Levied fleet')), h('span', '', V.levy.state === 'on' ? L(`「${V.levy.fleet}」 ${V.levy.until}까지`, `"${V.levy.fleet}" until ${V.levy.until}`) : V.levy.state === 'lost' ? L(`「${V.levy.fleet}」 잃음`, `"${V.levy.fleet}" lost`) : L(`「${V.levy.fleet}」 돌아옴`, `"${V.levy.fleet}" returned`)));
        if (V.proxy) kv.append(h('span', '', L('대리전', 'Proxy war')), h('span', '', V.proxy.state === 'war' ? L(`${V.proxy.target}과(와) 교전 중`, `At war with ${V.proxy.target}`) : V.proxy.won ? L(`${V.proxy.target} 상대 승리`, `Won against ${V.proxy.target}`) : L(`${V.proxy.target}과(와)의 전쟁 끝남`, `War with ${V.proxy.target} over`)));
        f.body.append(kv);
      }
    }
    // 명령: 지난 기록
    const hc = U.card('orders', 'voHist', L('지난 명령', 'Past orders'), '☰', { order: 30 });
    if (hc) {
      if (V.refusals) hc.chip(L(`헌납 거절 ${V.refusals}번`, `${V.refusals} tithe refusal(s)`), V.refusals >= 1 ? 'warn' : '');
      if (!V.hist.length) hc.body.append(h('p', 'vk-d', L('아직 없습니다.', 'None yet.')));
      else { const kv = h('div', 'vk-kv'); for (const x of V.hist) { kv.append(h('span', '', `${x.at} · ${x.name}${ANS[x.ans] && ANS[x.ans][0] ? ' · ' + L(...ANS[x.ans]) : ''}`), h('span', '', x.text)); } hc.body.append(kv); }
    }
    // 현황: 우리 백성의 간섭 반감 · 동조 · 종속국을 노리는 나라
    const ht = U.card('status', 'voHeat', L('종주국 간섭에 대한 반감', 'Resentment of the overlord'), '♨', { order: 20 });
    if (ht) {
      const t = V.heat.tier; ht.chip(t > 0 ? L(`${t}단계`, `Tier ${t}`) : L('없음', 'None'), t >= 3 ? 'bad' : t >= 1 ? 'warn' : 'good');
      ht.body.append(h('div', '', V.heat.text), h('p', 'vk-d', L(`종주국의 명령을 따르거나 법이 바뀔 때마다 우리 행성 안정도와 파벌 지지가 떨어집니다(6달마다 1씩 식음). 정책·종족 권리 동조는 종속된 지 5년마다 저절로 일어납니다${V.nextAlign !== null ? ` — 다음은 약 ${V.nextAlign}년 뒤` : ''}.`, `Each order we obey and each forced law change lowers our planet stability and faction approval (cools by 1 every 6 months). Policy and species-rights alignment happens on its own every 5 years as a subject${V.nextAlign !== null ? ` — next in about ${V.nextAlign} yr` : ''}.`)));
    }
    if (V.threats.length) {
      const th = U.card('status', 'voThreat', L('우리 종속국을 노리는 나라', 'Rivals coveting our subjects'), '⚑', { order: 30 });
      if (th) { th.chip(L(`${V.threats.length}건`, `${V.threats.length}`), 'bad'); const kv = h('div', 'vk-kv'); for (const x of V.threats) kv.append(h('span', '', x.at), h('span', '', L(`${x.foe} → ${x.name} (전쟁명분 5년)`, `${x.foe} → ${x.name} (casus belli, 5 years)`))); th.body.append(kv); }
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.voState) return;
    const watch = () => { const pane = document.getElementById('pane'); if (!pane) return setTimeout(watch, 200); new MutationObserver(() => { void add(); }).observe(pane, { childList: true }); void add(); };
    document.addEventListener('vassal-refresh', () => { clear(); void add(); });
    watch();
  });
})();
