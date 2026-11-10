// 집무실 「예산 회의」(2026-11-04 사용자 결정). 앱: src/features/budget-app.ts, 규칙: src/budget.ts, 게임: sllm_budget.txt.
// 통치자가 직접 소집(1년에 한 번 — 내각 회의 의제와 같은 쿨타임·효과 기간). 장관마다 자기 분야 예산 1건을 요청 → 전액·삭감·거절 → 확정.
// 아이콘은 「로비」 옆(없으면 「의회」·정책 옆). 언어 팩 규칙: 문구는 L('한국어', 'English')(SLLMI18n.pick)으로만.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const btn = (cls, text, fn, dis) => { const b = h('button', cls, text); b.type = 'button'; b.onclick = fn; b.disabled = !!dis; return b; };
  const show = (id) => { if (!document.getElementById(id)) return; for (const v of document.querySelectorAll('.view')) v.classList.toggle('on', v.id === id); };
  const TITLE = () => L('예산 회의', 'Budget meeting');
  const SVG = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 38h32"/><rect x="11" y="22" width="6" height="16" rx="1"/><rect x="21" y="14" width="6" height="24" rx="1"/><rect x="31" y="26" width="6" height="12" rx="1"/><path d="M10 14l8-5 8 4 10-6"/></svg>';
  const fmt = (n) => (Number(n) || 0).toLocaleString();
  let S = null, err = '', busy = false;
  const drafts = {};

  function build() {
    const holo = $('policy') && $('policy').parentElement; if (!holo || $('budgetCall')) return;
    const anchor = $('lobbyCall') || $('auditCall') || $('pollCall') || document.querySelector('[data-app="policy"]'); if (!anchor) return;
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'budgetCall'; b.innerHTML = SVG; b.append(h('span', '', TITLE()), h('b', 'n', ''));
    b.onclick = () => { err = ''; show('budgetView'); load(); };
    anchor.after(b);
    const sec = h('section', 'view app'); sec.id = 'budgetView'; sec.setAttribute('aria-label', TITLE());
    const hd = h('div', 'apph'); const back = h('button', 'back', '‹ ' + L('바탕화면', 'Desktop')); back.type = 'button'; back.onclick = () => show('desktop');
    hd.append(back, h('h3', '', TITLE())); const body = h('div', 'appb'); body.id = 'budgetRoot'; sec.append(hd, body); holo.append(sec);
  }
  function badge() { const b = $('budgetCall'); if (!b) return; const n = b.querySelector('.n'); if (n) n.textContent = S && S.session ? '!' : ''; }
  async function act(fn) { if (busy) return; busy = true; err = ''; draw(); try { const r = await fn(); if (r && r.state) S = r.state; if (r && r.ok === false && r.error) err = r.error; } catch (e) { err = String(e && e.message || e); } busy = false; draw(); }

  function draw() {
    badge();
    const r = $('budgetRoot'); if (!r) return; r.textContent = '';
    const w = h('div', 'bd-main'); r.append(w);
    if (!S || !S.sid) { w.append(h('p', 'bd-note', L('세이브를 불러오면 표시됩니다.', 'Shown once a save is loaded.'))); return; }
    w.append(h('p', 'bd-note', L('장관마다 자기 분야 예산을 하나씩 요청합니다. 승인한 예산은 1년 동안 집행되고, 매달 에너지 크레딧이 빠집니다(월 수입의 약 6%, 삭감하면 절반 효과·절반 비용). 국고가 모자라면 그 예산은 멈춥니다. 분야마다 예산은 하나만 집행됩니다. 예산 회의는 1년에 한 번 열 수 있습니다.',
      'Each minister asks for one budget line in their own portfolio. Approved budgets run for a year and cost energy credits every month (about 6% of monthly income; a cut gives half the effect at half the cost). If the treasury runs short, that budget stops. Only one budget per portfolio runs at a time. The budget meeting can be held once a year.')));
    if (err) w.append(h('div', 'bd-err', err));

    // 집행 중
    w.append(h('p', 'bd-hh', L('집행 중인 예산', 'BUDGETS IN FORCE')));
    if (!(S.active || []).length) w.append(h('p', 'bd-note', L('집행 중인 예산이 없습니다.', 'No budget is running.')));
    for (const a of S.active || []) {
      const row = h('div', 'bd-act'), lab = h('span', '', a.label + (a.cut ? L(' (삭감)', ' (cut)') : '')); lab.dataset.i18nSkip = '';
      const nm = h('span', '', a.name); nm.dataset.i18nSkip = '';
      row.append(h('span', 'bd-tag', a.field), lab, nm, h('span', '', L(`월 ${fmt(a.cost)}`, `${fmt(a.cost)}/month`)), h('span', '', L(`~${a.until}`, `until ${a.until}`)),
        btn('bd-btn ghost', L('중단', 'Stop'), () => { if (confirm(L('이 예산 집행을 지금 멈출까요? 그 장관이 서운해합니다.', 'Stop this budget now? The minister will be disappointed.'))) act(() => window.sllm.budgetCancel(a.domain)); }, busy || !S.running));
      w.append(row);
    }

    // 회의
    const ss = S.session;
    if (ss) {
      w.append(h('p', 'bd-hh', L(`예산 회의 (${ss.date}) — 월 에너지 수입 ${fmt(ss.income)} · 창고 ${fmt(ss.stock)}`, `BUDGET MEETING (${ss.date}) — monthly energy income ${fmt(ss.income)} · stockpile ${fmt(ss.stock)}`)));
      let total = 0;
      for (const q of ss.requests) {
        const card = h('div', 'bd-card ' + (q.choice || '')), hd = h('div', 'bd-ch'), nm = h('b', '', q.name); nm.dataset.i18nSkip = '';
        hd.append(nm, h('span', 'bd-tag', q.field)); if (q.replaces) hd.append(h('span', 'bd-tag', L('승인하면 지금 집행 중인 같은 분야 예산을 바꿉니다', 'Approving replaces the budget running in this portfolio')));
        const say = h('p', 'bd-say', q.say); say.dataset.i18nSkip = '';
        const it = h('div', 'bd-item'); it.append(h('span', '', q.full + L(` · 월 ${fmt(q.cost)}`, ` · ${fmt(q.cost)}/month`)), h('br'), h('small', '', L(`삭감하면: ${q.halfLabel} · 월 ${fmt(q.half)}`, `If cut: ${q.halfLabel} · ${fmt(q.half)}/month`))); it.dataset.i18nSkip = '';
        const row = h('div', 'bd-row');
        for (const [c, ko, en] of [['full', '전액 승인', 'Approve in full'], ['half', '삭감 승인', 'Approve at half'], ['no', '거절', 'Refuse']]) {
          const b = btn('bd-btn' + (c === 'no' ? ' ghost' : '') + (q.choice === c ? ' on' : ''), L(ko, en), () => act(() => window.sllm.budgetDecide(q.lid, c)), busy); row.append(b);
        }
        if (q.choice === 'full') total += q.cost; else if (q.choice === 'half') total += q.half;
        card.append(hd, say, it, row); w.append(card);
      }
      const sum = h('div', 'bd-sum'); sum.append(h('span', '', L('승인한 예산의 월 비용 합계: ', 'Monthly cost of approved budgets: ')), h('b', '', fmt(total)), h('span', '', L(` (월 수입 ${fmt(ss.income)})`, ` (monthly income ${fmt(ss.income)})`))); w.append(sum);
      const all = ss.requests.every((q) => q.choice);
      w.append(h('div', 'bd-row')).append(btn('bd-btn', busy ? L('처리 중…', 'Working…') : L('예산 확정', 'Finalize the budget'), () => act(() => window.sllm.budgetConfirm()), busy || !all || !S.running));
      if (!all) w.append(h('p', 'bd-note', L('모든 요청에 답하면 확정할 수 있습니다.', 'Answer every request to finalize.')));
    } else {
      const row = h('div', 'bd-row');
      row.append(btn('bd-btn', S.busy || busy ? L('장관들을 부르는 중…', 'Summoning the ministers…') : L('예산 회의 소집', 'Convene the budget meeting'), () => act(() => window.sllm.budgetConvene()), busy || S.busy || !S.ready || !S.running || !(S.members || []).length));
      if (!S.ready) row.append(h('span', 'bd-note', L(`다음 예산 회의는 ${S.until}부터 열 수 있습니다.`, `The next budget meeting can be held from ${S.until}.`)));
      else if (!S.running) row.append(h('span', 'bd-note', L('게임이 켜져 있어야 합니다.', 'The game must be running.')));
      w.append(row);
    }

    // 장관별 상시 지시
    w.append(h('p', 'bd-hh', L('장관별 상시 지시', 'STANDING DIRECTIVES')));
    if (!(S.members || []).length) w.append(h('p', 'bd-note', L('평의회에 장관이 없습니다.', 'There are no ministers on the council.')));
    for (const m of S.members || []) {
      const row = h('div', 'bd-min'), who = h('span', '', `${m.name} · ${m.title}`); who.dataset.i18nSkip = '';
      const inp = h('input'); inp.type = 'text'; inp.maxLength = 200; inp.value = drafts[m.lid] !== undefined ? drafts[m.lid] : m.directive; inp.placeholder = L(`예: ${m.domain} 예산은 ○○ 위주로`, `e.g. focus the ${m.domain} budget on …`); inp.oninput = () => { drafts[m.lid] = inp.value; };
      const sv = btn('bd-btn ghost', L('저장', 'Save'), () => { const v = inp.value; act(async () => { const res = await window.sllm.budgetDirective(m.lid, v); delete drafts[m.lid]; return res; }); }, busy);
      row.append(who, inp, sv); w.append(row);
    }
    w.append(h('p', 'bd-note', L('지시는 다음 예산 회의에서 그 장관이 고르는 항목과 발언에 반영됩니다(예: 연구 책임자에게 "함선 기술 위주로" → 함선 설계·추진 연구 투자 요청).', 'Directives shape what that minister asks for at the next budget meeting (e.g. tell the Head of Research "focus on ships" → a voidcraft or propulsion research request).')));

    if ((S.log || []).length) { w.append(h('p', 'bd-hh', L('기록', 'RECORD'))); const ol = h('ol', 'bd-log'); for (const x of S.log) { const li = h('li', '', `${x.date} ${x.text}`); li.dataset.i18nSkip = ''; ol.append(li); } w.append(ol); }
  }
  async function load() { try { S = await window.sllm.budgetState(); } catch (e) { S = null; } draw(); }
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.budgetState) return;
    setTimeout(() => { build(); load(); }, 600); // 「로비」 아이콘(office-lobby.js, 560ms) 뒤
    if (window.sllm.onBudgetUpdate) window.sllm.onBudgetUpdate((v) => { S = v; if (!busy) draw(); });
    document.addEventListener('sllm-language', () => {
      const b = $('budgetCall'); if (b) b.querySelector('span').textContent = TITLE();
      const t = $('budgetView') && $('budgetView').querySelector('h3'); if (t) t.textContent = TITLE();
      const bk = $('budgetView') && $('budgetView').querySelector('.back'); if (bk) bk.textContent = '‹ ' + L('바탕화면', 'Desktop');
      load();
    });
  });
  window.SLLMBudget = { load };
})();
