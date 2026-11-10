// 집무실 바탕화면의 「행성 총독」 칸(2026-10-23 사용자 확정). 총독회의·행성 기념일·시위·국민청원을 한 묶음으로 모은다.
// 다른 스크립트가 아이콘을 다 만든 뒤(가장 늦은 서재 140ms) 그 아이콘들을 이 칸으로 옮긴다. 행성 기념일은 「국가 행사날」 안에서 빼서 따로 연다(planet-holidays.js).
// 옛 1:1 총독 대화·새해 총독 보고는 이 패치에서 뗐다(행성 문제 보고는 비서 업무 보고로). 문구는 L(한, 영)만.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const show = (id) => { if (!document.getElementById(id)) return; for (const v of document.querySelectorAll('.view')) v.classList.toggle('on', v.id === id); }; // 없는 화면으로 가면 모든 화면이 꺼져 빈 홀로그램만 남는다(2026-10-29 테스터)
  const ORDER = ['gcCall', 'phCall', 'prtCall', 'petCall'];
  function holidayView(holo) {
    if ($('planetHol')) return;
    const sec = h('section', 'view app'); sec.id = 'planetHol'; sec.setAttribute('aria-label', L('행성 기념일', 'Planet holidays'));
    const hd = h('div', 'apph'); const back = h('button', 'back', '‹ ' + L('바탕화면', 'Desktop')); back.type = 'button'; back.onclick = () => show('desktop');
    hd.append(back, h('h3', '', L('행성 기념일', 'Planet holidays'))); const body = h('div', 'appb'); body.id = 'phRoot'; body.style.cssText = 'display:block;overflow-y:auto;padding:12px 16px';
    sec.append(hd, body); holo.append(sec);
    if (!$('phViewCss')) { const st = h('style'); st.id = 'phViewCss'; st.textContent = '#phRoot .ph-box{margin:0;padding:0;border:0;background:none}#phRoot .ph-box>h3{display:none}#phRoot button{border:1px solid var(--hi);background:color-mix(in srgb,var(--hi) 14%,transparent);color:var(--text);border-radius:4px;padding:5px 12px;cursor:pointer;margin-top:4px}#phRoot button:disabled{opacity:.45;cursor:default}'; document.head.append(st); } // 「국가 행사날」 밖에서도 홀로그램 단추 모양
  }
  // 행성 맡기기 화면(2026-11-03): 스크립트는 처음 누를 때 불러온다(office.html 은 그대로)
  let gpLoad = null;
  const loadGp = () => gpLoad || (gpLoad = new Promise((res) => { if (window.mountGovPolicy) return res(); const s = document.createElement('script'); s.src = 'office-govpolicy.js'; s.onload = s.onerror = () => res(); document.head.append(s); }));
  function appView(holo, id, title, bodyId) {
    if ($(id)) return; const sec = h('section', 'view app'); sec.id = id; sec.setAttribute('aria-label', title);
    const hd = h('div', 'apph'), back = h('button', 'back', '‹ ' + L('바탕화면', 'Desktop')); back.type = 'button'; back.onclick = () => show('desktop');
    hd.append(back, h('h3', '', title)); const body = h('div', 'appb'); body.id = bodyId; body.style.cssText = 'display:block;overflow-y:auto'; sec.append(hd, body); holo.append(sec);
  }
  function build() {
    const icons = $('icons'), holo = $('policy') && $('policy').parentElement; if (!icons || !holo || $('govGrp')) return;
    const state = $('secCall') && $('secCall').closest('.grp'); // 「국정」 칸 바로 뒤에 둔다
    const grp = h('div', 'grp'); grp.id = 'govGrp'; const title = h('h2', '', L('행성 총독', 'Planetary governors')); title.setAttribute('data-i18n-skip', ''); const row = h('div', 'row'); grp.append(title, row);
    if (state) state.after(grp); else icons.append(grp);
    if (window.mountPlanetHolidays && window.sllm.holidaysState) {
      const b = h('button', 'ic'); b.type = 'button'; b.id = 'phCall';
      b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="26" r="11"/><path d="M13 26h22M24 15c3.4 3 5 6.8 5 11s-1.6 8-5 11c-3.4-3-5-6.8-5-11s1.6-8 5-11z"/><path d="M33 8l1.5 3 3 .5-2.2 2 .6 3-2.9-1.5-2.9 1.5.6-3-2.2-2 3-.5z"/></svg>';
      b.append(h('span', '', L('행성 기념일', 'Planet holidays')));
      b.onclick = () => { holidayView(holo); show('planetHol'); const r = $('phRoot'); r.textContent = ''; void window.mountPlanetHolidays(r); };
      row.append(b);
    }
    if (window.sllm.govPolState) { // 총독에게 행성 맡기기(2026-11-03, ui/office-govpolicy.js)
      const b = h('button', 'ic'); b.type = 'button'; b.id = 'gpCall';
      b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="20" cy="20" r="10"/><path d="M10 20h20M20 10c2.8 2.6 4 6 4 10s-1.2 7.4-4 10"/><path d="M28 34l5-5 7 7-5 5zM33 29l3-3"/><path d="M8 40h16"/></svg>';
      b.append(h('span', '', L('행성 맡기기', 'Entrust planets')));
      b.onclick = async () => { await loadGp(); appView(holo, 'govPol', L('행성 맡기기', 'Entrust planets'), 'gpBody'); show('govPol'); if (window.mountGovPolicy) void window.mountGovPolicy($('gpBody')); };
      row.append(b);
    }
    for (const id of ORDER) { const e = $(id); if (e) row.append(e); }
    if (!row.children.length) grp.remove();
  }
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(build, 300);
    if (window.sllm.onOfficeGo) window.sllm.onOfficeGo((v) => { if (v === 'planetHol') { build(); const b = $('phCall'); if (b) b.click(); } }); // 행성 기념일 알림 → 바로 그 화면 // 아이콘을 만드는 스크립트들(30~140ms) 뒤
    document.addEventListener('sllm-language', () => { const g = $('govGrp'); if (g) g.querySelector('h2').textContent = L('행성 총독', 'Planetary governors'); const b = $('phCall'); if (b) b.querySelector('span').textContent = L('행성 기념일', 'Planet holidays'); const g2 = $('gpCall'); if (g2) g2.querySelector('span').textContent = L('행성 맡기기', 'Entrust planets'); });
  });
})();
