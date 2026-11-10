// 시나리오 잠금(화면 쪽, 2026-11-06 사용자: 「잠긴 기능은 아이콘이 아예 사라지게」 · 「국내 정치는 처음에 켤지 고르게 — 기본·권장 아니오」).
// 앱: src/features/scenario-locks-app.ts(scnLocks·scnPolitics). 집무실 아이콘은 여러 스크립트가 늦게 만들므로 #icons 를 지켜보며 계속 숨긴다.
// 시나리오가 아니면 아무것도 하지 않는다(숨겼던 것은 되살림). 문구는 L(한, 영)만 — 언어 팩 호환.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  let hide = [], asked = false;
  // 다른 스크립트가 아이콘의 style.display 를 되돌려 놓는 일이 있어(행성 총독 칸의 의회·로비·특별사면이 그대로 보이던 원인, 2026-11-08)
  // 숨김은 !important 스타일 한 장으로 건다 — 무엇이 display 를 바꿔도 이긴다.
  const sheet = () => { let st = document.getElementById('scnLockCss'); if (!st) { st = document.createElement('style'); st.id = 'scnLockCss'; document.head.append(st); } return st; };
  const shown = (el) => el.style.display !== 'none' && getComputedStyle(el).display !== 'none';
  const apply = () => {
    const css = hide.length ? hide.join(',') + '{display:none!important}' : '';
    const st = sheet(); if (st.textContent !== css) st.textContent = css;
    // 아이콘이 다 숨겨진 칸(제목만 남은 칸)도 숨긴다
    for (const g of document.querySelectorAll('#icons .grp')) {
      const row = g.querySelector('.row'); if (!row) continue;
      const any = [...row.children].some(shown);
      if (!any && row.children.length && hide.length) g.classList.add('scnEmpty');
      else g.classList.remove('scnEmpty');
    }
    let gs = document.getElementById('scnLockGrpCss'); if (!gs) { gs = document.createElement('style'); gs.id = 'scnLockGrpCss'; gs.textContent = '#icons .grp.scnEmpty{display:none!important}'; document.head.append(gs); }
  };
  function askPolitics() {
    if (asked || document.getElementById('scnPolAsk')) return; asked = true;
    const ov = h('div'); ov.id = 'scnPolAsk'; ov.style.cssText = 'position:fixed;inset:0;z-index:9500;background:#000c;display:flex;align-items:center;justify-content:center';
    const box = h('div'); box.style.cssText = 'width:min(560px,92vw);padding:18px 20px;background:#14161c;color:#e8e4d8;border:1px solid #b8975a;font-size:13.5px;line-height:1.55;display:flex;flex-direction:column;gap:10px';
    const t = h('h3', '', L('국내 정치를 켤까요?', 'Enable domestic politics?')); t.style.cssText = 'margin:0;color:#e0c48a;font-size:17px';
    box.append(t,
      h('div', '', L('이 시나리오는 세 나라의 대립과 귀족들의 충성에 집중하도록 만들어졌습니다. 국내 정치를 끄면 바깥 판에만 집중할 수 있습니다. 꺼지는 것: 행성 총독 칸 전부(여론조사·의회·로비·예산 회의·특별사면·총독회의·시위·청원·행성 기념일·행성 맡기기), 민심, 언론사 인터뷰, 연설, 국가 행사날, 국민투표, 궁정 음모, 비상대권 등.',
        'This scenario focuses on the three-way rivalry and the loyalty of the nobles. With domestic politics off, you can focus on the wider game. Turned off: the whole Planetary Governor group (polls, parliament, lobbying, budget meeting, special amnesty, governors\' council, protests, petitions, planet holidays, planet mandates), public mood, press interviews, speeches, national events, referendums, court intrigue, emergency powers, etc.')),
      h('div', '', L('켜면 하드코어입니다. 우리 나라 안에서도 정치판이 벌어집니다. 장관 의제, 국내 지도자 서신, 연애, 작전지휘실은 어느 쪽이든 그대로 쓸 수 있습니다.',
        'Turning it on is hardcore: politics will also unfold inside your own nation. Cabinet agendas, letters with your own leaders, romance and the war room stay available either way.')),
      h('small', '', L('한 번 고르면 이 판에서는 바꿀 수 없습니다.', 'You cannot change this later in this game.')));
    const row = h('div'); row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-top:6px';
    const btn = (txt, primary) => { const b = h('button', '', txt); b.type = 'button'; b.style.cssText = `padding:6px 14px;cursor:pointer;font-size:13px;color:#e8e4d8;border:1px solid #b8975a;background:${primary ? '#b8975a66' : '#b8975a18'}`; return b; };
    const no = btn(L('아니오 (권장)', 'No (recommended)'), true), yes = btn(L('예, 국내 정치도 켭니다', 'Yes, enable domestic politics'), false);
    const pick = async (on) => { no.disabled = yes.disabled = true; try { const r = await window.sllm.scnPolitics(on); if (r && r.ok) { hide = r.hide || []; apply(); } } catch (e) { /* 다음에 다시 묻는다 */ asked = false; } ov.remove(); };
    no.onclick = () => { void pick(false); }; yes.onclick = () => { void pick(true); };
    row.append(yes, no); box.append(row); ov.append(box);
    ov.onclick = (e) => { if (e.target === ov) void pick(false); }; // 그냥 닫으면 아니오(기본)
    document.body.append(ov);
  }
  async function sync() {
    if (!window.sllm || !window.sllm.scnLocks) return;
    let r = null; try { r = await window.sllm.scnLocks(); } catch (e) { r = null; }
    hide = r && r.on ? (r.hide || []) : [];
    apply();
    if (r && r.on && r.ask) askPolitics();
  }
  document.addEventListener('DOMContentLoaded', () => {
    void sync();
    setTimeout(() => { void sync(); }, 600); // 아이콘을 만드는 스크립트들(30~450ms) 뒤
    setInterval(() => { void sync(); }, 30000); // 세이브를 바꾸면 따라간다
    new MutationObserver(() => { if (hide.length) apply(); }).observe(document.body, { childList: true, subtree: true });
  });
})();
