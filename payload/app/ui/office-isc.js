// 집무실 「성간 임시회의」 아이콘(2026-10-23 초안). 누르면 통신 회의실(ui/isc-room.html)이 집무실 자리에 열린다. 앱: src/features/isc-app.ts.
// 플레이어만 소집(46): 알람·AI 초대 없음. office.html 은 이 파일만 더한다. 문구는 L(한, 영)만(언어 팩 호환).
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const name = () => L('성간 임시회의', 'Interstellar summit'), tip = () => L('다른 제국 통치자들을 통신 회의에 초대합니다', 'Invite other empires\' rulers to a comms summit');
  function build() {
    const after = $('emCall') || $('prtCall') || $('petCall') || document.querySelector('[data-app="policy"]');
    if (!after || $('iscCall')) return;
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'iscCall';
    b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="5"/><circle cx="9" cy="14" r="3.5"/><circle cx="39" cy="14" r="3.5"/><circle cx="9" cy="36" r="3.5"/><circle cx="39" cy="36" r="3.5"/><path d="M12 16l8 5M36 16l-8 5M12 34l8-5M36 34l-8-5"/></svg>';
    b.append(h('span', '', name())); b.title = tip();
    b.onclick = async () => { try { const r = await window.sllm.iscOpen(); if (r && !r.ok && r.error) { const t = h('div', 'cab-msg', r.error); document.body.append(t); setTimeout(() => t.remove(), 4000); } } catch (e) { /* 무시 */ } };
    after.after(b);
  }
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(build, 40); // 긴급회의 아이콘(30ms)이 먼저 생긴 뒤 그 옆에
    document.addEventListener('sllm-language', () => { const b = $('iscCall'); if (b) { b.querySelector('span').textContent = name(); b.title = tip(); } });
  });
})();
