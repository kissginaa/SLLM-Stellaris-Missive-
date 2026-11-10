// 집무실 「외교 거래」 화면(2026-10-26, 다음 업데이트). 앱: src/features/deals-app.ts(dealList·dealOpen(tid)·dealCta), 거래판 그리기: deal-ui.js(SLLMDeal.open({ host, tid })).
// 대사관(office-embassy.js)과 같은 틀: 왼쪽 = 통신 중인 일반 제국 목록(+동맹의 참전 요청), 오른쪽 = 고른 제국과의 거래판.
// office.html 은 이 파일·css·deal-ui.js 만 더하고, 아이콘(「대사관」 다음)·빈 칸(#deals)·그리기는 모두 여기서 한다.
// 언어 팩 규칙: 문구는 L('한국어', 'English')(SLLMI18n.pick)으로만.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const btn = (cls, text, fn) => { const b = h('button', cls, text); b.type = 'button'; b.onclick = fn; return b; };
  const show = (id) => { if (!document.getElementById(id)) return; for (const v of document.querySelectorAll('.view')) v.classList.toggle('on', v.id === id); }; // 없는 화면으로 가면 모든 화면이 꺼져 빈 홀로그램만 남는다(2026-10-29 테스터)
  let S = null, cur = 0, busy = '', msg = '', side = null, main = null;
  const sgn = (n) => (n > 0 ? '+' : '') + n;
  async function load() { try { S = await window.sllm.dealList(); } catch (e) { S = null; } drawSide(); }
  async function run(kind, fn) {
    if (busy) return; busy = kind; msg = ''; drawSide();
    try { const r = await fn(); if (r && r.text) msg = r.text; else if (r && r.error) msg = r.error; } catch (e) { msg = String(e && e.message || e); }
    busy = ''; await load();
  }
  function pick(tid) { cur = tid; drawSide(); drawMain(); }
  function drawMain() {
    if (!main) return;
    if (!cur || !S || !S.items.some((c) => c.tid === cur)) {
      main.replaceChildren(h('p', 'emb-empty', L('왼쪽에서 제국을 고르세요. 자원·국경 개방·경쟁 관계 해제·불가침·참전을 묶어 제안하면, 받아들일 확률이 바로 보이고 결정은 그 확률대로 정해집니다. 첩보로 약점(갈고리)을 쥔 제국에는 확률을 크게 올릴 수 있습니다.', 'Pick an empire on the left. Bundle resources, open borders, ending a rivalry, non-aggression or joining a war into one offer; the chance they accept shows at once and the outcome follows it. A hook from our spies raises the chance a lot.')));
      return;
    }
    if (window.SLLMDeal) void window.SLLMDeal.open({ host: main, tid: cur, onChange: load });
  }
  function drawSide() {
    if (!side) return; side.textContent = ''; side.dataset.i18nSkip = '';
    const sh = h('div', 'emb-sh'); sh.append(h('b', '', L('통신 중인 제국', 'Empires in contact')));
    const rb = btn('emb-btn sm', busy === 'list' ? L('갱신 중…', 'Refreshing…') : L('목록 갱신', 'Refresh list'), () => run('list', () => window.sllm.embassyContacts()));
    rb.disabled = !!busy || !S || !S.running; sh.append(rb); side.append(sh);
    if (!S || !S.ok) { side.append(h('p', 'emb-empty', L('세이브를 불러오면 거래할 수 있는 제국이 이곳에 나옵니다.', 'Load a save and the empires you can deal with appear here.'))); return; }
    if (msg) side.append(h('div', 'emb-err dlo-msg', msg));
    // 동맹의 참전 요청(두 달 안에 답하지 않으면 거절)
    for (const c of S.cta) {
      const box = h('div', 'emb-chg bad dlo-cta');
      box.append(h('b', '', L(`${c.name}의 참전 요청`, `${c.name} calls us to arms`)), h('small', '', L(`${c.asked}에 요청 · 두 달 안에 답하지 않으면 거절`, `Asked on ${c.asked} · no answer within two months counts as a refusal`)));
      const row = h('div', 'dlo-row');
      const yes = btn('emb-btn sm', L('참전', 'Join'), () => run('cta', () => window.sllm.dealCta(c.tid, true)));
      const no = btn('emb-btn sm dlo-no', L('거절(호감 -30·신문)', 'Refuse (opinion -30, papers)'), () => run('cta', () => window.sllm.dealCta(c.tid, false)));
      const aid = btn('emb-btn sm', L('물자 지원으로 답하기(호감 -10)', 'Answer with supplies (opinion -10)'), () => run('cta', () => window.sllm.dealCtaAid(c.tid))); // 2026-10-28 하츠 참고
      aid.title = L('참전하지 않고 에너지를 매달 보냅니다(우리 월수입의 5%, 2년). 거절(-30)보다 감점이 작습니다.', 'Send energy every month instead of troops (5% of our income, 2 years). A smaller penalty than refusing (-30).');
      yes.disabled = no.disabled = aid.disabled = !!busy || !S.running; row.append(yes, aid, no); box.append(row); side.append(box);
    }
    if (!S.items.length) side.append(h('p', 'emb-empty', L('통신 중인 일반 제국이 없습니다. 「목록 갱신」을 눌러 주세요(게임이 켜져 있어야 합니다).', 'No regular empires in contact. Press "Refresh list" (the game must be running).')));
    for (const c of S.items) {
      const it = h('button', 'emb-item dlo-item' + (c.tid === cur ? ' on' : '')); it.type = 'button'; it.onclick = () => pick(c.tid);
      const top = h('span', 'dlo-top'); top.append(h('span', 'nm', c.name), h('span', 'lv ' + (c.score >= 25 ? 'lv-calm' : c.score <= -25 ? 'lv-danger' : 'none'), L('호감 ', 'Opinion ') + sgn(c.score))); it.append(top);
      const tags = [];
      if (c.war) tags.push(['bad', L('전쟁 중', 'At war')]);
      if (c.rival) tags.push(['warn', L('경쟁국', 'Rival')]);
      if (c.hook) tags.push(['gold', L('갈고리', 'Hook')]);
      if (c.owed) tags.push(['bad', L('우리가 빚짐', 'We owe them')]);
      if (c.deals) tags.push(['', L(`약속 ${c.deals}`, `${c.deals} deal${c.deals > 1 ? 's' : ''}`)]);
      if (tags.length) { const tg = h('span', 'dlo-tags'); for (const [k, t] of tags) tg.append(h('i', k, t)); it.append(tg); }
      it.title = c.hook ? L('첩보로 알아낸 약점이 있습니다. 거래에서 한 번 쓰면 수락 확률 +30%p.', 'Our spies found leverage. Using it once in a deal adds 30 points to the chance.') : '';
      side.append(it);
    }
  }
  function build() {
    const after = $('embCall'); const holo = $('policy') && $('policy').parentElement;
    if (!after || !holo || $('deals')) return false;
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'dealCall';
    b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M24 7v34M15 41h18"/><path d="M8 13h32"/><path d="M12 13l-6 13a6 6 0 0012 0zM36 13l-6 13a6 6 0 0012 0z"/></svg>';
    b.append(h('span', '', L('외교 거래', 'Diplomatic Deals')));
    b.onclick = () => { show('deals'); load().then(drawMain); };
    after.after(b);
    const sec = h('section', 'view app'); sec.id = 'deals'; sec.setAttribute('aria-label', L('외교 거래', 'Diplomatic Deals'));
    const hd = h('div', 'apph'); const back = h('button', 'back', '‹ ' + L('바탕화면', 'Desktop')); back.type = 'button'; back.onclick = () => show('desktop');
    hd.append(back, h('h3', '', L('외교 거래', 'Diplomatic Deals')));
    const body = h('div', 'appb'); body.id = 'dealRoot';
    const wrap = h('div', 'emb-main'); side = h('div', 'emb-side'); main = h('div', 'emb-body dlo-main'); wrap.append(side, main); body.append(wrap);
    sec.append(hd, body); holo.append(sec);
    return true;
  }
  document.addEventListener('DOMContentLoaded', () => {
    // 대사관 아이콘 뒤에 붙인다(대사관 화면이 먼저 아이콘을 만들 때까지 잠깐 기다림).
    let tries = 0; const t = setInterval(() => { if (build() || ++tries > 30) clearInterval(t); }, 100);
    if (window.sllm.onOfficeGo) window.sllm.onOfficeGo((v) => { if (v === 'deals') { show('deals'); load().then(drawMain); } });
    document.addEventListener('sllm-language', () => {
      const b = $('dealCall'); if (b) b.querySelector('span').textContent = L('외교 거래', 'Diplomatic Deals');
      const s = $('deals'); if (s) { s.querySelector('.apph h3').textContent = L('외교 거래', 'Diplomatic Deals'); s.querySelector('.apph .back').textContent = '‹ ' + L('바탕화면', 'Desktop'); }
      drawSide(); drawMain();
    });
  });
  window.SLLMOfficeDeals = { load };
})();
