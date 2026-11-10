// 집무실 「궁정」(2026-10-28 정치 — 월드박스·토탈워·트로피코 참고). 앱: src/features/court-app.ts(courtView·courtTree·courtAct·courtFree·courtRename), 규칙: src/court.ts.
// 탭: 음모(낌새·드러난 음모·대응) · 수감자 · 가문 · 가계도. 가계도는 아기방의 「가문·가계도」에서도 연다(SLLMCourt.tree(host)).
// office.html 은 이 파일·css 만 더하고, 아이콘(「추모관」 다음)·빈 칸(#court)·그리기는 모두 여기서 한다. 가계도 배치는 열 때만 화면에서 계산한다(앱·게임 부담 없음).
// 언어 팩 규칙: 문구는 L('한국어', 'English')(SLLMI18n.pick)으로만. 인물 이름은 data-i18n-skip.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const skip = (e) => { e.setAttribute('data-i18n-skip', ''); return e; };
  const btn = (cls, text, fn) => { const b = h('button', cls, text); b.type = 'button'; b.onclick = fn; return b; };
  const show = (id) => { if (!document.getElementById(id)) return; for (const v of document.querySelectorAll('.view')) v.classList.toggle('on', v.id === id); }; // 없는 화면으로 가면 모든 화면이 꺼져 빈 홀로그램만 남는다(2026-10-29 테스터)
  const TABS = () => [['plots', L('음모', 'Intrigue')], ['prison', L('수감자', 'Prisoners')], ['house', L('가문', 'House')], ['tree', L('가계도', 'Family tree')]];
  let S = null, tab = 'plots', busy = '', msg = '', body = null, tabsEl = null, armed = '';

  async function load() { try { S = await window.sllm.courtView(); } catch (e) { S = null; } }
  async function run(kind, fn) {
    if (busy) return; busy = kind; msg = ''; draw();
    try { const r = await fn(); if (r && r.view) S = r.view; msg = (r && (r.text || r.error)) || ''; } catch (e) { msg = String(e && e.message || e); }
    busy = ''; draw();
  }
  const chips = (list, cls) => { const w = h('span', 'crt-chips ' + (cls || '')); for (const t of list || []) { const c = h('i', '', t.name); c.title = t.desc || ''; w.append(c); } return w; };

  // ---- 음모
  const COSTS = (c) => [c.energy ? L(`에너지 ${c.energy}`, `${c.energy} energy`) : '', c.influence ? L(`영향력 ${c.influence}`, `${c.influence} influence`) : ''].filter(Boolean).join(' + ');
  const ACT_HINT = () => ({
    bribe: L('몰래 돈을 쥐여 줍니다: 진행도 -30', 'Slip them money: progress -30'),
    expose: L('추문을 터뜨립니다: 음모자 영향력 -40, 진행도 -20', 'Leak a scandal: plotter influence -40, progress -20'),
    appease: L('자리를 보장하고 달랩니다. 반동은 없지만 5년 안에 30% 확률로 다시 꾸밉니다.', 'Guarantee their position. No backlash, but a 30% chance they plot again within 5 years.'),
    demote: L('직책에서 물러나게 합니다. 민심 -1, 그 파벌 매력도 -10%(1년).', 'Remove them from their post. Mood -1, their faction attraction -10% (1 year).'),
    arrest: L('체포해 가둡니다(「수감됨」 특성). 민심 -3, 30% 확률로 시위 원인, 파벌 매력도 -10%. 수감자 탭에서 석방하거나 처형 절차로 넘길 수 있습니다.', 'Arrest and imprison them ("Imprisoned" trait). Mood -3, 30% chance of a protest cause, faction attraction -10%. Release or hand them to an execution from the Prisoners tab.'),
    exile: L('제국에서 내쫓습니다. 민심 -5, 50% 확률로 시위 원인, 파벌 매력도 -10%, 40% 확률로 적국이 받아 지도자로 씁니다.', 'Banish them. Mood -5, 50% chance of a protest cause, faction attraction -10%, and a 40% chance an enemy takes them in as a leader.'),
  });
  function plotCard(p, past) {
    const box = h('div', 'emb-rep crt-plot' + (p.found ? ' found' : '') + (past ? ' past' : ''));
    const hd = h('div', 'emb-hd'); hd.append(h('h4', '', p.kindName));
    hd.append(h('span', 'lv ' + (p.found ? 'lv-danger' : past ? 'none' : 'lv-watch'), past ? (p.endName || L('끝남', 'Ended')) : p.found ? L('드러남', 'Uncovered') : L('수상한 낌새', 'Suspicion')));
    box.append(hd);
    if (p.found || past) box.append(skip(h('p', 'crt-text', p.text)));
    else box.append(skip(h('p', 'crt-text', L(`${p.name}이(가) 수상합니다. 「${p.kindName}」 소문이 돕니다(확인되지 않음).`, `${p.name} is acting suspiciously. Rumors of a "${p.kindName}" (unconfirmed).`))));
    const meta = h('div', 'emb-meta');
    if (p.prog !== null && p.prog !== undefined) meta.append(h('span', '', L(`진행도 ${p.prog}/100`, `Progress ${p.prog}/100`)));
    if (p.inf !== null && p.inf !== undefined) meta.append(h('span', '', L(`음모자 영향력 ${p.inf}`, `Plotter influence ${p.inf}`)));
    if (p.eth) meta.append(h('span', '', L(`그쪽 파벌: ${p.eth}`, `Their faction: ${p.eth}`)));
    if (p.hinted) meta.append(h('span', '', L(`낌새 ${p.hinted}`, `Rumors since ${p.hinted}`)));
    if (p.found) meta.append(h('span', '', L(`드러남 ${p.found}`, `Uncovered ${p.found}`)));
    if (past && p.ended) meta.append(h('span', '', L(`끝남 ${p.ended}`, `Ended ${p.ended}`)));
    box.append(meta);
    if (past && p.wonText) box.append(skip(h('p', 'crt-won', p.wonText)));
    if (!past && p.acts.length) {
      const row = h('div', 'crt-acts'), hint = ACT_HINT();
      for (const a of p.acts) {
        const hard = a.key === 'arrest' || a.key === 'exile';
        const label = (armed === p.id + a.key ? L('정말요? 한 번 더 누르세요', 'Sure? Press again') : a.name) + (COSTS(a.cost) ? ` · ${COSTS(a.cost)}` : '');
        const b = btn('emb-btn sm' + (hard ? ' crt-hard' : '') + (armed === p.id + a.key ? ' armed' : ''), label, () => {
          if (hard && armed !== p.id + a.key) { armed = p.id + a.key; draw(); setTimeout(() => { if (armed === p.id + a.key) { armed = ''; draw(); } }, 4000); return; }
          armed = ''; run('act', () => window.sllm.courtAct(p.id, a.key));
        });
        b.title = hint[a.key] || ''; b.disabled = !!busy || !S.running; row.append(b);
      }
      box.append(row);
      if (!p.found) box.append(h('small', 'emb-empty', L('아직 드러나지 않은 음모입니다. 견제는 할 수 있지만, 처리(회유·좌천·체포·추방)는 음모가 드러난 뒤에만 할 수 있습니다.', 'The plot is not uncovered yet. You can check it, but appeasing, demoting, arresting or exiling needs the plot to be uncovered.')));
    }
    if (p.log && p.log.length) { const ul = h('ul', 'crt-log'); for (const l of p.log.slice(0, 6)) ul.append(skip(h('li', '', `${l.date} — ${l.text}`))); box.append(ul); }
    return box;
  }
  function drawPlots(root) {
    root.append(h('p', 'emb-empty', L('우리 지도자가 가끔 음모를 꾸밉니다(1년에 한 번 판정 8%, 불안·시위·패전이면 더 잦음). 진행도 30부터 비서가 낌새를 알리고, 매달 조금씩 드러날 기회가 있습니다. 끝까지 들키지 않으면 음모가 이루어집니다.', 'Our leaders sometimes plot (an 8% check each year, more often with unrest, protests or a losing war). From progress 30 your secretary hears rumors, and each month there is a chance it comes to light. If it stays hidden to the end, the plot succeeds.')));
    if (S.quiet) root.append(h('p', 'emb-empty crt-quiet', L('지금은 궁정이 조용합니다.', 'The court is quiet for now.')));
    for (const p of S.plots) root.append(plotCard(p, false));
    if (S.past.length) { root.append(h('div', 'emb-ph', L('지난 음모', 'Past plots'))); for (const p of S.past) root.append(plotCard(p, true)); }
  }
  // ---- 수감자
  function drawPrison(root) {
    if (!S.prisoners.length) { root.append(h('p', 'emb-empty', L('갇혀 있는 사람이 없습니다.', 'No one is imprisoned.'))); return; }
    for (const p of S.prisoners) {
      const box = h('div', 'emb-rep'); const hd = h('div', 'emb-hd'); hd.append(skip(h('h4', '', p.name)), h('span', 'lv lv-tension', L(`${p.since}부터 수감`, `Held since ${p.since}`))); box.append(hd);
      const row = h('div', 'crt-acts');
      const free = btn('emb-btn sm', L('석방', 'Release'), () => run('free', () => window.sllm.courtFree(p.pid))); free.disabled = !!busy || !S.running;
      free.title = L('「수감됨」 특성을 떼고 풀어 줍니다. 직책은 다시 맡겨야 합니다.', 'Removes the "Imprisoned" trait. You will need to assign them again.');
      row.append(free);
      if (window.SLLMExecution) { const ex = btn('emb-btn sm crt-hard', L('처형 절차로 넘기기…', 'Hand over for execution…'), () => window.SLLMExecution.open({ key: p.pid, name: p.name })); ex.disabled = !p.alive; row.append(ex); }
      box.append(row); root.append(box);
    }
  }
  // ---- 가문
  function drawHouse(root) {
    if (S.houseOff) { root.append(h('p', 'emb-empty', L('가문은 세습 군주제(제정)나 독재 정부에서만 기록됩니다.', 'Ruling houses are only recorded under imperial (hereditary) or dictatorial governments.'))); return; }
    if (!S.house) { root.append(h('p', 'emb-empty', L('아직 통치 가문을 기록하지 못했습니다. 게임이 켜진 채 한 달이 지나면 생깁니다.', 'No ruling house recorded yet. It appears after a month passes with the game running.'))); return; }
    const H = S.house, box = h('div', 'emb-rep'), hd = h('div', 'emb-hd'); hd.append(skip(h('h4', '', H.label)), h('span', 'lv none', L(`${H.since}부터`, `Since ${H.since}`))); box.append(hd);
    box.append(h('div', 'emb-ph', L('가문 특성(이야기)', 'House traits (story)')));
    const tl = h('ul', 'crt-traits'); for (const t of H.traits) { const li = h('li'); li.append(h('b', '', t.name), h('span', '', ' — ' + t.desc)); tl.append(li); } box.append(tl);
    box.append(h('small', 'emb-empty', L('특성은 자녀에게 하나마다 70% 확률로 이어지고, 세대마다 20% 확률로 새 특성이 생깁니다. 1:1 통신에서 가문 사람의 말투에 반영됩니다.', 'Each trait passes to a child with a 70% chance, and each generation has a 20% chance of a new one. House members carry them in 1:1 talks.')));
    const rn = h('div', 'crt-rename'), inp = h('input'); inp.maxLength = 40; inp.value = H.name; inp.setAttribute('aria-label', L('가문 이름', 'House name')); skip(inp);
    rn.append(inp, btn('emb-btn sm', L('이름 바꾸기', 'Rename'), () => run('rename', () => window.sllm.courtRename(H.id, inp.value)))); box.append(rn);
    box.append(h('div', 'emb-ph', L('역대 통치자', 'Rulers of the house')));
    const ol = h('ol', 'crt-rulers'); for (const r of H.rulers) ol.append(skip(h('li', '', `${r.name} · ${r.from}${r.to ? ' ~ ' + r.to : ' ~'}`))); box.append(ol);
    root.append(box);
    if (S.marriages.length) {
      const mb = h('div', 'emb-rep'); mb.append(h('div', 'emb-ph', L('정략결혼', 'Political marriages')));
      for (const m of S.marriages) mb.append(skip(h('div', 'crt-mar ' + m.state, `${m.on} · ${m.text}${m.state === 'strained' ? L(' · 전쟁으로 곤란해짐', ' · strained by war') : ''}`)));
      root.append(mb);
    }
  }

  // ---- 가계도(열 때만 배치) — host 안에 그린다. 아기방에서도 쓴다.
  const ROLE = () => ({ ruler: L('통치자', 'Ruler'), leader: L('지도자', 'Leader'), civ: L('민간인', 'Civilian'), adult: L('성인', 'Adult'), young: L('아이', 'Child') });
  const TAG = () => ({ prison: L('수감 중', 'Imprisoned'), exiled: L('추방됨', 'Exiled'), defected: L('망명', 'Defected') });
  function personCard(p, kind) {
    const c = h('button', 'crt-p ' + kind + (p.gone || p.dead ? ' gone' : '') + (p.now ? ' now' : '')); c.type = 'button';
    c.append(skip(h('b', '', p.name)));
    const sub = [];
    if (kind === 'ruler') sub.push(L('통치자', 'Ruler') + ` ${p.from}${p.to ? '~' + p.to : '~'}`);
    else if (kind === 'kid') { sub.push(p.role === 'civ' && p.job ? `${ROLE().civ} · ${p.job}` : (ROLE()[p.role] || '')); if (p.born) sub.push(p.born.slice(0, 4) + (p.dead ? '–' + p.dead.slice(0, 4) : '')); if (p.heir) sub.push(L('후계자', 'Heir')); }
    else sub.push(L('배우자', 'Spouse'));
    c.append(h('small', '', sub.filter(Boolean).join(' · ')));
    if (p.traits && p.traits.length) c.append(chips(p.traits));
    if (p.tags && p.tags.length) { const t = h('span', 'crt-tags'); for (const k of p.tags) t.append(h('i', '', TAG()[k] || k)); c.append(t); }
    if (p.wed) c.append(skip(h('em', 'crt-wed' + (p.wed.state === 'strained' ? ' bad' : ''), `⚭ ${p.wed.spouse}${p.wed.empire ? ` · ${p.wed.empire}${p.wed.house ? L(` ${p.wed.house} 가문`, ` · House ${p.wed.house}`) : ''}` : ''}`)));
    const why = (p.traits || []).map((t) => `${t.name}: ${t.desc}`).join('\n');
    c.title = [why, (p.talk || (kind === 'ruler' && !p.gone)) && window.openTalk ? L('누르면 1:1 통신', 'Click for a 1:1 talk') : ''].filter(Boolean).join('\n');
    const key = kind === 'ruler' ? p.pid : p.pid;
    if (key && window.openTalk && (p.talk || (kind === 'ruler' && !p.gone)) && !(p.tags || []).includes('defected') && !(p.tags || []).includes('exiled')) c.onclick = () => { if (window.SLLMPrivateRooms && window.SLLMPrivateRooms.close && document.querySelector(".rooms-frame")) { try { window.SLLMPrivateRooms.close(); } catch (e) { /* 무시 */ } } window.openTalk({ key, name: p.name, role: 'official' }); };
    else c.classList.add('static');
    return c;
  }
  async function tree(host) {
    host.textContent = ''; host.classList.add('crt-treehost');
    let T = null; try { T = await window.sllm.courtTree(); } catch (e) { T = null; }
    if (!T || !T.ok) { host.append(h('p', 'emb-empty', (T && T.error) || L('가계도를 불러오지 못했습니다.', 'Could not load the family tree.'))); return; }
    if (T.noAuth) { host.append(h('p', 'emb-empty', L('가계도는 세습 군주제(제정)나 독재 정부에서만 볼 수 있습니다.', 'The family tree is only available to imperial (hereditary) or dictatorial governments.'))); return; }
    if (T.off || !T.houses.length) { host.append(h('p', 'emb-empty', L('아직 가계도에 올릴 가문이 없습니다.', 'No house to show yet.'))); return; }
    let pick = T.houses.find((x) => x.current) || T.houses[0];
    const top = h('div', 'crt-treebar');
    if (T.houses.length > 1) { const sel = h('select'); for (const x of T.houses) { const o = h('option', '', x.label + (x.current ? L(' (지금)', ' (current)') : '')); o.value = x.id; if (x === pick) o.selected = true; sel.append(o); } skip(sel); sel.onchange = () => { pick = T.houses.find((x) => x.id === sel.value) || pick; paint(); }; top.append(sel); }
    const legend = h('small', 'emb-empty', L('세대는 위에서 아래로. 다음 통치자가 된 자녀에게서 아래 세대가 이어집니다. 흐린 카드는 고인입니다.', 'Generations run top to bottom; the next generation continues from the child who became ruler. Faded cards are the departed.'));
    top.append(legend); host.append(top);
    const stage = h('div', 'crt-tree'); host.append(stage);
    const svgNS = 'http://www.w3.org/2000/svg';
    function paint() {
      stage.textContent = '';
      const hd = h('div', 'crt-hhead'); hd.append(skip(h('b', '', pick.label)), chips(pick.traits)); stage.append(hd);
      const lines = document.createElementNS(svgNS, 'svg'); lines.setAttribute('class', 'crt-lines'); stage.append(lines);
      const links = []; // [fromEl, toEl, kind]
      const byPid = new Map();
      for (const g of pick.gens) {
        const gen = h('div', 'crt-gen');
        const couple = h('div', 'crt-couple'); const rc = personCard(g.ruler, 'ruler'); couple.append(rc); byPid.set(g.ruler.pid, couple);
        for (const s of g.spouses) { couple.append(h('span', 'crt-ring', '⚭')); couple.append(personCard(s, 'spouse')); }
        gen.append(couple);
        if (g.children.length) {
          const row = h('div', 'crt-kids');
          for (const k of g.children) { const kc = personCard(k, 'kid'); if (k.next) kc.classList.add('next'); row.append(kc); links.push([couple, kc, 'kid']); if (k.next) links.push([kc, k.pid, 'next']); }
          gen.append(row);
        }
        stage.append(gen);
      }
      // 이어지는 세대가 없는(성이 같아 이어진) 통치자는 앞 세대에서 점선
      for (let i = 1; i < pick.gens.length; i++) { const pid = pick.gens[i].ruler.pid; if (!links.some((l) => l[2] === 'next' && l[1] === pid)) links.push([byPid.get(pick.gens[i - 1].ruler.pid), pid, 'line']); }
      const draw = () => {
        if (!stage.isConnected) return; const base = stage.getBoundingClientRect();
        lines.setAttribute('width', String(stage.scrollWidth)); lines.setAttribute('height', String(stage.scrollHeight)); lines.textContent = '';
        for (const [a, bRef, kind] of links) {
          const b = typeof bRef === 'string' ? byPid.get(bRef) : bRef; if (!a || !b) continue;
          const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
          const x1 = ra.left + ra.width / 2 - base.left + stage.scrollLeft, y1 = ra.bottom - base.top + stage.scrollTop, x2 = rb.left + rb.width / 2 - base.left + stage.scrollLeft, y2 = rb.top - base.top + stage.scrollTop;
          const my = (y1 + y2) / 2, path = document.createElementNS(svgNS, 'path');
          path.setAttribute('d', `M${x1} ${y1} V${my} H${x2} V${y2}`); path.setAttribute('class', 'crt-ln ' + kind); lines.append(path);
        }
      };
      requestAnimationFrame(draw);
      if (window.ResizeObserver) { const ro = new ResizeObserver(() => draw()); ro.observe(stage); }
    }
    paint();
  }

  function draw() {
    if (!body) return;
    if (tabsEl) for (const b of tabsEl.children) b.setAttribute('aria-selected', String(b.dataset.t === tab));
    body.textContent = '';
    if (!S || !S.ok) { body.append(h('p', 'emb-empty', (S && S.error) || L('세이브를 불러오면 궁정이 열립니다.', 'Load a save to open the court.'))); return; }
    if (S.off) { body.append(h('p', 'emb-empty', L('이 제국에는 궁정이 없습니다.', 'This empire has no court.'))); return; }
    if (msg) body.append(h('div', 'emb-err crt-msg', msg));
    const root = h('div', 'crt-body'); body.append(root);
    if (tab === 'plots') drawPlots(root); else if (tab === 'prison') drawPrison(root); else if (tab === 'house') drawHouse(root); else void tree(root);
  }
  function build() {
    const icons = $('icons'), after = document.querySelector('#icons button[data-app="memorial"]'); const holo = $('policy') && $('policy').parentElement;
    if (!icons || !holo || $('court')) return false;
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'courtCall';
    b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 20l14-12 14 12"/><path d="M14 20v18M34 20v18M24 20v18M19 20v18M29 20v18"/><path d="M8 38h32M6 42h36"/><circle cx="24" cy="14" r="2"/></svg>';
    b.append(h('span', '', L('궁정', 'Court')), (() => { const n = h('b', 'n'); n.id = 'nCourt'; return n; })());
    b.onclick = () => openCourt();
    if (after) after.after(b); else icons.append(b); // 추모관 아이콘이 없어도 궁정은 열린다
    const sec = h('section', 'view app'); sec.id = 'court'; sec.setAttribute('aria-label', L('궁정', 'Court'));
    const hd = h('div', 'apph'); const back = h('button', 'back', '‹ ' + L('바탕화면', 'Desktop')); back.type = 'button'; back.onclick = () => show('desktop');
    tabsEl = h('div', 'crt-tabs'); tabsEl.setAttribute('role', 'tablist');
    for (const [k, n] of TABS()) { const t = h('button', 'tab', n); t.type = 'button'; t.dataset.t = k; t.setAttribute('role', 'tab'); t.onclick = () => { tab = k; msg = ''; draw(); }; tabsEl.append(t); }
    hd.append(back, h('h3', '', L('궁정', 'Court')), tabsEl);
    body = h('div', 'appb crt-root'); body.id = 'courtRoot';
    sec.append(hd, body); holo.append(sec);
    return true;
  }
  function badge() { const n = $('nCourt'); if (!n) return; const c = S && S.ok && S.plots ? S.plots.filter((p) => p.found).length + S.plots.filter((p) => !p.found).length : 0; n.textContent = c ? String(c) : ''; }
  // 알림에서 바로 열 때(2026-10-29 테스터 「음모 알림 → 빈 집무실」): 창이 막 열려 궁정 칸이 아직 없을 수 있다 → 만들어질 때까지(최대 3초) 기다렸다 연다.
  async function openCourt(t) {
    if (t) tab = t;
    for (let i = 0; !$('court') && i < 30; i++) { if (build()) break; await new Promise((r) => setTimeout(r, 100)); }
    if (!$('court')) return;
    show('court'); await load(); draw(); badge();
  }
  document.addEventListener('DOMContentLoaded', () => {
    let tries = 0; const t = setInterval(() => { if (build() || ++tries > 30) { clearInterval(t); load().then(badge); } }, 100);
    if (window.sllm.onOfficeGo) window.sllm.onOfficeGo((v) => { if (v === 'court') openCourt('plots'); });
    if (window.sllm.onCourtUpdate) window.sllm.onCourtUpdate((v) => { S = v; badge(); if ($('court') && $('court').classList.contains('on') && tab !== 'tree') draw(); });
    document.addEventListener('sllm-language', () => {
      const b = $('courtCall'); if (b) b.querySelector('span').textContent = L('궁정', 'Court');
      const s = $('court'); if (s) { s.querySelector('.apph h3').textContent = L('궁정', 'Court'); s.querySelector('.apph .back').textContent = '‹ ' + L('바탕화면', 'Desktop'); if (tabsEl) TABS().forEach(([k, n], i) => { if (tabsEl.children[i]) tabsEl.children[i].textContent = n; }); }
      draw();
    });
  });
  window.SLLMCourt = { open: openCourt, tree };
})();
