// 집무실 「시위」 화면(2026-10-23 초안). 앱: src/features/protests-app.ts, 규칙: src/protests.ts.
// office.html 은 이 파일·css 만 더하고, 아이콘(「시민 청원」 옆)·빈 칸(#protests)·그리기는 모두 여기서 한다(집무실 다른 작업과 파일 충돌을 줄이려고).
// 대응 5가지: 대표단과 대화(유일한 AI 사용) · 개선 약속(기한 1년) · 실제로 지원하기 · 무시하기 · 해산 명령(안정도 +5, 불만은 남음).
// 언어 팩 규칙: 문구는 L('한국어', 'English')(SLLMI18n.pick)으로만.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const btn = (cls, text, fn) => { const b = h('button', cls, text); b.type = 'button'; b.onclick = fn; return b; };
  const STATE = { resolved: ['요구 해결', 'Demand met'], dispersed: ['해산', 'Dispersed'], faded: ['잦아듦', 'Faded'], broken: ['약속 불이행', 'Promise broken'] };
  const GOV = { advocate: ['총독이 시민 편에 서서 중앙에 지원을 요구하고 있습니다.', 'The governor has sided with the citizens and is pressing the government for support.'], mediate: ['총독이 양쪽을 중재하고 있습니다.', 'The governor is trying to mediate.'], hardline: ['총독이 강경 대응을 주장하고 있습니다.', 'The governor is calling for a crackdown.'] };
  let S = null, err = '', busy = '', drafts = {};
  const show = (id) => { if (!document.getElementById(id)) return; for (const v of document.querySelectorAll('.view')) v.classList.toggle('on', v.id === id); }; // 없는 화면으로 가면 모든 화면이 꺼져 빈 홀로그램만 남는다(2026-10-29 테스터)
  function badge() { const n = $('nProtest'); if (!n) return; const c = (S && S.open && S.open.length) || 0; n.textContent = String(c); n.classList.toggle('show', c > 0); }
  async function load() { try { S = await window.sllm.protestsState(); } catch (e) { S = null; } badge(); draw(); }
  async function run(key, fn) { if (busy) return; busy = key; err = ''; draw(); try { const r = await fn(); if (r && r.state) S = r.state; if (r && !r.ok) err = r.error || ''; } catch (e) { err = String(e); } busy = ''; badge(); draw(); }
  function card(p) {
    const c = h('article', 'prt-card i' + p.intensity + (p.state === 'promised' ? ' promised' : ''));
    const hd = h('div', 'prt-hd');
    hd.append(h('span', 'prt-planet', p.planet), h('span', 'prt-tag', p.ethicLabel), h('span', 'prt-heat', '●'.repeat(p.intensity) + '○'.repeat(3 - p.intensity)), h('span', 'prt-date', L(`${p.startedOn} 시작`, `Since ${p.startedOn}`)));
    c.append(hd, h('p', 'prt-demand', L('요구: ', 'Demand: ') + p.demand + (p.target ? ` (${p.target})` : '')));
    if (p.evidence.length) { const ul = h('ul', 'prt-facts'); for (const e of p.evidence) ul.append(h('li', '', `${e.on} · ${e.text}`)); c.append(ul); }
    if (p.governorStance && GOV[p.governorStance]) c.append(h('div', 'prt-gov ' + p.governorStance, L(GOV[p.governorStance][0], GOV[p.governorStance][1])));
    if (p.promise) c.append(h('div', 'prt-promise', L(`약속: ${p.promise.text} — 기한 ${p.promise.due}`, `Promise: ${p.promise.text} — due ${p.promise.due}`)));
    // 대표단 대화(AI)
    const talk = h('div', 'prt-talk');
    talk.append(h('p', 'prt-note', L(`대표단: ${p.delegate || '시위 대표'} — 대화만 AI 가 씁니다. 나머지 판정은 게임 자료로 합니다.`, `Delegation: ${p.delegate || 'spokesperson'} — only the conversation uses AI; everything else is judged from game data.`)));
    for (const m of p.talk || []) { const d = h('div', 'prt-msg ' + m.who, m.text); d.prepend(h('small', '', m.who === 'ruler' ? L('나', 'Me') : (p.delegate || L('대표단', 'Delegation')))); talk.append(d); }
    const row = h('div', 'prt-in'); const ta = h('textarea'); ta.placeholder = L('대표단에게 할 말…', 'Say something to the delegation…'); ta.value = drafts[p.id] || ''; ta.oninput = () => { drafts[p.id] = ta.value; };
    const send = btn('prt-btn', busy === p.id + ':talk' ? L('답을 기다리는 중…', 'Waiting…') : L('대화', 'Talk'), () => { const t = ta.value.trim(); if (!t) return; run(p.id + ':talk', async () => { const r = await window.sllm.protestTalk(p.id, t); if (r && r.ok) drafts[p.id] = ''; return r; }); });
    send.disabled = !!busy; row.append(ta, send); talk.append(row); c.append(talk);
    // 나머지 대응
    const acts = h('div', 'prt-row');
    const promise = btn('prt-btn', L(`개선 약속(기한 ${S.promiseYears || 1}년)`, `Promise reform (${S.promiseYears || 1}-year deadline)`), () => { const t = (drafts[p.id] || '').trim() || p.demand; run(p.id + ':promise', () => window.sllm.protestAct(p.id, 'promise', t)); });
    promise.title = L('입력칸에 적은 내용을 약속으로 기록합니다(비어 있으면 요구 그대로). 기한 안에 게임에서 요구가 이루어지면 약속 이행으로 남습니다.', 'Records what you typed as the promise (or the demand itself if empty). If the demand is met in the game before the deadline, it counts as kept.');
    promise.disabled = !!busy || p.state === 'promised';
    const support = btn('prt-btn soft', L('실제로 지원하기', 'Actually help'), () => run(p.id + ':support', () => window.sllm.protestAct(p.id, 'support')));
    support.title = L('게임에서 실제로 조치하세요(정책·건설·전쟁 종결 등). 다음 달 게임 자료로 요구가 이루어졌는지 확인합니다.', 'Act in the game (policy, construction, ending the war…). Next month the game data shows whether the demand was met.');
    const ignore = btn('prt-btn soft', L('무시하기', 'Ignore'), () => run(p.id + ':ignore', () => window.sllm.protestAct(p.id, 'ignore')));
    ignore.title = L('지금은 비용이 없지만, 오래 두면 커졌다가 불만만 남기고 잦아듭니다.', 'No cost now, but left alone it grows, then fades leaving resentment.');
    const disperse = btn('prt-btn warn', busy === p.id + ':disperse' ? L('명령 중…', 'Ordering…') : L('해산 명령', 'Order dispersal'), () => { if (!window.confirm(L(`「${p.planet}」 집회를 해산합니까? 행성 안정도가 잠시 오르지만 불만은 남습니다.`, `Disperse the rally on "${p.planet}"? Stability rises for a while, but the grievance remains.`))) return; run(p.id + ':disperse', () => window.sllm.protestAct(p.id, 'disperse')); });
    for (const b of [support, ignore, disperse]) b.disabled = !!busy;
    acts.append(promise, support, ignore, disperse); c.append(acts);
    return c;
  }
  function draw() {
    const root = $('prtRoot'); if (!root || !$('protests').classList.contains('on')) return; root.textContent = ''; root.dataset.i18nSkip = '';
    const wrap = h('div', 'prt-main'); root.append(wrap);
    if (!S || !S.sid) { wrap.append(h('p', 'prt-empty', L('세이브를 불러오면 행성의 시위 소식이 이곳에 옵니다.', 'Load a save and news of protests on your planets will arrive here.'))); return; }
    if (err) wrap.append(h('div', 'prt-err', err));
    if (!S.open.length) wrap.append(h('p', 'prt-empty', L('지금 진행 중인 시위가 없습니다. 시민들은 자기 가치관에 따라, 실제로 일어난 일(긴 전쟁·차별·생활 여건)을 두고 거리로 나섭니다. 안정도가 높은 행성은 조용합니다.', 'No protests right now. Citizens take to the streets over real events — long wars, discrimination, poor living conditions — according to their own values. Stable planets stay quiet.')));
    for (const p of S.open) wrap.append(card(p));
    if ((S.celebrations || []).length) { wrap.append(h('h5', 'prt-hh', L('최근 축하 집회', 'Recent celebrations'))); for (const c of S.celebrations) wrap.append(h('div', 'prt-cel', `${c.on} · ${c.planetName || L('행성', 'Planet') + ' #' + c.planetK}`)); }
    if (S.history.length) {
      wrap.append(h('h5', 'prt-hh', L('지난 시위', 'Past protests')));
      const ol = h('ol', 'prt-hist');
      for (const p of S.history) { const li = h('li', 'st-' + p.state); li.append(h('b', '', p.endedOn || p.startedOn), document.createTextNode(` ${p.planet} · ${p.demand} — `), h('span', '', STATE[p.state] ? L(STATE[p.state][0], STATE[p.state][1]) : p.state)); ol.append(li); }
      wrap.append(ol);
    }
  }
  function build() {
    const after = $('petCall') || document.querySelector('[data-app="policy"]'); const holo = $('policy') && $('policy').parentElement;
    if (!after || !holo || $('protests')) return;
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'prtCall';
    b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 40V12"/><path d="M14 12h20l-4 6 4 6H14"/><path d="M8 40h32"/><path d="M30 34l4-4 4 4"/></svg>';
    b.append(h('span', '', L('시위', 'Protests')), Object.assign(h('b', 'n'), { id: 'nProtest' }));
    b.onclick = () => { show('protests'); load(); };
    after.after(b);
    const sec = h('section', 'view app'); sec.id = 'protests'; sec.setAttribute('aria-label', L('시위', 'Protests'));
    const hd = h('div', 'apph'); const back = h('button', 'back', '‹ ' + L('바탕화면', 'Desktop')); back.type = 'button'; back.onclick = () => show('desktop');
    hd.append(back, h('h3', '', L('시위', 'Protests'))); const body = h('div', 'appb'); body.id = 'prtRoot';
    sec.append(hd, body); holo.append(sec);
  }
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { build(); load(); }, 0); // 시민 청원 아이콘이 먼저 생긴 뒤 그 옆에 둔다
    if (window.sllm.onProtestsUpdate) window.sllm.onProtestsUpdate((v) => { S = v; badge(); draw(); });
    if (window.sllm.onOfficeGo) window.sllm.onOfficeGo((v) => { if (v === 'protests') { build(); show('protests'); load(); } }); // 알림 → 집무실 → 바로 시위
    document.addEventListener('sllm-language', () => { const b = $('prtCall'); if (b) b.querySelector('span').textContent = L('시위', 'Protests'); draw(); });
  });
  window.SLLMProtest = { load };
})();
