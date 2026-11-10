// 종속국 개명 칙령(2026-11-04 사용자) — 종속국 창(vassal.html) 「행정」 탭의 카드. 앱: src/features/vassal-app.ts(vassalRename) · 규칙: src/rename.ts
// 2026-11-05: 탭·카드 화면(window.VassalUI). 문구는 L(한, 영)만 — 언어 팩 호환.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const ID = 'vrBox';
  function add() {
    const U = window.VassalUI, ch = U && U.ch; if (!ch || ch.role !== 'vassal' || !ch.active || !U.host('admin') || document.getElementById(ID)) return;
    const c = U.card('admin', ID, L('개명 칙령', 'Renaming edict'), '✎', { order: 40 }); if (!c) return;
    c.chip(L('자치도 +15', 'autonomy +15'), 'warn');
    const what = h('select'), nm = h('input'), go = h('button', 'btn', L('칙령 내리기', 'Issue edict')), row = h('div', 'vk-row');
    for (const [v, t] of [['cap', L('수도 행성', 'Capital world')], ['sys', L('수도 성계', 'Capital system')]]) { const o = h('option', '', t); o.value = v; what.append(o); }
    nm.maxLength = 40; nm.placeholder = L('새 이름', 'New name'); go.type = 'button';
    go.onclick = async () => {
      const n = nm.value.trim(); if (!n) { c.say(L('새 이름을 적어 주세요.', 'Type the new name.'), true); return; } go.disabled = true; c.say(L('칙령을 전하는 중…', 'Sending the edict…'));
      let r; try { r = await window.sllm.vassalRename(ch.key, what.value, n); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
      go.disabled = false;
      if (r && r.ok) { nm.value = ''; c.say(L(`「${r.old || '?'}」 → 「${r.name}」`, `"${r.old || '?'}" → "${r.name}"`)); window.VassalUI.refresh(); } else c.say((r && r.error) || L('실패했습니다.', 'Failed.'), true);
    };
    row.append(what, nm, go);
    c.body.append(h('p', 'vk-d', L('종속국의 수도 행성이나 성계 이름을 우리가 정합니다. 반감이 커지고(자치도 +15) 간섭 열기가 쌓입니다. 원래 이름은 남아 나중에 외교 거래로 돌려줄 수 있습니다.', 'We choose the name of our subject\'s capital world or system. Resentment rises (autonomy +15) and meddling heat builds. The original name is kept and can be returned later through a deal.')), row, c.msg);
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.vassalRename) return;
    const watch = () => { const pane = document.getElementById('pane'); if (!pane) return setTimeout(watch, 200); new MutationObserver(() => add()).observe(pane, { childList: true }); add(); };
    watch();
  });
})();
