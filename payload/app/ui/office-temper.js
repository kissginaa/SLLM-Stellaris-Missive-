// 집무실 「외교 노선」(2026-11-04 사용자 결정: 자연 누적 + 직접 공작). 앱: src/features/temper-app.ts, 규칙: src/temper.ts, 게임: sllm_temper.txt.
// AI 제국마다 노선 압력(강경 −100 ~ 온건 +100)이 쌓이고 ±60을 넘으면 게임 안 외교 성향이 바뀐다. 첩보 「노선 공작」으로 직접 밀 수도 있다.
// 아이콘은 「예산 회의」 옆(없으면 「로비」 옆). 언어 팩 규칙: 문구는 L('한국어', 'English')(SLLMI18n.pick)으로만.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const btn = (cls, text, fn, dis) => { const b = h('button', cls, text); b.type = 'button'; b.onclick = fn; b.disabled = !!dis; return b; };
  const show = (id) => { if (!document.getElementById(id)) return; for (const v of document.querySelectorAll('.view')) v.classList.toggle('on', v.id === id); };
  const TITLE = () => L('외교 노선', 'Foreign stances');
  const SVG = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="16"/><path d="M8 24h32"/><path d="M24 8c5 5 5 27 0 32M24 8c-5 5-5 27 0 32"/><path d="M30 14l6-4M18 34l-6 4"/></svg>';
  let S = null, err = '', busy = false, msg = '';

  function build() {
    const holo = $('policy') && $('policy').parentElement; if (!holo || $('temperCall')) return;
    const anchor = $('budgetCall') || $('lobbyCall') || $('auditCall') || $('pollCall') || document.querySelector('[data-app="policy"]'); if (!anchor) return;
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'temperCall'; b.innerHTML = SVG; b.append(h('span', '', TITLE()), h('b', 'n', ''));
    b.onclick = () => { err = ''; msg = ''; show('temperView'); load(); };
    anchor.after(b);
    const sec = h('section', 'view app'); sec.id = 'temperView'; sec.setAttribute('aria-label', TITLE());
    const hd = h('div', 'apph'); const back = h('button', 'back', '‹ ' + L('바탕화면', 'Desktop')); back.type = 'button'; back.onclick = () => show('desktop');
    hd.append(back, h('h3', '', TITLE())); const body = h('div', 'appb'); body.id = 'temperRoot'; sec.append(hd, body); holo.append(sec);
  }
  async function act(fn) { if (busy) return; busy = true; err = ''; msg = ''; draw(); try { const r = await fn(); if (r && r.state) S = r.state; if (r && r.ok === false && r.error) err = r.error; else if (r && r.ok) msg = r.success === undefined ? '' : (r.success ? L('공작 성공 — 그 나라 여론이 움직였습니다.', 'Success — opinion there has moved.') : L('공작 실패 — 여론이 움직이지 않았습니다.', 'Failed — opinion did not move.')) + (r.caught ? ' ' + L('그리고 공작이 들켰습니다(호감 −50, 신문).', 'And the operation was exposed (opinion −50, in the news).') : ''); } catch (e) { err = String(e && e.message || e); } busy = false; draw(); }

  function bar(p, th) {
    const w = h('div', 'tp-bar'), i = h('i'), pos = (v) => ((v + 100) / 200 * 100) + '%';
    for (const t of [-th, th]) { const s = h('s'); s.style.left = pos(t); w.append(s); }
    i.style.left = pos(Math.max(-100, Math.min(100, p))); w.append(i); return w;
  }
  function draw() {
    const r = $('temperRoot'); if (!r) return; r.textContent = '';
    const w = h('div', 'tp-main'); r.append(w);
    if (!S || !S.sid) { w.append(h('p', 'tp-note', L('세이브를 불러오면 표시됩니다.', 'Shown once a save is loaded.'))); return; }
    w.append(h('p', 'tp-note', L(`AI 제국은 우리 행동에 따라 외교 노선이 기웁니다. 외교 대화에서 존중하면 온건, 위협·모욕하면 강경 쪽으로. 거래를 맺으면 온건, 우리가 약속을 깨면 강경 쪽으로. 해마다 은하 판세(함대 전력 순위)도 영향을 줍니다. 눈금(±${S.threshold})을 넘으면 그 나라의 실제 외교 성향이 바뀌고(5년에 한 번까지) 신문에 실립니다.`,
      `AI empires’ foreign policy leans with our actions: respect in diplomatic talks pushes them moderate, threats and insults push them hardline; deals push moderate, our broken promises push hardline. The yearly balance of power (fleet strength ranking) also counts. Past the mark (±${S.threshold}) their actual diplomatic personality changes (at most once every 5 years) and it makes the news.`)));
    if (err) w.append(h('div', 'tp-err', err));
    if (msg) w.append(h('p', 'tp-note', msg));

    w.append(h('p', 'tp-hh', L('은하 판세 — 함대 전력 순위(숫자 = 함대 전력)', 'BALANCE OF POWER — FLEET STRENGTH (number = fleet power)')));
    if (S.top && S.top.length) { const t = h('div', 'tp-top'); for (const x of S.top) { const s = h('span', x.us ? 'us' : '', `${x.rank}. ${x.name}${x.fp ? ' · ' + x.fp : ''}`); s.dataset.i18nSkip = ''; t.append(s); } w.append(t); }
    const rr = h('div', 'tp-row');
    rr.append(btn('tp-btn ghost', busy || S.busy ? L('관측 중…', 'Observing…') : L('새로 관측', 'Observe again'), () => act(() => window.sllm.temperRefresh()), busy || S.busy || !S.running));
    rr.append(h('span', 'tp-note', S.seen ? L(`마지막 관측 ${S.seen} · 해마다 1월 1일에 저절로 관측합니다.`, `Last observed ${S.seen} · observed automatically every 1 January.`) : L('아직 관측하지 않았습니다.', 'Not observed yet.')));
    w.append(rr);

    w.append(h('p', 'tp-hh', L('제국별 노선', 'STANCES BY EMPIRE')));
    if (!(S.empires || []).length) w.append(h('p', 'tp-note', L('「새로 관측」을 누르면 통신 중인 제국이 나옵니다.', 'Press "Observe again" to list the empires you are in contact with.')));
    for (const e of S.empires || []) {
      const c = h('div', 'tp-card'), hd = h('div', 'tp-ch'), nm = h('b', '', e.name); nm.dataset.i18nSkip = ''; hd.append(nm);
      if (e.pers) { const t = h('span', 'tp-tag' + (e.cls === 1 ? ' dove' : e.cls === 2 ? ' hawk' : ''), e.pers); t.dataset.i18nSkip = ''; hd.append(t); }
      hd.append(h('span', 'tp-tag', L(`국력 ${e.power}`, `power: ${e.power}`)));
      if (e.war) hd.append(h('span', 'tp-tag hawk', L('우리와 전쟁 중', 'at war with us')));
      if (!e.ok) hd.append(h('span', 'tp-tag', L('노선이 바뀌지 않는 나라', 'stance cannot change')));
      c.append(hd);
      if (e.ok) {
        const ax = h('div', 'tp-axis'); ax.append(h('span', '', L('← 강경', '← hardline')), h('span', '', `${e.lean} (${e.p > 0 ? '+' : ''}${e.p})`), h('span', '', L('온건 →', 'moderate →'))); c.append(bar(e.p, S.threshold), ax);
        if (e.coolMonths) c.append(h('p', 'tp-note', L(`최근에 노선이 바뀌어 ${Math.ceil(e.coolMonths / 12)}년쯤은 다시 바뀌지 않습니다.`, `Their stance changed recently; it will not change again for about ${Math.ceil(e.coolMonths / 12)} year(s).`)));
        if (e.causes.length) { const ul = h('ul', 'tp-causes'); for (const x of e.causes) ul.append(h('li', '', `${x.date} ${x.text} (${x.d > 0 ? '+' : ''}${x.d})`)); c.append(ul); }
        const row = h('div', 'tp-row'), cost = L(`에너지 ${S.cost.energy} · 영향력 ${S.cost.influence} · 성공 ${S.cost.chance}% · 들킬 확률 ${S.cost.caught}%`, `${S.cost.energy} energy · ${S.cost.influence} influence · ${S.cost.chance}% success · ${S.cost.caught}% exposure`);
        const dis = busy || !S.running || e.opCool > 0;
        row.append(btn('tp-btn', L('🕊 온건 노선 공작', '🕊 Push moderate'), () => act(() => window.sllm.temperOp(e.idx, 1)), dis));
        row.append(btn('tp-btn', L('⚔ 강경 노선 공작', '⚔ Push hardline'), () => act(() => window.sllm.temperOp(e.idx, 2)), dis || e.pac));
        row.append(h('span', 'tp-note', e.opCool ? L(`다음 공작까지 ${e.opCool}개월`, `${e.opCool} month(s) until the next operation`) : cost));
        c.append(row);
        if (e.pac) c.append(h('p', 'tp-note', L('평화주의 국가라 강경 노선으로는 돌지 않습니다.', 'A pacifist nation; it will not turn hardline.')));
      }
      w.append(c);
    }
    w.append(h('p', 'tp-note', L('게임 안 칙령 메뉴에도 비상 스위치 두 개가 있습니다: 「SLLM: 자동 작전 전체 중지」(자동 작전이 켜져 있을 때) · 「SLLM: 예산 집행 전체 중단」(집행 중인 예산이 있을 때). 비용 없이 바로 멈춥니다.', 'The in-game Edicts menu also has two emergency switches: "SLLM: Halt All Automated Operations" (while automation is on) and "SLLM: Suspend All Budgets" (while a budget is running). They stop things at once, at no cost.')));
    if ((S.log || []).length) { w.append(h('p', 'tp-hh', L('기록', 'RECORD'))); const ol = h('ol', 'tp-log'); for (const x of S.log) { const li = h('li', '', `${x.date} ${x.text}`); li.dataset.i18nSkip = ''; ol.append(li); } w.append(ol); }
  }
  async function load() { try { S = await window.sllm.temperState(); } catch (e) { S = null; } draw(); }
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.temperState) return;
    setTimeout(() => { build(); load(); }, 640); // 「예산 회의」 아이콘(office-budget.js, 600ms) 뒤
    if (window.sllm.onTemperUpdate) window.sllm.onTemperUpdate((v) => { S = v; if (!busy) draw(); });
    document.addEventListener('sllm-language', () => {
      const b = $('temperCall'); if (b) b.querySelector('span').textContent = TITLE();
      const t = $('temperView') && $('temperView').querySelector('h3'); if (t) t.textContent = TITLE();
      const bk = $('temperView') && $('temperView').querySelector('.back'); if (bk) bk.textContent = '‹ ' + L('바탕화면', 'Desktop');
      load();
    });
  });
  window.SLLMTemper = { load };
})();
