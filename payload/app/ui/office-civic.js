// 집무실 「여론조사」·「특별사면」(2026-11-03 시민 정치). 앱: src/features/civic-app.ts, 규칙: src/civic.ts. 국민투표는 정책 화면(office-policy.js) 안에 있다.
// office.html 은 이 파일·css 만 더하고, 아이콘(「국정」 줄 = 시민 청원 옆 / 「행성 총독」 칸 = 특별사면)·화면은 모두 여기서 만든다(다른 작업과 충돌을 줄이려고).
// 단일 의식(군체·기계) 제국에서는 아이콘을 숨긴다. 언어 팩 규칙: 문구는 L('한국어', 'English')(SLLMI18n.pick)으로만.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const T = (s) => (window.SLLMI18n && window.SLLMI18n.t ? window.SLLMI18n.t(s) : s); // 신문사 기본 이름(성간일보 등)도 화면 언어로
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const btn = (cls, text, fn, dis) => { const b = h('button', cls, text); b.type = 'button'; b.onclick = fn; b.disabled = !!dis; return b; };
  const show = (id) => { if (!document.getElementById(id)) return; for (const v of document.querySelectorAll('.view')) v.classList.toggle('on', v.id === id); };
  let S = null, msg = '', err = '', busy = false;

  function view(id, title, rootId) {
    const holo = $('policy') && $('policy').parentElement; if (!holo || $(id)) return;
    const sec = h('section', 'view app'); sec.id = id; sec.setAttribute('aria-label', title);
    const hd = h('div', 'apph'); const back = h('button', 'back', '‹ ' + L('바탕화면', 'Desktop')); back.type = 'button'; back.onclick = () => show('desktop');
    hd.append(back, h('h3', '', title)); const body = h('div', 'appb'); body.id = rootId;
    sec.append(hd, body); holo.append(sec);
  }
  function icon(id, svg, label, open) {
    const b = h('button', 'ic'); b.type = 'button'; b.id = id; b.innerHTML = svg; b.append(h('span', '', label)); b.onclick = open; return b;
  }
  const POLL_SVG = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 40h32"/><path d="M13 40V26M21 40V16M29 40V22M37 40V10"/><path d="M10 18l9-7 8 5 11-9"/></svg>';
  const AMN_SVG = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 10v28M18 10v28M26 10v14M34 10v28M6 10h34"/><path d="M26 30c2-4 6-6 10-6"/><path d="M33 20l4 4-4 4"/></svg>';
  function build() {
    const holo = $('policy') && $('policy').parentElement; if (!holo) return;
    if (!$('pollCall')) {
      const anchor = $('petCall') || document.querySelector('[data-app="policy"]'); if (!anchor) return;
      anchor.after(icon('pollCall', POLL_SVG, L('여론조사', 'Opinion polls'), () => { show('civicPoll'); load(); }));
      view('civicPoll', L('여론조사', 'Opinion polls'), 'pollRoot');
    }
    if (!$('amnCall')) {
      const row = $('govGrp') && $('govGrp').querySelector('.row'), b = icon('amnCall', AMN_SVG, L('특별사면', 'Special pardon'), () => { msg = ''; err = ''; show('civicAmnesty'); load(); });
      if (row) row.append(b); else $('pollCall').after(b);
      view('civicAmnesty', L('특별사면', 'Special pardon'), 'amnRoot');
    }
    hideForGestalt();
  }
  function hideForGestalt() { const off = !!(S && S.regime === 'none'); for (const id of ['pollCall', 'amnCall']) { const e = $(id); if (e) e.style.display = off ? 'none' : ''; } }

  function drawPoll() {
    const r = $('pollRoot'); if (!r) return; r.textContent = '';
    const w = h('div', 'cv-main'); r.append(w);
    if (!S || !S.sid) { w.append(h('p', 'cv-empty', L('세이브를 불러오면 표시됩니다.', 'Shown once a save is loaded.'))); return; }
    const p = S.poll;
    w.append(h('p', 'cv-note', S.regime === 'sham' ? L('국영 조사 기관이 3개월마다(1·4·7·10월) 정부 지지율을 발표합니다. 실제 민심이 궁금하면 비서에게 물어보세요.', 'The state polling agency publishes government approval every three months (Jan, Apr, Jul, Oct). Ask your secretary if you want the real figure.')
      : L('신문사 세 곳이 3개월마다(1·4·7·10월) 정부 지지율을 조사합니다. 신문사 성향에 따라 조금씩 다르게 나오고, 오차범위는 ±3%p입니다.', 'Three newspapers poll government approval every three months (Jan, Apr, Jul, Oct). Results differ slightly with each paper\'s leaning; the margin of error is ±3 points.')));
    if (!p) { w.append(h('p', 'cv-empty', L('아직 조사 결과가 없습니다. 다음 조사 달을 기다려 주세요.', 'No poll yet. Wait for the next polling month.'))); return; }
    const card = h('div', 'cv-card' + (p.sham ? ' sham' : ''));
    const hd = h('div', 'cv-hd'); hd.append(h('b', '', p.sham ? L('관제 조사', 'State-run poll') : L('정부 지지율', 'Government approval')), h('span', 'cv-date', p.date)); card.append(hd);
    const big = h('div', 'cv-big'); big.append(h('b', '', p.shown + '%'), h('small', '', p.sham ? L('국영 발표', 'official figure') : L('세 신문사 평균', 'average of three papers'))); card.append(big);
    const bars = h('div', 'cv-bars');
    for (const x of p.papers) { const row = h('div', 'cv-bar'); const bar = h('i'); bar.style.width = Math.max(2, Math.min(100, x.value)) + '%'; const track = h('span', 'cv-track'); track.append(bar); row.append(h('span', 'cv-pn', T(x.name)), track, h('b', '', x.value + '%')); bars.append(row); }
    card.append(bars);
    const iss = h('div', 'cv-iss'), good = h('div', 'cv-good'), bad = h('div', 'cv-bad');
    good.append(h('b', '', L('잘하는 일', 'Doing well'))); for (const g of p.good) good.append(h('span', '', g));
    bad.append(h('b', '', L('못하는 일', 'Doing badly'))); for (const g of p.bad) bad.append(h('span', '', g));
    iss.append(good, bad); card.append(iss);
    // 정당(파벌)별 지지율(2026-11-03 여당·야당): 자유 정부의 조사에만 있다
    if (p.parties && p.parties.length) {
      const SIDE = { ruling: ['여당', 'Ruling'], coalition: ['연정', 'Coalition'], deal: ['법안 거래', 'Deal'], opposition: ['야당', 'Opposition'] };
      card.append(h('p', 'cv-hh', L('정당 지지율', 'Party support')));
      const pb = h('div', 'cv-bars');
      for (const x of p.parties) { const row = h('div', 'cv-bar'); const bar = h('i'); bar.style.width = Math.max(2, Math.min(100, x.v)) + '%'; const track = h('span', 'cv-track'); track.append(bar); const nm = SIDE[x.side] ? `${x.name} · ${L(SIDE[x.side][0], SIDE[x.side][1])}` : x.name; const pn = h('span', 'cv-pn', nm); pn.dataset.i18nSkip = ''; pn.title = nm; row.append(pn, track, h('b', '', x.v + '%')); pb.append(row); }
      card.append(pb);
    }
    w.append(card);
    if (S.history && S.history.length > 1) {
      w.append(h('p', 'cv-hh', L('지난 조사', 'Earlier polls')));
      const ol = h('ol', 'cv-hist'); for (const x of S.history) { const li = h('li'); li.append(h('span', '', x.date), h('b', '', x.shown + '%')); ol.append(li); } w.append(ol);
    }
  }
  function drawAmnesty() {
    const r = $('amnRoot'); if (!r) return; r.textContent = '';
    const w = h('div', 'cv-main'); r.append(w);
    if (!S || !S.sid) { w.append(h('p', 'cv-empty', L('세이브를 불러오면 표시됩니다.', 'Shown once a save is loaded.'))); return; }
    const A = S.amnesty;
    w.append(h('p', 'cv-note', L('국경일이나 행성 기념일이 든 달에 1년에 한 번 특별사면을 발표할 수 있습니다. 효과는 1년 동안 모든 행성에 걸립니다.', 'Once a year, in a month with a national holiday or planet holiday, you may announce a special pardon. The effect applies to all planets for a year.')));
    const st = h('div', 'cv-occ ' + (A.can ? 'ok' : 'no'));
    st.textContent = A.used ? L('올해는 이미 특별사면을 발표했습니다.', 'A special pardon has already been announced this year.')
      : A.occasion ? L(`이번 달: ${A.occasion} — 사면을 발표할 수 있습니다.`, `This month: ${A.occasion} — a pardon may be announced.`)
      : L('이번 달에는 국경일이나 행성 기념일이 없습니다.', 'There is no national or planet holiday this month.');
    w.append(st);
    if (msg) w.append(h('div', 'cv-ok', msg)); if (err) w.append(h('div', 'cv-err', err));
    const pol = h('label', 'cv-chk'); const cb = h('input'); cb.type = 'checkbox'; cb.id = 'amnPol';
    pol.append(cb, h('span', '', L('정치범 포함 (권위주의 파벌 승인도 하락, 다른 파벌 승인도 상승)', 'Include political prisoners (authoritarian faction approval falls, other factions approve)')));
    const grid = h('div', 'cv-tiers');
    for (const t of A.tiers) {
      const c = h('div', 'cv-tier'); c.append(h('b', '', t.name), h('span', '', L(`모든 행성 안정도 +${t.stab}`, `All planets +${t.stab} stability`)), h('span', 'neg', L(`범죄 +${t.crime}`, `Crime +${t.crime}`)));
      c.append(btn('cv-btn', busy ? L('발표하는 중…', 'Announcing…') : L('발표', 'Announce'), async () => {
        if (busy) return; busy = true; msg = ''; err = ''; drawAmnesty();
        try { const res = await window.sllm.civicAmnesty(t.id, cb.checked); if (res && res.state) S = res.state; if (res && res.ok) msg = res.text; else err = (res && res.error) || L('발표하지 못했습니다.', 'Could not announce it.'); }
        catch (e) { err = String(e && e.message || e); }
        busy = false; drawAmnesty(); hideForGestalt();
      }, !A.can || busy));
      grid.append(c);
    }
    w.append(pol, grid);
    if (A.last && A.last.length) {
      w.append(h('p', 'cv-hh', L('지난 사면', 'Earlier pardons')));
      const ol = h('ol', 'cv-hist'); for (const a of A.last) { const li = h('li'); li.append(h('span', '', a.date), h('b', '', a.name + (a.political ? L(' · 정치범 포함', ' · political prisoners') : ''))); ol.append(li); } w.append(ol);
    }
  }
  function draw() { drawPoll(); drawAmnesty(); hideForGestalt(); }
  async function load() { try { S = await window.sllm.civicState(); } catch (e) { S = null; } draw(); }
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.civicState) return;
    setTimeout(() => { build(); load(); }, 450); // 「행성 총독」 칸(office-govgroup.js, 300ms) 뒤
    if (window.sllm.onCivicUpdate) window.sllm.onCivicUpdate((v) => { S = v; draw(); });
    document.addEventListener('sllm-language', () => {
      const a = $('pollCall'), b = $('amnCall'); if (a) a.querySelector('span').textContent = L('여론조사', 'Opinion polls'); if (b) b.querySelector('span').textContent = L('특별사면', 'Special pardon');
      const hp = $('civicPoll') && $('civicPoll').querySelector('h3'), ha = $('civicAmnesty') && $('civicAmnesty').querySelector('h3'); if (hp) hp.textContent = L('여론조사', 'Opinion polls'); if (ha) ha.textContent = L('특별사면', 'Special pardon');
      draw();
    });
  });
  window.SLLMCivic = { load };
})();
