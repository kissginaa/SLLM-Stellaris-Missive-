// 「행성 기념일」 칸(2026-10-23 초안). 집무실 「행성 총독」 칸의 아이콘으로 따로 연다(office-govgroup.js — 처음엔 「국가 행사날」 안에 있었음). 앱: src/features/holiday-app.ts · 규칙: src/planet-holiday.ts.
// 행성 주민들이 정한 기념일(국가기념일과 별개). 기념일이 든 달 안에 「방문」하면 그 행성에만 효과. office-national.js 가 mountPlanetHolidays(panel) 한 줄로 부른다.
// 달력(.ne-calendar)에도 표시한다(달을 넘기면 다시 그린다). 문구는 L(한, 영)만(언어 팩 호환). 행성·기념일 이름은 data-i18n-skip.
(() => {
  const L = (k, e) => (window.SLLMI18n?.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined && text !== null) e.textContent = text; if (cls) e.className = cls; return e; };
  const skip = (e) => { e.setAttribute('data-i18n-skip', ''); return e; };
  window.mountPlanetHolidays = async (panel) => {
    if (!window.sllm.holidaysState) return;
    let st = null, busy = false, msg = '';
    const root = h('section', undefined, 'ne-event ph-box'); panel.append(root);
    const mark = () => {
      const grid = panel.querySelector('.ne-calendar'); if (!grid || !st || !st.items) return;
      grid.querySelectorAll('.ph-mark').forEach((x) => x.remove());
      const mo = Number(grid.dataset.month), cells = grid.querySelectorAll('.ne-day');
      for (const it of st.items.filter((x) => x.month === mo && x.owned)) { const c = cells[it.day - 1]; if (c) { const s = skip(h('small', `🎉 ${it.planet}`, 'ph-mark')); s.title = it.title; c.append(s); } }
    };
    if (panel.__phObs) panel.__phObs.disconnect(); // 국가 행사날 창이 다시 그릴 때마다 불리므로 감시는 하나만
    panel.__phObs = new MutationObserver(() => { if (!panel.querySelector('.ph-mark')) mark(); }); panel.__phObs.observe(panel, { childList: true });
    function draw() {
      root.replaceChildren(); if (!st || !st.sid) return;
      root.append(h('h3', L('행성 기념일', 'Planet holidays')), h('p', L('각 행성 주민들이 정한 기념일입니다. 기념일 자체에는 효과가 없고, 기념일이 든 달 안에 통치자가 방문하면 그 행성에만 효과가 생깁니다(해마다 한 번).', 'Holidays the residents of each planet keep. A holiday alone has no effect; if the ruler visits during the holiday month, that planet alone gets a bonus (once a year).')));
      if (msg) root.append(skip(h('p', msg, 'ph-msg')));
      if (!st.items.length) root.append(h('p', L('아직 알려진 행성 기념일이 없습니다. 설립한 지 1년이 지난 행성부터 한 달에 몇 곳씩 알려집니다.', 'No planet holidays are known yet. Planets settled at least a year ago reveal theirs a few each month.')));
      for (const it of st.items.slice(0, 12)) {
        const card = h('div', undefined, 'ph-item' + (it.month_ ? ' today' : ''));
        const t = h('div'); t.append(skip(h('b', it.title)), h('span', L(` · ${it.month}월 ${it.day}일 · `, ` · month ${it.month}, day ${it.day} · `)), skip(h('span', it.planet)));
        card.append(t, skip(h('p', it.desc)));
        if (!it.owned) card.append(h('small', L('지금은 우리 행성이 아니라 방문할 수 없습니다.', 'Not our planet now; it cannot be visited.')));
        else if (it.visited) card.append(h('small', it.status === 'applied' ? L('올해 방문함 — 효과 적용 확인', 'Visited this year — bonus confirmed') : L('올해 방문함 — 효과 회신 미확인', 'Visited this year — bonus unconfirmed')));
        else { const b = h('button', it.month_ ? L('🎉 지금 방문하기', '🎉 Visit now') : L(`${it.month}월 중에 방문할 수 있음`, `Can be visited during month ${it.month}`)); b.type = 'button'; b.disabled = !it.month_ || busy;
          b.onclick = async () => { if (busy) return; busy = true; msg = L('게임 날짜를 확인하고 방문하는 중…', 'Checking the game date and visiting…'); draw(); try { const r = await window.sllm.holidayVisit(it.planet); msg = r.ok ? r.text : r.error; if (r.state) st = r.state; } catch (e) { msg = String(e); } busy = false; draw(); mark(); };
          card.append(b); }
        root.append(card);
      }
      const w = st.waiting;
      const parts = [w.queued.length ? L(`곧 알려질 행성 ${w.queued.length}곳`, `${w.queued.length} planet(s) about to reveal theirs`) : '', w.young.length ? L(`설립 1년이 안 된 행성 ${w.young.length}곳`, `${w.young.length} planet(s) settled less than a year ago`) : '', w.unknown.length ? L(`설립일을 아직 모르는 행성 ${w.unknown.length}곳`, `${w.unknown.length} planet(s) with an unknown settlement date`) : ''].filter(Boolean);
      if (parts.length) root.append(h('small', parts.join(' · ')));
      const rf = h('button', L('행성 자료 새로 받기', 'Refresh planet data')); rf.type = 'button'; rf.disabled = busy;
      rf.onclick = async () => { busy = true; draw(); try { st = await window.sllm.holidaysRefresh(); } catch (e) { msg = String(e); } busy = false; draw(); mark(); };
      const ctl = h('div', undefined, 'ne-controls'); ctl.append(rf); root.append(ctl);
    }
    if (!document.getElementById('phCss')) { const s = document.createElement('style'); s.id = 'phCss'; s.textContent = '.ph-item{border-top:1px dashed var(--n-line2,#5fd4e455);padding:8px 0}.ph-item.today{border-left:3px solid var(--n-hi,#5fd4e4);padding-left:8px}.ph-item p{margin:3px 0;font-size:12.5px;opacity:.85}.ph-item small,.ph-box>small{display:block;opacity:.7;font-size:11.5px}.ph-msg{color:var(--n-hi,#5fd4e4)}.ph-mark{display:block;font-size:10px;color:var(--n-hi,#5fd4e4)}'; document.head.append(s); }
    try { st = await window.sllm.holidaysState(); } catch (e) { st = null; }
    draw(); mark();
  };
})();
