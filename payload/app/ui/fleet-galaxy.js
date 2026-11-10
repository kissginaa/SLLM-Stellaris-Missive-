// 작전지휘실 버튼(2026-11-05 사용자) — 함대 사령부 창(fleet.html) 왼쪽 맨 위. 누르면 화면 전체를 덮는 작전지휘실 창(warroom.html)이 열린다(src/features/galaxy-app.ts).
// 지도 그림·조작은 warroom.js. 문구는 L(한, 영)만 — 언어 팩 호환.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  if (!window.sllm || !window.sllm.warroomOpen) return;
  const css = () => { if (document.getElementById('gxCss')) return; const st = h('style'); st.id = 'gxCss'; st.textContent = '#gxBtn{border-color:var(--hi,#5fd4e4)!important;background:linear-gradient(90deg,color-mix(in srgb,var(--hi,#5fd4e4) 12%,var(--panel,#0b2230)),var(--panel,#0b2230))!important}#gxBtn b{color:var(--hi,#5fd4e4);letter-spacing:.14em}'; document.head.append(st); };
  let msgT = null;
  function side() {
    const sd = document.getElementById('side'); if (!sd) return;
    let b = document.getElementById('gxBtn');
    if (!b) {
      css(); b = h('button', 'adm'); b.id = 'gxBtn'; b.type = 'button'; b.setAttribute('data-i18n-skip', '');
      b.append(h('b', '', L('작전지휘실', 'WAR ROOM')), h('small', '', L('은하 작전도 — 함대 명령·작전 회의', 'Galactic map — fleet orders, war council')));
      b.onclick = async () => {
        let r; try { r = await window.sllm.warroomOpen(); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
        if (r && !r.ok) { const sm = b.querySelector('small'); sm.textContent = r.error || L('열 수 없습니다.', 'Cannot open.'); clearTimeout(msgT); msgT = setTimeout(() => { sm.textContent = L('은하 작전도 — 함대 명령·작전 회의', 'Galactic map — fleet orders, war council'); }, 5000); }
      };
      sd.prepend(b);
    } else if (sd.firstElementChild !== b) sd.prepend(b);
  }
  function boot() {
    const sd = document.getElementById('side'); if (!sd) return;
    new MutationObserver(() => { const b = document.getElementById('gxBtn'); if (!b || sd.firstElementChild !== b) side(); }).observe(sd, { childList: true });
    side();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
