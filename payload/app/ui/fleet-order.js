// 함대 사령부 「자동 작전」 칸(2026-11-04). 앱: src/features/fleetorder-app.ts, 규칙: src/fleetorder.ts, 게임: sllm_fleetorder.txt.
// fleet.html 이 sel === 'order' 일 때 SLLMFleetOrder.draw(pane) 를 부른다. 상태는 foState(열 때 한 번 보고)·foUpdate(사건·응답 때).
(function () {
  const L = (ko, en) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(ko, en) : ko);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const css = `
  .fo-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .fo-sw{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:16px;padding:4px 12px;cursor:pointer;background:none;color:var(--dim)}
  .fo-sw i{width:30px;height:16px;border-radius:8px;background:color-mix(in srgb,var(--dim) 35%,transparent);position:relative}
  .fo-sw i:after{content:'';position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:var(--dim);transition:left .15s}
  .fo-sw.on{color:var(--good);border-color:var(--good)} .fo-sw.on i{background:color-mix(in srgb,var(--good) 40%,transparent)} .fo-sw.on i:after{left:16px;background:var(--good)}
  .fo-sw:disabled{opacity:.5;cursor:default}
  .fo-ops{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:4px 0 12px}
  .fo-op{border:1px solid var(--line);background:var(--panel);border-radius:6px;padding:10px 12px;font-size:12px;min-height:104px}
  .fo-op.idle{opacity:.55} .fo-op b{display:block;color:var(--gold);letter-spacing:.06em} .fo-op .sys{font-size:14px;color:var(--text);margin:4px 0}
  .fo-op .st{display:inline-block;font-size:10.5px;padding:0 7px;border-radius:9px;border:1px solid var(--line);color:var(--dim)}
  .fo-op .st.s1{color:var(--hi);border-color:var(--hi)} .fo-op .st.s2{color:var(--good);border-color:var(--good)}
  .fo-bar{height:6px;border-radius:3px;background:color-mix(in srgb,var(--bad) 45%,transparent);margin:6px 0 2px;overflow:hidden} .fo-bar i{display:block;height:100%;background:var(--good)}
  .fo-op small{color:var(--dim);display:block}
  .fo-fl{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) 72px 92px 118px;gap:8px;align-items:center;font-size:12px;padding:5px 2px;border-bottom:1px solid var(--line2)}
  .fo-fl.hd{color:var(--dim);font-size:11px;letter-spacing:.06em} .fo-fl span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .fo-tag{font-size:10.5px;padding:0 7px;border-radius:9px;border:1px solid var(--line);color:var(--dim);justify-self:start}
  .fo-tag.m1{color:var(--gold);border-color:var(--gold)} .fo-tag.m2{color:var(--bad);border-color:var(--bad)} .fo-tag.m3,.fo-tag.op{color:var(--good);border-color:var(--good)}
  .fo-fl .btn{padding:2px 8px;font-size:11px}
  .fo-log .ln{max-width:100%} .fo-log .ln small{color:var(--dim);font-weight:400;margin-left:6px}
  .fo-note{color:var(--dim);font-size:11.5px;margin:6px 0 0}
  .fo-ally{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1.4fr) 64px minmax(0,1.2fr);gap:8px;align-items:center;font-size:12px;padding:6px 2px;border-bottom:1px solid var(--line2)}
  .fo-ally .btn{padding:2px 8px;font-size:11px;justify-self:start} .fo-ally small{color:var(--dim)} .fo-tag.m4{color:var(--hi);border-color:var(--hi)}
  .fo-lend{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px;font-size:12px} .fo-lend select{background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:4px;padding:3px 6px;max-width:260px}
  .fo-ord{border:1px solid var(--line);background:var(--panel);border-radius:6px;padding:10px 12px;margin-bottom:12px}
  .fo-ord .cur{font-size:12px;color:var(--text)} .fo-ord textarea{width:100%;height:54px;resize:vertical;margin:8px 0 6px;background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:6px 8px;color:var(--text)}
  .fo-ord .row{display:flex;gap:8px;align-items:center}
  .fo-rec{border-left:2px solid var(--line);padding:4px 0 6px 12px;margin:0 0 8px;font-size:12px} .fo-rec.done{border-color:var(--good)} .fo-rec.retreat,.fo-rec.lost{border-color:var(--bad)}
  .fo-rec .btn{padding:2px 8px;font-size:11px;margin-left:8px} .fo-rep{white-space:pre-wrap;margin-top:6px;padding:8px 10px;border:1px solid var(--line2);border-radius:4px;background:color-mix(in srgb,var(--bg) 70%,transparent)}
  .fo-log .act{margin-top:4px} .fo-log .act .btn{padding:2px 8px;font-size:11px}
  .fo-talk{margin:6px 0 4px 10px;border-left:2px solid var(--hi);padding-left:10px} .fo-talk .me{color:var(--text)} .fo-talk .them{color:var(--gold)}
  .fo-talk textarea{width:100%;height:44px;resize:vertical;margin:6px 0;background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:6px 8px;color:var(--text)}
  @media (max-width:980px){.fo-ops{grid-template-columns:1fr}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  let A = null, pane = null, active = false, err = '', busy = false, ordDraft = '', talkLid = 0, talkDraft = '', repOpen = '';
  const RES = { done: ['완료', 'Secured'], retreat: ['철수', 'Withdrew'], abort: ['중단', 'Called off'], lost: ['전멸', 'Lost'] };
  const MODE = { 0: ['자동', 'Auto'], 1: ['직접 지휘', 'Manual'], 2: ['수리 중', 'Repairing'], 3: ['작전 선두', 'Op lead'], 4: ['연합군', 'Allied'] };
  let allyAsk = '', lendFid = 0, lendIdx = 0;
  const OPST = { 1: ['집결 중', 'Rallying'], 2: ['진격', 'Advancing'] };
  const fmt = (n) => (Number(n) || 0).toLocaleString();

  async function act(fn) { if (busy) return; busy = true; err = ''; draw(); try { const r = await fn(); if (r && r.state) A = r.state; if (r && r.ok === false) err = r.error || L('처리하지 못했습니다.', 'Something went wrong.'); } catch (e) { err = String(e && e.message || e); } finally { busy = false; draw(); } }

  function draw() {
    if (!active || !pane) return;
    pane.className = ''; pane.innerHTML = '';
    const ph = h('div'); ph.id = 'ph';
    const ttl = h('div'); ttl.append(h('b', '', L('자동 작전', 'Automated operations')), h('br'), h('small', '', L('켜면 함대가 스스로 목표를 골라 모이고 칩니다. 피해가 큰 함대는 조선소로 돌아갑니다.', 'When on, fleets pick targets, rally and attack on their own. Badly damaged fleets return to a shipyard.')));
    ph.append(ttl, h('div', 'sp'));
    if (!A || !A.sid) { pane.append(ph); const b = h('div'); b.id = 'body'; b.append(h('p', 'fo-note', L('세이브를 불러오면 표시됩니다.', 'Shown once a save is loaded.'))); pane.append(b); return; }
    const sw = h('button', 'fo-sw' + (A.on ? ' on' : '')); sw.append(h('i'), h('span', '', A.on ? L('켜짐', 'ON') : L('꺼짐', 'OFF')));
    sw.disabled = busy || A.busy || !A.running; sw.title = A.running ? '' : L('게임이 켜져 있어야 합니다.', 'The game must be running.');
    sw.onclick = () => { if (!A.on && !confirm(L('자동 작전을 켤까요? 직접 지휘로 돌려 둔 함대를 뺀 모든 군 함대가 공격 자세가 되고, 전쟁 중이면 다음 달부터 스스로 움직입니다.', 'Turn automated operations on? Every military fleet except those set to manual switches to aggressive stance and, while at war, starts moving on its own from next month.'))) return; act(() => window.sllm.foSwitch(!A.on)); };
    const re = h('button', 'btn sub', '⟳'); re.title = L('게임에서 다시 읽기', 'Reread from the game'); re.disabled = busy || A.busy || !A.running; re.onclick = () => act(() => window.sllm.foRefresh().then((s) => ({ ok: true, state: s })));
    ph.append(sw, re); pane.append(ph);
    const body = h('div'); body.id = 'body'; pane.append(body);
    if (err) { const e = h('p', 'fo-note', err); e.style.color = 'var(--bad)'; body.append(e); }
    if (A.busy) body.append(h('p', 'fo-note', L('게임에서 읽는 중…', 'Reading from the game…')));
    if (A.war === false) body.append(h('p', 'fo-note', L('지금은 전쟁 중이 아닙니다. 새 작전은 전쟁 중에만 열립니다(괴물만 있는 성계는 노리지 않습니다).', 'We are not at war. New operations open only during a war (systems with only space fauna are ignored).')));

    // 작전 지시(LLM 1번): 말 → 설정 숫자 + 제독 답 무전
    body.append(h('p', 'th', L('작전 지시', 'STANDING ORDERS')));
    const od = h('div', 'fo-ord'), cur = h('div', 'cur', (A.orders && A.orders.text) || ''); cur.dataset.i18nSkip = ''; od.append(cur);
    if (A.orders && A.orders.last) { const ls = h('small', 'fo-note', L(`마지막 지시(${A.orders.date}): 「${A.orders.last}」${A.orders.summary ? ' → ' + A.orders.summary : ''}`, `Last order (${A.orders.date}): "${A.orders.last}"${A.orders.summary ? ' → ' + A.orders.summary : ''}`)); ls.dataset.i18nSkip = ''; od.append(ls); }
    const ta = h('textarea'); ta.maxLength = 500; ta.value = ordDraft; ta.placeholder = L('예: 베가부터 쳐라 / 피해를 줄이고 신중하게 / 적 요새는 건드리지 말고 우리 땅만 지켜라 / 도망가는 적은 끝까지 쫓아라', 'e.g. Take Vega first / Be careful, avoid losses / Leave enemy fortresses alone and only defend our space / Chase fleeing enemies to the end'); ta.oninput = () => { ordDraft = ta.value; };
    const orow = h('div', 'row'), ob = h('button', 'btn', A.thinking ? L('사령부가 검토하는 중…', 'Staff is reviewing…') : L('지시 내리기', 'Issue order'));
    ob.disabled = busy || A.thinking || !A.running || !ordDraft.trim(); ta.addEventListener('input', () => { ob.disabled = busy || A.thinking || !A.running || !ta.value.trim(); });
    ob.onclick = () => act(async () => { const r = await window.sllm.foOrders(ta.value); if (r && r.ok) ordDraft = ''; return r; });
    orow.append(ob, h('small', 'fo-note', A.systems && A.systems.length ? L(`우선 목표로 고를 수 있는 적 성계 ${A.systems.length}곳`, `${A.systems.length} enemy system(s) can be a priority target`) : L('우선 목표는 전쟁 중일 때 보이는 적 성계에서 고릅니다.', 'Priority targets come from visible enemy systems in wartime.')));
    od.append(ta, orow); body.append(od);

    // 작전 3칸
    body.append(h('p', 'th', L('작전', 'OPERATIONS')));
    const ops = h('div', 'fo-ops');
    for (let n = 1; n <= 3; n++) {
      const o = (A.ops || []).find((x) => x.op === n), c = h('div', 'fo-op' + (o && o.st ? '' : ' idle'));
      c.append(h('b', '', L(`작전 ${n}`, `Operation ${n}`)));
      if (!o || !o.st) { c.append(h('small', '', A.on ? L('비어 있음 — 칠 만한 목표가 생기면 엽니다.', 'Empty — opens when a beatable target appears.') : L('꺼져 있음', 'Off'))); ops.append(c); continue; }
      const sy = h('div', 'sys', o.sys || L('(목표 성계)', '(target system)')); sy.dataset.i18nSkip = ''; c.append(sy);
      c.append(h('span', 'st s' + o.st, L(...(OPST[o.st] || ['?', '?'])) + (o.st === 1 ? L(` · ${o.m}달째`, ` · month ${o.m}`) : '')));
      const ratio = o.en > 0 ? Math.min(1, o.pow / (o.pow + o.en)) : 1, bar = h('div', 'fo-bar'), fill = h('i'); fill.style.width = Math.round(ratio * 100) + '%'; bar.append(fill); c.append(bar);
      c.append(h('small', '', L(`우리 ${fmt(o.pow)} · 적 ${fmt(o.en)} · 함대 ${o.cnt}개`, `Ours ${fmt(o.pow)} · enemy ${fmt(o.en)} · ${o.cnt} fleet(s)`)));
      const ld = h('small', '', L(`지휘 ${o.adm ? o.adm + ' 제독' : o.fleet || '—'}${o.at ? ' · ' + o.at : ''}`, `Led by ${o.adm ? 'Admiral ' + o.adm : o.fleet || '—'}${o.at ? ' · at ' + o.at : ''}`)); ld.dataset.i18nSkip = ''; c.append(ld);
      ops.append(c);
    }
    body.append(ops);

    // 합동 작전: 동맹 함대 빌려 오기 · 원정군 파견
    body.append(h('p', 'th', L('합동 작전', 'JOINT OPERATIONS')));
    if (!(A.allies || []).length) body.append(h('p', 'fo-note', L('함께 싸울 동맹이 없습니다. 연방 회원국·방위 조약국, 또는 같은 전쟁에 같은 편으로 들어온 나라에게 함대를 빌려 달라고 할 수 있습니다.', 'No partner available. Federation members, defensive-pact partners, or empires fighting on our side in the same war can be asked to lend fleets.')));
    else {
      const ai = h('input'); ai.type = 'text'; ai.maxLength = 300; ai.value = allyAsk; ai.placeholder = L('요청에 덧붙일 말(선택) — 예: 공동의 적 ○○를 함께 치자', 'Add a word to the request (optional) — e.g. Let us strike our common enemy together'); ai.oninput = () => { allyAsk = ai.value; };
      ai.style.cssText = 'width:100%;margin:0 0 6px;background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:5px 8px;color:var(--text)'; body.append(ai);
      for (const a of A.allies) {
        const r = h('div', 'fo-ally'), nm = h('b', '', a.name); nm.dataset.i18nSkip = '';
        const info = h('span', '', `${a.rel} · ${L('호감', 'Opinion')} ${a.op}`); info.append(h('br'), h('small', '', L(`내줄 수 있는 함대 ${a.n}개 · 전력 ${fmt(a.pow)}`, `${a.n} fleet(s) free · power ${fmt(a.pow)}`)));
        const ch = h('span', '', a.lend ? L('합류 중', 'With us') : `${a.chance}%`); ch.title = L('수락 확률(호감·신뢰·관계·같은 전쟁)', 'Chance to accept (opinion, trust, relationship, shared war)');
        let b;
        if (a.lend) { b = h('button', 'btn sub', L('돌려보내기', 'Send home')); b.onclick = () => { if (confirm(L(`${a.name}의 함대를 계약보다 먼저 돌려보낼까요?`, `Send the fleets of ${a.name} home early?`))) act(() => window.sllm.foAllyReturn(a.idx)); }; }
        else if (a.cool) { b = h('button', 'btn sub', L('거절당함', 'Refused')); b.disabled = true; b.title = L(`${a.cool}에 거절 — 2년 뒤 다시`, `Refused on ${a.cool} — try again in two years`); }
        else { b = h('button', 'btn', A.thinking ? L('답을 기다리는 중…', 'Awaiting reply…') : L(`함대 ${a.ask}개 요청(1년)`, `Ask for ${a.ask} fleet(s) (1 year)`)); b.disabled = busy || A.thinking || !A.running || a.n < 1; b.onclick = () => act(async () => { const r = await window.sllm.foAllyAsk(a.idx, allyAsk); if (r && r.ok) allyAsk = ''; return r; }); }
        if (b !== undefined) { if (!a.lend && !a.cool) b.disabled = b.disabled || busy; }
        r.append(nm, info, ch, b); body.append(r);
      }
      // 원정군 파견
      const own = (A.fleets || []).filter((f) => f.mode !== 4 && f.mode !== 2);
      if (own.length) {
        const ln = h('div', 'fo-lend'), fs = h('select'), as = h('select');
        for (const f of own) { const o = h('option', '', `${f.fleet}${f.adm ? ' · ' + f.adm : ''} (${fmt(f.pow)})`); o.value = String(f.fid); if (f.fid === lendFid) o.selected = true; fs.append(o); }
        for (const a of A.allies) { const o = h('option', '', a.name); o.value = String(a.idx); if (a.idx === lendIdx) o.selected = true; as.append(o); }
        fs.dataset.i18nSkip = ''; as.dataset.i18nSkip = ''; fs.onchange = () => { lendFid = Number(fs.value); }; as.onchange = () => { lendIdx = Number(as.value); };
        const lb = h('button', 'btn sub', L('원정군 보내기(1년)', 'Send expeditionary force (1 year)')); lb.disabled = busy || !A.running;
        lb.onclick = () => { const fid = Number(fs.value), idx = Number(as.value); if (confirm(L('이 함대를 1년 동안 동맹에게 빌려줄까요? 그 나라 AI 가 지휘하고, 받은 나라의 호감이 오릅니다.', 'Lend this fleet to the ally for a year? Their AI will command it, and their opinion of us rises.'))) act(() => window.sllm.foLend(fid, idx)); };
        ln.append(h('span', '', L('원정군 파견:', 'Expeditionary force:')), fs, h('span', '', '→'), as, lb); body.append(ln);
      }
      for (const x of A.lent || []) { const p2 = h('p', 'fo-note', L(`파견 중: ${x.fleet}${x.adm ? ' (' + x.adm + ')' : ''} → ${x.to}`, `Deployed: ${x.fleet}${x.adm ? ' (' + x.adm + ')' : ''} → ${x.to}`)); p2.dataset.i18nSkip = ''; body.append(p2); }
      body.append(h('p', 'fo-note', L('빌려 온 함대는 「연합군」으로 우리 자동 작전에 들어갑니다. 잃으면 그 나라의 호감이 떨어지고(−30), 하나도 잃지 않고 돌려주면 오릅니다(+15). 거절당하면 2년 동안 다시 청할 수 없습니다.', 'Borrowed fleets join our automated operations as "Allied". Losing one lowers their opinion (−30); returning all of them intact raises it (+15). After a refusal you must wait two years to ask again.')));
    }

    // 함대 목록
    body.append(h('p', 'th', L('군 함대', 'MILITARY FLEETS')));
    if (!(A.fleets || []).length) body.append(h('p', 'fo-note', A.running ? L('아직 읽은 함대가 없습니다. ⟳를 눌러 주세요.', 'No fleets read yet. Press ⟳.') : L('게임이 켜지면 함대 목록을 읽습니다.', 'The fleet list is read while the game is running.')));
    else {
      const hd = h('div', 'fo-fl hd'); for (const t of [L('함대', 'Fleet'), L('제독 · 위치', 'Admiral · location'), L('전력', 'Power'), L('상태', 'Status'), '']) hd.append(h('span', '', t)); body.append(hd);
      for (const f of A.fleets) {
        const r = h('div', 'fo-fl'), nm = h('span', '', f.fleet); nm.dataset.i18nSkip = ''; nm.title = f.fleet;
        const ad = h('span', '', [f.adm, f.at, f.mode === 4 && f.own ? L(`${f.own} 소속`, `from ${f.own}`) : ''].filter(Boolean).join(' · ') || '—'); ad.dataset.i18nSkip = '';
        const tag = f.op > 0 && f.mode === 0 ? h('span', 'fo-tag op', L(`작전 ${f.op}`, `Op ${f.op}`)) : h('span', 'fo-tag m' + f.mode, L(...(MODE[f.mode] || MODE[0])) + (f.mode === 3 ? ` ${f.op}` : ''));
        const manual = f.mode === 1;
        const b = h('button', 'btn sub', manual ? L('제독 재량에 맡기기', 'Hand to admiral') : L('직접 지휘', 'Take command'));
        b.title = manual ? L('자동 작전이 이 함대를 다시 쓸 수 있습니다.', 'Automated operations may use this fleet again.') : L('이 함대는 자동 작전에서 빠지고, 이동 명령도 지웁니다.', 'This fleet leaves automated operations and its move order is cleared.');
        b.disabled = busy || A.busy || !A.running; b.onclick = () => act(() => window.sllm.foFleet(f.fid, !manual));
        r.append(nm, ad, h('span', '', fmt(f.pow)), tag, b); body.append(r);
      }
    }
    if (A.reportDate) body.append(h('p', 'fo-note', L(`게임 날짜 ${A.reportDate}에 읽음`, `Read on game date ${A.reportDate}`)));

    // 끝난 작전 · 결과 보고서(LLM 1번, 누를 때만)
    const done = (A.recs || []).filter((x) => x.end);
    if (done.length) {
      body.append(h('p', 'th', L('지난 작전', 'PAST OPERATIONS')));
      for (const x of done) {
        const d = h('div', 'fo-rec ' + x.result), top = h('div');
        const t = h('span', '', L(`${x.sys || '(목표)'} · ${(RES[x.result] || ['?'])[0]} · ${x.start} ~ ${x.end}${x.adm ? ' · ' + x.adm + ' 제독' : ''}`, `${x.sys || '(target)'} · ${(RES[x.result] || ['?', '?'])[1]} · ${x.start} – ${x.end}${x.adm ? ' · Admiral ' + x.adm : ''}`)); t.dataset.i18nSkip = ''; top.append(t);
        const b = h('button', 'btn sub', x.report ? (repOpen === x.id ? L('보고서 접기', 'Hide report') : L('보고서 보기', 'Show report')) : (A.thinking ? L('작성 중…', 'Writing…') : L('보고서 받기', 'Get report')));
        b.disabled = busy || (!x.report && A.thinking); b.onclick = () => { if (x.report) { repOpen = repOpen === x.id ? '' : x.id; draw(); } else { repOpen = x.id; act(() => window.sllm.foReport(x.id)); } };
        top.append(b); d.append(top);
        if (x.report && repOpen === x.id) { const rp = h('div', 'fo-rep'); rp.dataset.i18nSkip = ''; rp.append(h('b', '', x.report.title || L('작전 결과 보고', 'After-action report')), h('div', '', x.report.body)); d.append(rp); }
        body.append(d);
      }
    }

    // 무전 기록
    body.append(h('p', 'th', L('제독 무전', 'ADMIRAL RADIO')));
    if (!(A.log || []).length) body.append(h('p', 'fo-note', L('아직 무전이 없습니다.', 'No radio traffic yet.')));
    const lg = h('div', 'fo-log');
    let talkShown = false;
    for (const e of A.log || []) {
      const d = h('div', 'ln admiral'), w = h('b', '', e.who); w.append(h('small', '', e.date)); const t = h('div', '', e.text); d.dataset.i18nSkip = ''; d.append(w, t);
      // 무전에 답하기(그 제독과 1:1 — 신뢰·기억이 남는다). 가장 최근 무전 하나에만 대화 칸을 연다.
      if (e.lid) {
        if (talkLid === e.lid && !talkShown) {
          talkShown = true;
          const tk = h('div', 'fo-talk'), tl = (A.talks || []).find((x) => x.lid === e.lid);
          for (const l of (tl ? tl.lines : [])) tk.append(h('div', l.who === 'me' ? 'me' : 'them', (l.who === 'me' ? L('나: ', 'Me: ') : e.who + ': ') + l.text));
          const ti = h('textarea'); ti.maxLength = 500; ti.value = talkDraft; ti.placeholder = L('무전으로 답하기…', 'Reply over the radio…'); ti.oninput = () => { talkDraft = ti.value; };
          const row = h('div', 'act'), sb = h('button', 'btn', A.thinking ? L('응답 기다리는 중…', 'Waiting…') : L('보내기', 'Send')), eb = h('button', 'btn sub', L('무전 끝', 'End'));
          sb.disabled = busy || A.thinking; sb.onclick = () => { const v = ti.value.trim(); if (!v) return; act(async () => { const r = await window.sllm.foTalk(e.lid, v); if (r && r.ok) talkDraft = ''; return r; }); };
          eb.onclick = () => { talkLid = 0; talkDraft = ''; act(() => window.sllm.foTalkEnd(e.lid).then((s) => ({ ok: true, state: s }))); };
          row.append(sb, eb); tk.append(ti, row); d.append(tk);
        } else if (!talkShown || talkLid !== e.lid) {
          const row = h('div', 'act'), rb = h('button', 'btn sub', L('답하기', 'Reply')); rb.onclick = () => { talkLid = e.lid; talkDraft = ''; draw(); }; row.append(rb); d.append(row);
        }
      }
      lg.append(d);
    }
    body.append(lg);
    body.append(h('p', 'fo-note', L('작전은 최대 3개까지 함께 돌아갑니다. 수도에서 가장 가까운, 우리 전력(적의 1.2배 이상)으로 이길 수 있는 적 성계를 고르고 적 식민지가 있는 성계를 먼저 칩니다. 집결은 최대 5달, 적이 우리보다 세지면 수도로 물러납니다. 직접 지휘로 둔 함대는 건드리지 않습니다. 기준(전력 배수·수리 체력·작전 수·반경·우선 목표)과 조건(적 요새 피하기·우리 영토 안에서만·끝까지 추격)은 「작전 지시」로 바꿀 수 있습니다. 지상군 자동 상륙은 아직 없습니다.', 'Up to 3 operations run at once. Each picks the enemy system closest to the capital that our strength (1.2× the enemy or more) can take, enemy colony systems first. Rallying lasts up to 5 months; if the enemy outguns us, the fleets fall back to the capital. Fleets set to manual are never touched. The thresholds (strength ratio, repair hull, number of operations, range, priority target) and conditions (avoid enemy fortresses, our territory only, pursue to the end) can be changed with Standing orders. Automatic army landings are not in yet.')));
  }

  window.SLLMFleetOrder = {
    show(p) { pane = p; active = true; draw(); window.sllm.foState().then((s) => { A = s; draw(); }).catch(() => {}); },
    hide() { active = false; },
    redraw() { draw(); },
  };
  if (window.sllm && window.sllm.onFoUpdate) window.sllm.onFoUpdate((s) => { A = s; if (!busy) draw(); });
})();
