// 회랑 정보국(시나리오 전용 첩보, 2026-11-07 사용자: 「이 시나리오만의 첩보 — 첩보 지도도 따로」).
// 집무실 「회랑의 삼파전」 칸(office-nobles.js 의 #nbGrp)에 아이콘을 붙이고, 누르면 첩보 지도(은하 지도 창 ?mode=intel)를 연다. 회랑 자리를 맡은 판에서만(scnIntel().on).
// 앱: src/features/scenario-intel-app.ts · 지도: ui/scenario-intel.js. 문구는 L(한, 영)만 — 언어 팩 호환.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  async function attach() {
    const g = $('nbGrp'), row = g && g.querySelector('.row'); if (!row) return;
    let on = false; try { const r = await window.sllm.scnIntel(); on = !!(r && r.ok && r.on); } catch (e) { on = false; }
    const old = $('inCall'); if (!on) { if (old) old.remove(); return; } if (old) return;
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'inCall';
    b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="7"/><path d="M24 4v8M24 36v8M4 24h8M36 24h8"/><circle cx="24" cy="24" r="1.5"/></svg>';
    b.append(h('span', '', L('회랑 정보국', 'Intelligence')));
    b.onclick = async () => { let r = null; try { r = await window.sllm.scnIntelOpen(); } catch (e) { r = { ok: false, error: String(e) }; } if (r && !r.ok && r.error) alert(r.error); };
    row.append(b);
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.scnIntel) return;
    const icons = $('icons'); if (icons) new MutationObserver(() => { if ($('nbGrp') && !$('inCall')) void attach(); }).observe(icons, { childList: true });
    setTimeout(() => { void attach(); }, 1000);
    setInterval(() => { void attach(); }, 30000);
    document.addEventListener('sllm-language', () => { const s = document.querySelector('#inCall span'); if (s) s.textContent = L('회랑 정보국', 'Intelligence'); });
  });
})();
