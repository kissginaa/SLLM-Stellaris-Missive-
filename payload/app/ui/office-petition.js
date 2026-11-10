// 집무실 「시민 청원」 화면(2026-10-19). 앱: src/features/petition-app.ts, 규칙: src/petition.ts.
// office.html 은 이 파일·css 만 더하고, 아이콘(「국정」 줄 「정책」 옆)·빈 칸(#petition)·그리기는 모두 여기서 한다(집무실 다른 작업과 파일 충돌을 줄이려고).
// 언어 팩 규칙: 문구는 L('한국어', 'English')(SLLMI18n.pick)으로만.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const btn = (cls, text, fn) => { const b = h('button', cls, text); b.type = 'button'; b.onclick = fn; return b; };
  const RES = { energy: ['에너지', 'Energy'], minerals: ['광물', 'Minerals'], food: ['식량', 'Food'], consumer_goods: ['소비재', 'Consumer Goods'] };
  const STATE = { accepted: ['수락', 'Accepted'], declined: ['거절', 'Declined'], expired: ['답하지 않음', 'Unanswered'], done: ['과제 완수', 'Fulfilled'], failed: ['기한 넘김', 'Deadline missed'] };
  let S = null, err = '', busy = false;
  const show = (id) => { for (const v of document.querySelectorAll('.view')) v.classList.toggle('on', v.id === id); };
  function badge() { const n = $('nPetition'); if (!n) return; const c = (S && S.unread) || 0; n.textContent = c > 9 ? '9+' : String(c); n.classList.toggle('show', c > 0); }
  async function load() { try { S = await window.sllm.petitionState(); } catch (e) { S = null; } badge(); draw(); }
  async function run(fn) { if (busy) return; busy = true; err = ''; draw(); try { const r = await fn(); if (r && r.state) S = r.state; if (r && !r.ok) err = r.error || ''; } catch (e) { err = String(e); } busy = false; badge(); draw(); }
  function draw() {
    const root = $('petRoot'); if (!root || !$('petition').classList.contains('on')) return; root.textContent = ''; root.dataset.i18nSkip = '';
    const wrap = h('div', 'pet-main'); root.append(wrap);
    if (!S || !S.sid) { wrap.append(h('p', 'pet-empty', L('세이브를 불러오면 행성 주민들의 청원이 이곳에 옵니다.', 'Load a save and petitions from your planets will arrive here.'))); return; }
    if (err) wrap.append(h('div', 'pet-err', err));
    { // 2026-10-31: 저절로 오지 않음 — 누를 때 한 통(답하지 않은 청원 최대 S.max 통)
      const box = h('div', 'pet-new'), can = S.canFetch !== false; box.append(h('b', '', L('시민 청원 받기', 'Receive a petition')), h('span', '', can ? L('사정이 어려운 행성의 주민들이 청원서를 올립니다. 그 행성의 지금 사정을 게임에서 읽어 옵니다(게임이 켜져 있어야 함).', 'Citizens of a struggling planet send you a petition, based on that planet\'s current state in the game (the game must be running).') : L(`답하지 않은 청원이 ${S.max || 3}통 있습니다. 먼저 답해 주세요.`, `You have ${S.max || 3} unanswered petitions. Answer them first.`)));
      const b = btn('pet-btn', busy ? L('받는 중…', 'Receiving…') : L('시민 청원 받기', 'Receive a petition'), () => run(() => window.sllm.petitionFetch())); b.disabled = busy || !can; box.append(b); wrap.append(box);
    }
    if (!S.open.length && !(S.working || []).length) wrap.append(h('p', 'pet-empty', L('지금 기다리는 청원이 없습니다. 위의 「시민 청원 받기」를 누르면 한 통이 옵니다.', 'No petitions are waiting. Press "Receive a petition" above to get one.')));
    for (const p of S.open) {
      const c = h('article', 'pet-card');
      const hd = h('div', 'pet-hd'); hd.append(h('span', 'pet-planet', p.planet), h('span', 'pet-topic', p.topic), h('span', 'pet-date', p.date)); c.append(hd);
      c.append(h('h4', '', p.title), h('p', 'pet-text', p.text));
      const terms = h('div', 'pet-terms');
      if (p.task) { // 건설 과제 청원(아주 가끔)
        c.classList.add('task');
        terms.append(h('span', 'ok', L(`수락: 과제 「${p.topic}」 — 2년 안에 이 행성에 그런 건물을 하나 더 지으면 → 이 행성 ${p.eff} (2년). 자원은 들지 않습니다.`, `Accept: task "${p.topic}" — build one more such building on this planet within 2 years → this planet ${p.eff} (2 years). No resources spent.`)));
        terms.append(h('span', 'no', L('거절하거나 기한을 넘기면: 이 행성 인구 행복 −2% (1년)', 'Refuse or miss the deadline: this planet pop happiness −2% (1 year)')));
      } else {
        terms.append(h('span', 'ok', L(`수락: ${RES[p.res] ? L(RES[p.res][0], RES[p.res][1]) : p.res} ${p.amt} 지출 → 이 행성 ${p.eff} (2년)`, `Accept: spend ${p.amt} ${RES[p.res] ? L(RES[p.res][0], RES[p.res][1]) : p.res} → this planet ${p.eff} (2 years)`)));
        terms.append(h('span', 'no', L('거절: 이 행성 인구 행복 −2% (1년)', 'Decline: this planet pop happiness −2% (1 year)')));
      }
      c.append(terms);
      const row = h('div', 'pet-row');
      const a = btn('pet-btn yes', L('받아들인다', 'Grant'), () => run(() => window.sllm.petitionDecide(p.id, true)));
      const d = btn('pet-btn no', L('거절한다', 'Refuse'), () => run(() => window.sllm.petitionDecide(p.id, false)));
      a.disabled = d.disabled = busy; row.append(a, d); c.append(row); wrap.append(c);
    }
    // 진행 중인 건설 과제: 3개월마다 앱이 확인하고, 「지금 확인」으로 바로 볼 수도 있다
    if ((S.working || []).length) {
      wrap.append(h('h5', 'pet-hh', L('진행 중인 청원 과제', 'Petition tasks in progress')));
      for (const p of S.working) {
        const c = h('article', 'pet-card task working');
        const hd = h('div', 'pet-hd'); hd.append(h('span', 'pet-planet', p.planet), h('span', 'pet-topic', p.topic), h('span', 'pet-date', L(`기한 ${p.until}`, `Due ${p.until}`))); c.append(hd);
        c.append(h('p', 'pet-text', L(`이 행성에 건물을 하나 더 지으면 주민들이 약속을 기억합니다 → ${p.eff} (2년).`, `Build one more such building on this planet and the citizens will remember → ${p.eff} (2 years).`)));
        const row = h('div', 'pet-row'); const k = btn('pet-btn', busy ? L('확인 중…', 'Checking…') : L('지금 확인', 'Check now'), () => run(async () => { const r = await window.sllm.petitionCheck(p.id); if (r && r.note) err = r.note; return r; })); k.disabled = busy; row.append(k); c.append(row); wrap.append(c);
      }
    }
    if (S.history.length) {
      wrap.append(h('h5', 'pet-hh', L('지난 청원', 'Past petitions')));
      const ol = h('ol', 'pet-hist');
      for (const p of S.history) { const li = h('li', 'st-' + p.state); li.append(h('b', '', p.decided || p.date), document.createTextNode(` ${p.planet} · ${p.topic} — `), h('span', '', STATE[p.state] ? L(STATE[p.state][0], STATE[p.state][1]) : p.state)); ol.append(li); }
      wrap.append(ol);
    }
  }
  function build() {
    const pol = document.querySelector('[data-app="policy"]'); const holo = $('policy') && $('policy').parentElement;
    if (!pol || !holo || $('petition')) return;
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'petCall';
    b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6h24v36H12z"/><path d="M17 14h14M17 20h14M17 26h9"/><path d="M27 34l3 3 6-7"/></svg>';
    b.append(h('span', '', L('시민 청원', 'Petitions')), Object.assign(h('b', 'n'), { id: 'nPetition' }));
    b.onclick = () => { show('petition'); load(); };
    pol.after(b);
    const sec = h('section', 'view app'); sec.id = 'petition'; sec.setAttribute('aria-label', L('시민 청원', 'Petitions'));
    const hd = h('div', 'apph'); const back = h('button', 'back', '‹ ' + L('바탕화면', 'Desktop')); back.type = 'button'; back.onclick = () => show('desktop');
    hd.append(back, h('h3', '', L('시민 청원', 'Citizens\' Petitions'))); const body = h('div', 'appb'); body.id = 'petRoot';
    sec.append(hd, body); holo.append(sec);
  }
  document.addEventListener('DOMContentLoaded', () => {
    build(); load(); setInterval(load, 60000);
    if (window.sllm.onOfficeGo) window.sllm.onOfficeGo((v) => { if (v === 'petition') { show('petition'); load(); } }); // 건설 과제 완수 알림 → 집무실 → 바로 청원
    document.addEventListener('sllm-language', () => { const b = $('petCall'); if (b) b.querySelector('span').textContent = L('시민 청원', 'Petitions'); draw(); });
  });
  window.SLLMPetition = { load };
})();
