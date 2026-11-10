// 집무실 인물 카드의 「정치적 지위」 칸(2026-10-23 초안). 앱: src/features/politics-app.ts(standingInfo) · 규칙: src/standing.ts.
// 총독(또는 기록이 있는 인물)에게만 보인다. 수치가 없으면 「미확인」 — 0이나 추정값으로 채우지 않는다. 문구는 L(한, 영)만(언어 팩 호환).
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const css = '.pol{margin:8px 0 6px;padding:7px 9px;border:1px solid color-mix(in srgb,var(--line,#5fd4e4) 45%,transparent);font-size:12px}'
    + '.pol .pt{font-weight:700;letter-spacing:.06em;margin-bottom:4px;opacity:.85}.pol .rw{display:flex;justify-content:space-between;gap:8px}.pol .rw b{font-variant-numeric:tabular-nums}'
    + '.pol .bar{height:4px;margin:2px 0 5px;background:color-mix(in srgb,currentColor 12%,transparent)}.pol .bar i{display:block;height:100%;background:var(--hi,#5fd4e4)}'
    + '.pol .rc{margin-top:4px;opacity:.8;font-size:11.5px}.pol .up{color:#6fd7a8}.pol .dn{color:#e0705f}.pol .nt{opacity:.65;font-size:11px;margin-top:3px}';
  function style() { if (document.getElementById('polCss')) return; const s = h('style'); s.id = 'polCss'; s.textContent = css; document.head.append(s); }
  const val = (v) => (v === null || v === undefined ? L('미확인', 'Unknown') : String(v));
  function row(box, label, v, raw) {
    const r = h('div', 'rw'), a = h('span', '', label); if (raw) a.setAttribute('data-i18n-skip', '');
    r.append(a, h('b', '', val(v))); box.append(r);
    if (v !== null && v !== undefined) { const bar = h('div', 'bar'), i = h('i'); i.style.width = Math.max(0, Math.min(100, v)) + '%'; bar.append(i); box.append(bar); }
  }
  function draw(box, v, p) {
    box.textContent = '';
    if (!v || (!v.has && p.role !== 'governor')) { box.hidden = true; return; }
    box.hidden = false; style(); box.classList.add('pol');
    box.append(h('div', 'pt', L('정치적 지위', 'Political standing')));
    row(box, L('지위', 'Standing'), v.standing);
    for (const s of v.support || []) row(box, L(`「${s.planet}」 주민 지지`, `Support on "${s.planet}"`), s.value, true);
    for (const c of v.recent || []) { const d = h('div', 'rc'); d.append(h('span', '', `${c.date} · ${c.text}${c.planet ? ` (${c.planet})` : ''} `), h('b', c.delta > 0 ? 'up' : 'dn', (c.delta > 0 ? '+' : '') + c.delta)); box.append(d); }
    box.append(h('div', 'nt', v.has ? L('앱의 정치 기록입니다. 게임 수치는 바뀌지 않습니다.', 'An app record of politics. Game values are not changed.') : L('아직 기록된 정치적 사건이 없습니다.', 'No political events recorded yet.')));
  }
  /** office.html drawDetail 이 부른다. alive(): 아직 같은 인물을 보고 있는지. */
  function load(box, p, alive) {
    box.hidden = true;
    if (!p || !p.key || !String(p.key).startsWith('p:') || !window.sllm.standingInfo) return;
    window.sllm.standingInfo(p.key, p.planet || '').then((v) => { if (alive()) draw(box, v, p); }).catch(() => {});
  }
  window.SLLMStanding = { load, draw };
})();
