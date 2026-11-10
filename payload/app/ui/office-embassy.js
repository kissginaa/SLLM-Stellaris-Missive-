// 집무실 「대사관」 화면(2026-10-19). 앱: src/features/embassy-app.ts, 규칙·예측: src/embassy.ts.
// office.html 은 이 파일·css 만 더하고, 아이콘(「시민 청원」 옆)·빈 칸(#embassy)·그리기는 모두 여기서 한다(집무실 다른 작업과 파일 충돌을 줄이려고).
// 언어 팩 규칙: 문구는 L('한국어', 'English')(SLLMI18n.pick)으로만.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const btn = (cls, text, fn) => { const b = h('button', cls, text); b.type = 'button'; b.onclick = fn; return b; };
  let S = null, D = null, cur = 0, err = '', busy = '', tab = 'emb', OP = null, talkDraft = '', openLetter = 0; // OP: 은하 여론(규탄 성명 기록, 2026-10-20)
  const show = (id) => { if (!document.getElementById(id)) return; for (const v of document.querySelectorAll('.view')) v.classList.toggle('on', v.id === id); }; // 없는 화면으로 가면 모든 화면이 꺼져 빈 홀로그램만 남는다(2026-10-29 테스터)
  async function load() { try { S = await window.sllm.embassyState(); } catch (e) { S = null; } if (cur && !D) { try { D = await window.sllm.embassyDetail(cur); } catch (e) { D = null; } } draw(); }
  async function pickIdx(idx) { cur = idx; err = ''; try { D = await window.sllm.embassyDetail(idx); } catch (e) { D = null; } draw(); }
  async function run(kind, fn) {
    if (busy) return; busy = kind; err = ''; draw();
    try { const r = await fn(); if (r && r.state) S = r.state; if (r && r.detail) D = r.detail; if (r && !r.ok) err = r.error || ''; } catch (e) { err = String(e && e.message || e); }
    busy = ''; draw();
  }
  async function loadOpinion() { try { OP = await window.sllm.condemnList(); } catch (e) { OP = { verdicts: [], labels: {} }; } draw(); }
  // 은하 여론: 우리 전쟁마다 은하 공동체와 각국이 낸 입장(규탄 성명 기록). 최근 것 먼저.
  function drawOpinion(root) {
    const wrap = h('div', 'emb-op'); root.append(wrap);
    const top = h('div', 'emb-hd'); top.append(h('h4', '', L('은하 여론 — 우리 전쟁에 대한 각국의 입장', 'Galactic opinion — how others reacted to our wars')));
    top.append(btn('emb-btn sm', L('대사관으로 돌아가기', 'Back to embassies'), () => { tab = 'emb'; OP = null; draw(); })); wrap.append(top);
    if (!OP) { wrap.append(h('p', 'emb-empty', L('불러오는 중…', 'Loading…'))); return; }
    const V = OP.verdicts || [], Lb = OP.labels || {};
    if (!V.length && !(OP.ours || []).length) { wrap.append(h('p', 'emb-empty', L('아직 기록이 없습니다. 전쟁이 시작되면 선언문을 발표한 뒤(또는 얼마 뒤) 은하 공동체와 각국의 반응이 이곳에 쌓입니다.', 'No record yet. When a war begins, the reactions of the Galactic Community and other empires gather here after your declaration (or a little later).'))); return; }
    for (const v of V) {
      const sec = h('section', 'emb-opv');
      const hd = h('div', 'emb-oph'); hd.append(h('b', '', v.war), h('span', '', v.date + ' · ' + (v.side === 'def' ? L('방어전', 'defensive war') : L('공격전', 'offensive war'))));
      sec.append(hd);
      const cnt = h('div', 'emb-opc'); for (const k of ['condemn', 'concern', 'support', 'silent']) if (v.counts && v.counts[k]) cnt.append(h('span', 'st-' + k, (Lb[k] || k) + ' ' + v.counts[k])); sec.append(cnt);
      if (v.galcom && v.galcom.stance !== 'silent') { const g = h('div', 'emb-opr st-' + v.galcom.stance); g.append(h('b', '', L('은하 공동체', 'Galactic Community') + ' — ' + (Lb[v.galcom.stance] || v.galcom.stance))); if (v.galcom.text) g.append(h('q', '', v.galcom.text)); sec.append(g); }
      for (const r of v.reactions || []) { const it = h('div', 'emb-opr st-' + r.stance); it.append(h('b', '', r.name + ' — ' + (Lb[r.stance] || r.stance))); if (r.text) it.append(h('q', '', r.text)); sec.append(it); }
      wrap.append(sec);
    }
    // 우리가 남의 전쟁에 낸 성명(방향 2): 상대 제국이 기억해 나중에 되갚는다.
    const OS = OP.ours || [];
    if (OS.length) {
      wrap.append(h('h4', 'emb-oph2', L('우리 정부의 성명 — 다른 나라들의 전쟁에 대해', 'Our government\'s statements — on other empires\' wars')));
      for (const o of OS) { const it = h('div', 'emb-opr st-' + o.stance); it.append(h('b', '', o.war + ' — ' + (Lb[o.stance] || o.stance)), h('small', 'emb-opd', o.date + ' · ' + o.attacker + ' → ' + o.defender)); if (o.text) it.append(h('q', '', o.text)); wrap.append(it); }
      wrap.append(h('p', 'emb-note', L('성명을 받은 나라들은 이를 기억합니다. 나중에 우리가 전쟁을 열면 그때 했던 말로 되갚을 수 있습니다.', 'The empires we spoke about remember it. When we go to war later, they may throw our own words back at us.')));
    }
    const sw = h('label', 'emb-opsw'), c = h('input'); c.type = 'checkbox'; c.checked = !!OP.applyOpinion; c.onchange = () => { window.sllm.condemnApplyOpinion(c.checked).catch(() => {}); };
    sw.append(c, h('span', '', L('규탄·지지 성명을 게임 호감도에 작게 반영', 'Apply condemnation and support statements to in-game opinion (small)'))); wrap.append(sw);
    const sw2 = h('label', 'emb-opsw'), c2 = h('input'); c2.type = 'checkbox'; c2.checked = OP.foreignNotify !== false; c2.onchange = () => { window.sllm.foreignNotify(c2.checked).catch(() => {}); };
    sw2.append(c2, h('span', '', L('다른 나라들의 큰 전쟁이 터지면 성명을 낼지 묻기', 'Ask me to issue a statement when a major war breaks out between other empires'))); wrap.append(sw2);
  }
  function draw() {
    const root = $('embRoot'); if (!root || !$('embassy').classList.contains('on')) return; root.textContent = ''; root.dataset.i18nSkip = '';
    if (tab === 'opn') { { const tt = $('embTitle'); if (tt) tt.textContent = L('은하 여론', 'Galactic Opinion'); } drawOpinion(root); return; }
    { const tt = $('embTitle'); if (tt) tt.textContent = tab === 'spy' ? L('첩보 보고', 'Espionage Reports') : L('대사관 보고', 'Embassy Reports'); }
    const wrap = h('div', 'emb-main'); root.append(wrap);
    if (!S || !S.sid) { wrap.append(h('p', 'emb-empty', L('세이브를 불러오면 각국 대사관의 보고가 이곳에 옵니다.', 'Load a save and reports from your embassies will arrive here.'))); return; }
    const side = h('div', 'emb-side'), main = h('div', 'emb-body'); wrap.append(side, main);
    const sh = h('div', 'emb-sh'); sh.append(h('b', '', tab === 'spy' ? L('대상 국가', 'Target empires') : L('주재 대사관', 'Embassies')));
    const rb = btn('emb-btn sm', busy === 'list' ? L('갱신 중…', 'Refreshing…') : L('목록 갱신', 'Refresh list'), () => run('list', () => window.sllm.embassyContacts())); rb.disabled = !!busy || !S.running; sh.append(rb); side.append(sh);
    if (tab !== 'spy') side.append(btn('emb-btn sm emb-opbtn', L('은하 여론 보기', 'Galactic opinion'), () => { tab = 'opn'; OP = null; draw(); loadOpinion(); }));
    if (!S.contacts.length) side.append(h('p', 'emb-empty', L('통신 중인 제국이 없습니다. 「목록 갱신」을 눌러 주세요(게임이 켜져 있어야 합니다).', 'No empires in contact. Press "Refresh list" (the game must be running).')));
    for (const c of S.contacts) {
      const it = h('button', 'emb-item' + (c.idx === cur ? ' on' : '')); it.type = 'button'; it.onclick = () => pickIdx(c.idx);
      it.append(h('span', 'nm', c.name));
      if (c.alert) it.append(h('span', 'alert', '⚠')); it.title = c.alert ? L('지난 보고 이후 나빠진 점이 있습니다', 'Things have worsened since the last report') : '';
      if (tab !== 'spy' && c.due) { const d = h('span', 'due', '✉'); d.title = L('정기 보고 도착', 'Annual report arrived'); it.append(d); } // 정기 공식 보고(2026-10-20)
      if (tab === 'spy' && c.mail) { const d = h('span', 'due', '✉'); d.title = L('공작원 서신 도착', 'Dispatch from the agent'); it.append(d); } // 공작원 서신(2026-10-20)
      it.append(c.level ? h('span', 'lv lv-' + c.level, c.levelName) : h('span', 'lv none', L('보고 없음', 'No report')));
      side.append(it);
    }
    if (err) main.append(h('div', 'emb-err', err));
    const sel = S.contacts.find((c) => c.idx === cur);
    if (!sel) { main.append(h('p', 'emb-empty', L('왼쪽에서 제국을 고르세요. 대사관은 그 나라의 파벌 동향과 우리에 대한 움직임을 보고합니다. 첩보 수준이 높을수록 더 많은 것을 알 수 있습니다.', 'Pick an empire on the left. The embassy reports on its factions and its moves toward us. The higher our intel, the more we can see.'))); return; }
    const hd = h('div', 'emb-hd'); hd.append(h('h4', '', sel.name));
    const pb = btn('emb-btn', busy === 'probe' ? L('받는 중…', 'Receiving…') : L('최신 정보 받기', 'Get latest information'), () => run('probe', () => window.sllm.embassyProbe(cur))); pb.disabled = !!busy || !S.running; hd.append(pb); main.append(hd);
    if (!D || D.idx !== cur) { main.append(h('p', 'emb-empty', L('아직 받은 보고가 없습니다. 「최신 정보 받기」를 눌러 주세요(게임이 켜져 있어야 합니다).', 'No report yet. Press "Get latest information" (the game must be running).'))); return; }
    const meta = h('div', 'emb-meta'); meta.append(h('span', '', L('기준 날짜 ', 'As of ') + D.date), h('span', '', L('첩보 수준 ', 'Intel level ') + D.intelName)); main.append(meta);
    // 알파 9: 두 갈래 — 대사관(공식 경로)과 첩보(비밀 경로). 두 보고가 서로 다를 수 있다.
    const tabs = h('div', 'emb-tabs');
    for (const [k, label] of [['emb', L('대사관 보고', 'Embassy report')], ['spy', L('첩보 보고', 'Espionage report')]]) { const t = btn('emb-tab' + (tab === k ? ' on' : ''), label, () => { tab = k; draw(); }); tabs.append(t); }
    main.append(tabs);
    const O = D.official, X = D.secret;
    const sigList = (arr, withRumor) => { const ul = h('ul', 'emb-sig'); for (const s of arr) { const li = h('li', s.weight > 0 ? 'up' : 'down', s.text); if (withRumor && s.rumor) li.append(h('em', 'rumor', ' ' + L('(확인되지 않은 소문)', '(unconfirmed rumor)'))); ul.append(li); } return ul; };
    const forecast = (title, lvName, level, threat, signals, withRumor) => {
      const pr = h('section', 'emb-pred lv-' + level); pr.append(h('div', 'emb-ph', title));
      const bar = h('div', 'emb-bar'); const fill = h('i'); fill.style.width = Math.max(3, threat) + '%'; bar.append(fill);
      const lvl = h('div', 'emb-lvl'); lvl.append(h('b', '', lvName), h('span', '', L('위협 ', 'Threat ') + threat + ' / 100')); pr.append(lvl, bar);
      const ul = sigList(signals, withRumor); if (!signals.length) ul.append(h('li', 'none', L('눈에 띄는 징후가 없습니다.', 'No notable signs.'))); pr.append(ul);
      return pr;
    };
    const changeBox = (list, prevDate, monthly) => {
      if (!list.length) return null;
      const bad = list.some((c) => c.worse), box = h('section', 'emb-chg' + (bad ? ' bad' : ''));
      box.append(h('div', 'emb-ph', monthly ? (bad ? '⚠ ' + L('경보 — 두 달 사이 달라진 점', 'Alert — changes over the last two months') : L('두 달 사이 달라진 점', 'Changes over the last two months')) : (bad ? '⚠ ' + L('경보 — 지난 보고 이후 달라진 점', 'Alert — changes since the last report') : L('지난 보고 이후 달라진 점', 'Changes since the last report')) + (prevDate ? ' · ' + prevDate : '')));
      const ul = h('ul', 'emb-sig'); for (const c of list) ul.append(h('li', c.worse ? 'up' : 'down', (c.worse ? '▼ ' : '▲ ') + c.text)); box.append(ul); return box;
    };
    // 우리에 대한 호감 추이(두 달 간격 감시 기록, 2026-10-20 초안): 점이 둘 이상일 때만 그린다.
    const trend = (series) => {
      if (!series || series.length < 2) return null;
      const sec = h('section', 'emb-trend'); sec.append(h('div', 'emb-ph', L('우리에 대한 호감 추이 (두 달 간격)', 'Their opinion of us over time (every two months)')));
      const W = 320, H = 90, P = 6, ns = 'http://www.w3.org/2000/svg', vals = series.map((p) => p.op);
      let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals); if (hi - lo < 40) { hi += 20; lo -= 20; }
      const X = (i) => P + (W - 2 * P) * (series.length === 1 ? 0 : i / (series.length - 1)), Y = (v) => P + (H - 2 * P) * (1 - (v - lo) / (hi - lo));
      const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('class', 'emb-spark'); svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', L('호감 추이 그래프', 'Opinion trend graph'));
      const zero = document.createElementNS(ns, 'line'); zero.setAttribute('x1', P); zero.setAttribute('x2', W - P); zero.setAttribute('y1', Y(0)); zero.setAttribute('y2', Y(0)); zero.setAttribute('class', 'zero'); svg.append(zero);
      const line = document.createElementNS(ns, 'polyline'); line.setAttribute('points', vals.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ')); svg.append(line);
      const last = vals.length - 1, dot = document.createElementNS(ns, 'circle'); dot.setAttribute('cx', X(last)); dot.setAttribute('cy', Y(vals[last])); dot.setAttribute('r', 3); svg.append(dot);
      sec.append(svg);
      sec.append(h('small', '', series[0].date + ' → ' + series[last].date + ' · ' + L('지금 ', 'Now ') + vals[last] + ' (' + L('최저 ', 'low ') + Math.min(...vals) + ', ' + L('최고 ', 'high ') + Math.max(...vals) + ')'));
      return sec;
    };
    const cable = (title, rep, emptyText, btnText, kind, fn, off) => {
      const rp = h('section', 'emb-rep'); rp.append(h('div', 'emb-ph', title));
      if (rep) {
        rp.append(h('h5', '', rep.headline), h('p', '', rep.summary));
        if (rep.outlook) { const o = h('p', 'out'); o.append(h('b', '', L('전망 · ', 'Outlook · ')), document.createTextNode(rep.outlook)); rp.append(o); }
        if (rep.advice) { const a = h('p', 'adv'); a.append(h('b', '', L('건의 · ', 'Advice · ')), document.createTextNode(rep.advice)); rp.append(a); }
        rp.append(h('small', '', L('작성 ', 'Written ') + rep.date));
      } else rp.append(h('p', 'emb-empty', emptyText));
      const ab = btn('emb-btn', busy === kind ? L('작성 중…', 'Writing…') : btnText, fn); ab.disabled = !!busy || !!off; rp.append(ab);
      return rp;
    };
    if (tab === 'emb') {
      const XP = D.expel; // 대사 추방(2026-10-20 알파 9)
      if (XP && XP.active) {
        const xs = h('section', 'emb-expel'); xs.append(h('div', 'emb-ph', L('대사 추방', 'Ambassador expelled')));
        xs.append(h('b', '', L(`${XP.date} — 대사 ${XP.amb} 추방 (${XP.why})`, `${XP.date} — Ambassador ${XP.amb} expelled (${XP.why})`)));
        xs.append(h('p', 'emb-note', L('관계가 회복될 때까지(전쟁이 끝나고 호감 0 이상) 대사관 전문은 끊깁니다. 회복되면 새 대사가 부임합니다. 첩보 보고는 그대로 받을 수 있습니다.', 'Embassy cables stop until relations recover (no war and opinion 0 or better); then a new ambassador is posted. Espionage reports still work.')));
        if (XP.cable) { const c = XP.cable; xs.append(h('div', 'emb-ph', L('마지막 전문', 'Last cable'))); xs.append(h('b', '', c.headline)); xs.append(h('p', '', c.summary)); if (c.outlook) xs.append(h('p', 'out', L('전망 · ', 'Outlook · ') + c.outlook)); if (c.advice) xs.append(h('p', 'adv', L('건의 · ', 'Advice · ') + c.advice)); }
        else xs.append(h('p', 'emb-empty', L('대사의 마지막 전문을 기다리는 중입니다.', 'Waiting for the ambassador\'s last cable.')));
        main.append(xs); return;
      }
      if (XP && XP.back) main.append(h('p', 'emb-note', L(`${XP.date} 대사 추방(${XP.why}) → ${XP.back} 대사관 재개.`, `${XP.date} ambassador expelled (${XP.why}) → embassy reopened ${XP.back}.`)));
      if (!O.available) { main.append(h('p', 'emb-empty', L('이 나라에는 우리 대사관이 없습니다. 대사관이 있어야 공식 보고를 받을 수 있습니다. 비밀 정보는 「첩보 보고」에서 볼 수 있습니다.', 'We have no embassy there, so there is no official report. Secret information is in the "Espionage report" tab.'))); return; }
      main.append(h('p', 'emb-note', L('대사관이 보는 것은 공개된 태도·조약·영유권·여론·파벌뿐입니다. 함대와 속내는 첩보 보고에서 확인하세요.', 'An embassy sees only open stances, treaties, claims, public opinion and factions. For fleets and intentions, see the espionage report.')));
      const cb1 = changeBox(D.changes.official, D.changes.prevDate); if (cb1) main.append(cb1); const mb1 = changeBox(D.monthly ? D.monthly.official : [], '', true); if (mb1) main.append(mb1); const tr = trend(D.series); if (tr) main.append(tr);
      if (D.warStance) { const ws = h('section', 'emb-opr st-' + D.warStance.stance); ws.append(h('div', 'emb-ph', L('우리 전쟁에 대한 이 나라의 공개 입장', 'This government\'s public stance on our war') + ' · ' + D.warStance.war)); ws.append(h('b', '', D.warStance.label)); if (D.warStance.text) ws.append(h('q', '', D.warStance.text)); main.append(ws); }
      main.append(forecast(L('공식 전망', 'Official outlook'), O.levelName, O.level, O.threat, O.signals, false));
      const fa = h('section', 'emb-fac'); fa.append(h('div', 'emb-ph', L('파벌 동향', 'Factions')));
      if (O.factions.length) { const fl = h('ul'); for (const f of O.factions) fl.append(h('li', '', f)); fa.append(fl); } else fa.append(h('p', 'emb-empty', L('파벌이 없거나(군체·기계 등) 보고되지 않았습니다.', 'No factions (hive/machine, etc.) or none reported.')));
      main.append(fa);
      main.append(cable(L('대사 전문', 'Ambassador\'s cable') + (D.amb ? ' · ' + D.amb.name + (D.amb.manner ? ' (' + D.amb.manner + ')' : '') : '') + (D.due ? ' · ' + L('정기 보고 도착', 'Annual report arrived') : ''), D.report, L('대사에게 이 자료로 전문을 써 달라고 할 수 있습니다(AI 사용).', 'You can ask the ambassador to write a cable from this information (uses AI).'), D.report ? L('전문 다시 받기', 'Request a new cable') : L('대사 전문 받기', 'Request a cable'), 'report', () => run('report', () => window.sllm.embassyReport(cur)), false));
      if (D.canTalk) { // 상주 대사와 대화(2026-10-20 알파 9): 상대 원수가 응하지 않아도 우리 대사와는 이야기한다
        const tk = h('section', 'emb-talk'); tk.append(h('div', 'emb-ph', L('대사와 대화', 'Talk with the ambassador') + (D.amb ? ' · ' + D.amb.name : '')));
        tk.append(h('p', 'emb-note', L('상대 원수가 통신에 응하지 않아도 우리 대사와는 이야기할 수 있습니다. 대사는 대사관이 공식으로 아는 것만 알고, 게임에는 아무것도 하지 않습니다(AI 사용).', 'Even when their ruler will not answer, you can speak with our ambassador. The ambassador knows only what the embassy sees openly, and nothing here changes the game (uses AI).')));
        const log = h('div', 'emb-tlog');
        for (const t of D.talk || []) { const me = h('div', 'me'); me.append(h('b', '', L('나', 'Me')), document.createTextNode(t.me)); const th = h('div', 'them'); th.append(h('b', '', D.amb ? D.amb.name : L('대사', 'Ambassador')), document.createTextNode(t.them)); log.append(me, th); }
        if (!(D.talk || []).length) log.append(h('p', 'emb-empty', L('아직 나눈 이야기가 없습니다.', 'No conversation yet.')));
        tk.append(log);
        const ta = h('textarea', 'emb-tin'); ta.maxLength = 600; ta.rows = 2; ta.value = talkDraft; ta.placeholder = L('대사에게 물어볼 것을 적으세요…', 'Ask the ambassador something…'); ta.oninput = () => { talkDraft = ta.value; };
        const send = btn('emb-btn', busy === 'talk' ? L('답을 기다리는 중…', 'Waiting for a reply…') : L('보내기', 'Send'), () => { const t = talkDraft.trim(); if (!t) return; run('talk', async () => { const r = await window.sllm.embassyTalk(cur, t); if (r && r.ok) talkDraft = ''; return r; }); });
        send.disabled = !!busy; ta.onkeydown = (ev) => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) send.click(); };
        const row = h('div', 'emb-trow'); row.append(ta, send); tk.append(row); main.append(tk);
      }
    } else {
      if (!X.available) { main.append(h('p', 'emb-empty', L('첩보망이 이 나라에 닿지 않습니다. 첩보망을 키우면 요원의 보고가 옵니다.', 'Our network does not reach this empire. Grow your espionage network and agents will report.'))); if (X.agent) main.append(agentCard(X.agent)); return; }
      main.append(h('p', 'emb-note', L('요원들이 모은 비밀 정보입니다. 첩보 수준이 낮을수록 확인되지 않은 소문이 섞이고, 대사관의 공식 보고와 다를 수 있습니다.', 'Secret information gathered by our agents. The lower our intel, the more is unconfirmed rumor, and it may differ from the embassy\'s official report.')));
      const meta2 = h('div', 'emb-meta'); meta2.append(h('span', '', L('신뢰도 ', 'Confidence ') + X.confidence)); main.append(meta2);
      const cb2 = changeBox(D.changes.secret, D.changes.prevDate); if (cb2) main.append(cb2); const mb2 = changeBox(D.monthly ? D.monthly.secret : [], '', true); if (mb2) main.append(mb2);
      main.append(forecast(L('비밀 위협 평가', 'Secret threat assessment'), X.levelName, X.level, X.threat, X.signals, true));
      if (X.hidden > 0) main.append(h('p', 'emb-hidden', L(`첩보가 부족해 알아내지 못한 것이 ${X.hidden}가지 있습니다. 첩보망을 키우면 보입니다.`, `${X.hidden} thing(s) remain unknown for lack of intel. Grow your espionage network to see them.`)));
      const fa = h('section', 'emb-fac'); fa.append(h('div', 'emb-ph', L('파벌 지지율', 'Faction support')));
      if (X.factions.length) { const fl = h('ul'); for (const f of X.factions) fl.append(h('li', '', f)); fa.append(fl); } else fa.append(h('p', 'emb-empty', L('파벌이 없거나(군체·기계 등) 보고되지 않았습니다.', 'No factions (hive/machine, etc.) or none reported.')));
      main.append(fa);
      if (X.ops) { // 파벌 지원·공작(2026-10-28 하츠 참고): 그 나라 파벌 하나에 2년간 몰래 자금을 댄다
        const OP2 = X.ops, op = h('section', 'emb-fac emb-ops'); op.append(h('div', 'emb-ph', L('파벌 공작', 'Faction operation')));
        if (OP2.against) op.append(h('p', 'emb-chg bad', L(`이 나라가 우리 ${OP2.against.ethName} 파벌을 몰래 지원해 왔습니다(${OP2.against.since}부터, ${OP2.against.revealed}에 드러남).`, `This empire has been secretly funding our ${OP2.against.ethName} faction (since ${OP2.against.since}, exposed ${OP2.against.revealed}).`)));
        if (OP2.active) op.append(h('p', 'emb-note', L(`진행 중: ${OP2.active.faction}(${OP2.active.ethName}) 지원 · ${OP2.active.since} ~ ${OP2.active.until}${OP2.active.exposed ? ` · ${OP2.active.exposed}에 발각됨` : ''}`, `Running: funding ${OP2.active.faction} (${OP2.active.ethName}) · ${OP2.active.since} – ${OP2.active.until}${OP2.active.exposed ? ` · exposed ${OP2.active.exposed}` : ''}`)));
        else if (OP2.needIntel) op.append(h('p', 'emb-empty', L('첩보 수준이 「보통」(30) 이상이어야 이 나라 파벌에 손을 쓸 수 있습니다.', 'Our intel must be at least "Moderate" (30) to meddle with this empire\'s factions.')));
        else {
          op.append(h('p', 'emb-note', L(`파벌 하나를 골라 2년간 몰래 자금을 댑니다(영향력 ${OP2.cost.influence}·에너지 ${OP2.cost.energy}). 그 나라의 해당 이념 매력도 +15%(2년째 +10% 더), 수도 안정도 -5. 해마다 15%(첩보 수준 높음이면 10%) 확률로 발각되면 상대 호감 -50, 은하재판소에 불려 갈 수 있습니다.`, `Pick a faction and secretly fund it for 2 years (${OP2.cost.influence} influence, ${OP2.cost.energy} energy). That ethic's attraction +15% (+10% more in year two), capital stability -5. Each year there is a 15% chance (10% with high intel) of exposure: their opinion -50, and they may haul us before the Galactic Tribunal.`)));
          const ul = h('div', 'emb-ops-list');
          for (const f of OP2.factions) { const b = btn('emb-btn sm', L(`${f.name} (${f.ethName}) 지원`, `Fund ${f.name} (${f.ethName})`), () => run('fsup', async () => { const r = await window.sllm.fsupStart(cur, f.eth, f.name); if (r && r.ok) { err = r.text || ''; D = await window.sllm.embassyDetail(cur); return { ok: true }; } return r; })); b.disabled = !!busy; b.setAttribute('data-i18n-skip', ''); ul.append(b); }
          if (!OP2.factions.length) ul.append(h('p', 'emb-empty', L('손쓸 수 있는 파벌이 보고되지 않았습니다.', 'No factions reported to work with.')));
          op.append(ul);
        }
        main.append(op);
      }
      const AG = X.agent; // 첩보 공작원(2026-10-20 알파 9 ④): 이 나라에 심은 우리 사람
      // 현지 공작원 카드(2026-10-27): 첩보 수준이 낮아 보고서가 잠겨 있어도 공작원은 보여 준다.
      function agentCard(AG) {
        const ag = h('section', 'emb-agent'); ag.append(h('div', 'emb-ph', L('현지 공작원', 'Agent in place')));
        const top = h('div', 'emb-ag-top'); top.append(h('b', '', L('암호명 ', 'Codename ') + L(AG.code[0], AG.code[1])));
        if (AG.veteran) top.append(h('span', 'emb-ag-vet', L('베테랑', 'Veteran')));
        ag.append(top);
        const nm = h('div', 'emb-ag-nm', AG.name); nm.setAttribute('data-i18n-skip', ''); ag.append(nm);
        if (AG.canDip || AG.dip) {
          const cb = btn('emb-btn emb-ag-dip', AG.dip ? L('일반 위장으로 되돌리기', 'Return to ordinary cover') : L('외교관으로 위장시키기', 'Move under diplomatic cover'), () => run('cover', () => window.sllm.agentCover(cur, !AG.dip))); cb.disabled = !!busy;
          ag.append(cb, h('small', 'emb-ag-note', L('외교관 위장: 소문이 확인된 정보가 되고 신뢰도가 오릅니다. 대신 공작원이 발각되면 우리 대사도 추방됩니다.', 'Diplomatic cover: rumors become confirmed and confidence rises — but if the agent is exposed, our ambassador is expelled too.')));
        }
        ag.append(h('small', '', L('위장: ', 'Cover: ') + L(AG.cover[0], AG.cover[1]) + ' · ' + L('말투: ', 'Manner: ') + L(AG.manner[0], AG.manner[1]) + ' · ' + (AG.since || '?') + L(` 부임 (${AG.years}년째)`, ` posted (${AG.years} yr)`)));
        // 현지 협력자 = 게임 첩보 자산(2026-10-20): 사람 자산은 그 나라 종족 이름
        const cs = AG.contacts || [];
        const cw = h('div', 'emb-ag-cs'); cw.append(h('b', '', L('현지 협력자', 'Local collaborators') + ' (' + cs.length + ')'));
        if (cs.length) { const ul = h('ul'); for (const c of cs) { const li = h('li'); const nm2 = h('span', 'nm', c.name); nm2.setAttribute('data-i18n-skip', ''); li.append(nm2, h('span', 'rl', ' — ' + L(c.role[0], c.role[1]) + ' · ' + (c.since || '?'))); ul.append(li); } cw.append(ul); }
        else cw.append(h('small', 'emb-empty', L('아직 협력자가 없습니다. 게임에서 첩보 자산을 얻으면 이름 있는 협력자로 여기에 나타납니다.', 'No collaborators yet. Espionage assets you gain in the game appear here as named collaborators.')));
        ag.append(cw);
        // 공작원 서신(요원 연작): 이야기만, 게임 효과 없음
        const lw = h('div', 'emb-ag-ls'); lw.append(h('b', '', L('공작원 서신', 'Dispatches')));
        const LS = AG.letters || [];
        if (!LS.length) lw.append(h('small', 'emb-empty', L('2년마다 공작원이 현장 이야기를 담은 서신을 보내올 수 있습니다(이야기만, 게임 효과 없음).', 'Every two years the agent may send a dispatch with a story from the field (story only, no game effect).')));
        for (const l of LS) {
          const it = h('div', 'emb-ag-l' + (l.read ? '' : ' new'));
          const top2 = h('div', 'hd'); top2.append(h('span', 'k', L(l.kind[0], l.kind[1])), h('span', 'd', l.date)); it.append(top2);
          if (l.body && (openLetter === l.id || !l.read)) { if (l.title) it.append(h('b', '', l.title)); it.append(h('p', 'bd', l.body)); }
          else if (l.body) it.append(btn('emb-btn sm', l.title ? l.title : L('다시 읽기', 'Read again'), () => { openLetter = l.id; draw(); }));
          else { const ob = btn('emb-btn sm', busy === 'letter' + l.id ? L('해독 중…', 'Decoding…') : L('봉투 열기', 'Open'), () => { openLetter = l.id; run('letter' + l.id, () => window.sllm.agentLetterOpen(cur, l.id)); }); ob.disabled = !!busy; it.append(ob); }
          lw.append(it);
        }
        ag.append(lw);
        return ag;
      }
      if (AG) main.append(agentCard(AG));
      main.append(cable(AG ? L('공작원 보고', 'Field agent\'s report') + ' · ' + L('암호명 ', 'Codename ') + L(AG.code[0], AG.code[1]) : L('첩보관의 보고', 'Case officer\'s briefing') + (X.amb ? ' · ' + X.amb.name + (X.amb.manner ? ' (' + X.amb.manner + ')' : '') : ''), X.report, AG ? L('현지 공작원에게 이 자료로 보고서를 써 달라고 할 수 있습니다(AI 사용).', 'You can ask the agent in place to write a report from this information (uses AI).') : L('이 나라를 맡은 첩보관에게 이 자료로 보고서를 써 달라고 할 수 있습니다(AI 사용).', 'You can ask the case officer to write a briefing from this information (uses AI).'), X.report ? L('보고서 다시 받기', 'Request a new briefing') : L('첩보 보고서 받기', 'Request a briefing'), 'spy', () => run('spy', () => window.sllm.embassySpyReport(cur)), false));
    }
  }
  function build() {
    const after = $('petCall') || document.querySelector('[data-app="policy"]'); const holo = $('policy') && $('policy').parentElement;
    if (!after || !holo || $('embassy')) return false;
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'embCall';
    b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 40h32M10 40V20M38 40V20M24 6l16 10H8z"/><path d="M17 24v12M24 24v12M31 24v12"/></svg>';
    b.append(h('span', '', L('대사관', 'Embassies')));
    b.onclick = () => { tab = 'emb'; show('embassy'); load(); };
    after.after(b);
    // 첩보 아이콘(2026-10-20 알파 9): 같은 화면을 「첩보 보고」 탭으로 바로 연다. 첩보는 비밀 경로라 바탕화면에 따로 둔다.
    const sp = h('button', 'ic'); sp.type = 'button'; sp.id = 'spyCall';
    sp.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 24s8-12 20-12 20 12 20 12-8 12-20 12S4 24 4 24z"/><circle cx="24" cy="24" r="6"/><circle cx="24" cy="24" r="1.5"/></svg>';
    sp.append(h('span', '', L('첩보', 'Espionage')));
    sp.onclick = () => { tab = 'spy'; show('embassy'); load(); };
    b.after(sp);
    const sec = h('section', 'view app'); sec.id = 'embassy'; sec.setAttribute('aria-label', L('대사관', 'Embassies'));
    const hd = h('div', 'apph'); const back = h('button', 'back', '‹ ' + L('바탕화면', 'Desktop')); back.type = 'button'; back.onclick = () => show('desktop');
    const ttl = h('h3', '', L('대사관 보고', 'Embassy Reports')); ttl.id = 'embTitle'; hd.append(back, ttl); const body = h('div', 'appb'); body.id = 'embRoot';
    sec.append(hd, body); holo.append(sec);
    return true;
  }
  document.addEventListener('DOMContentLoaded', () => {
    // 청원 아이콘 뒤에 붙인다(청원 화면이 먼저 아이콘을 만들 때까지 잠깐 기다림).
    let tries = 0; const t = setInterval(() => { if (build() || ++tries > 20) { clearInterval(t); load(); } }, 100);
    if (window.sllm.onOfficeGo) window.sllm.onOfficeGo((v) => { if (v === 'embassy' || v === 'spy') { tab = v === 'spy' ? 'spy' : 'emb'; show('embassy'); load(); } });
    document.addEventListener('sllm-language', () => { const b = $('embCall'); if (b) b.querySelector('span').textContent = L('대사관', 'Embassies'); const b2 = $('spyCall'); if (b2) b2.querySelector('span').textContent = L('첩보', 'Espionage'); draw(); });
  });
  window.SLLMEmbassy = { load };
})();
