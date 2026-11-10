// 집무실 「총독회의」 아이콘(2026-10-23 초안). 누르면 총독 홀로그램 회의실(ui/gov-council.html)이 집무실 자리에 열린다. 앱: src/features/gc-app.ts.
// 격년 11월 정기회의가 열릴 때는 아이콘에 「!」 표시. 군체·기계 제국에서는 숨긴다(정치 체제 회의가 아니므로). 문구는 L(한, 영)만(언어 팩 호환).
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const name = () => L('총독회의', 'Governors\' council'), tip = () => L('행성 총독들을 홀로그램으로 불러 행성 현안을 논의합니다(2년마다 11월 정기회의)', 'Call your planetary governors by hologram to debate planet issues (regular council every other November)');
  async function badge() { const n = $('nGc'); if (!n || !window.sllm.gcState) return; try { const s = await window.sllm.gcState(); const on = !!(s && s.due && s.due.state === 'due'); n.textContent = on ? '!' : ''; n.classList.toggle('show', on); } catch (e) { /* 무시 */ } }
  function build() {
    const after = $('socCall') || $('iscCall') || $('emCall') || $('prtCall');
    if (!after || $('gcCall')) return;
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'gcCall';
    b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="30" r="7"/><path d="M24 23V12"/><circle cx="24" cy="9" r="3"/><circle cx="9" cy="20" r="3"/><circle cx="39" cy="20" r="3"/><path d="M11 22l7 5M37 22l-7 5"/><path d="M14 42h20"/></svg>';
    b.append(h('span', '', name()), Object.assign(h('b', 'n'), { id: 'nGc' })); b.title = tip();
    b.onclick = async () => { try { const r = await window.sllm.gcOpen(); if (r && !r.ok && r.error) { const t = h('div', 'cab-msg', r.error); document.body.append(t); setTimeout(() => t.remove(), 4000); } } catch (e) { /* 무시 */ } };
    after.after(b); badge();
  }
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(build, 80); // 사교회 아이콘(60ms) 뒤
    if (window.sllm.onGcState) window.sllm.onGcState(() => badge());
    if (window.sllm.onOfficeGo) window.sllm.onOfficeGo((v) => { if (v === 'gc') { build(); window.sllm.gcOpen(); } });
    setInterval(() => { if (!document.hidden) badge(); }, 60000);
    document.addEventListener('sllm-language', () => { const b = $('gcCall'); if (b) { b.querySelector('span').textContent = name(); b.title = tip(); } });
  });
})();
