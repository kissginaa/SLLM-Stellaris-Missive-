// 집무실 「의회」(2026-11-03): 의석·여당 연정·야당 대표(영수회담)·원내 공방(늘 켜짐, 단일 의식 제외) + 국정감사(⑤, 설정) + 불신임(⑥, 설정).
// 앱: src/features/audit-app.ts·noconf-app.ts, 규칙: src/audit.ts·noconf.ts.
// 아이콘은 「국정」 줄의 「여론조사」 옆(없으면 정책 옆). office.html 은 이 파일·css 만 더한다. 언어 팩 규칙: 문구는 L('한국어', 'English')(SLLMI18n.pick)으로만.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const btn = (cls, text, fn, dis) => { const b = h('button', cls, text); b.type = 'button'; b.onclick = fn; b.disabled = !!dis; return b; };
  const show = (id) => { if (!document.getElementById(id)) return; for (const v of document.querySelectorAll('.view')) v.classList.toggle('on', v.id === id); };
  const TITLE = () => L('의회', 'Parliament');
  const SVG = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18L24 8l18 10"/><path d="M10 18v18M18 18v18M30 18v18M38 18v18M6 40h36"/><path d="M22 24h4"/></svg>';
  let S = null, N = null, P = null, msg = '', err = '', busy = '', drafts = {}, speech = '', tdraft = '';

  function build() {
    const holo = $('policy') && $('policy').parentElement; if (!holo || $('auditCall')) return;
    const anchor = $('pollCall') || document.querySelector('[data-app="policy"]'); if (!anchor) return;
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'auditCall'; b.innerHTML = SVG; b.append(h('span', '', TITLE()), h('b', 'n', ''));
    b.onclick = () => { msg = ''; err = ''; show('auditView'); load(); };
    anchor.after(b);
    const sec = h('section', 'view app'); sec.id = 'auditView'; sec.setAttribute('aria-label', TITLE());
    const hd = h('div', 'apph'); const back = h('button', 'back', '‹ ' + L('바탕화면', 'Desktop')); back.type = 'button'; back.onclick = () => show('desktop');
    hd.append(back, h('h3', '', TITLE())); const body = h('div', 'appb'); body.id = 'auditRoot'; sec.append(hd, body); holo.append(sec);
  }
  function badge() {
    const b = $('auditCall'); if (!b) return;
    const vis = !!((P && P.sid && P.regime !== 'none') || (S && S.on && S.regime !== 'none') || (N && N.on && N.regime && N.regime !== 'none')); b.style.display = vis ? '' : 'none';
    const n = b.querySelector('.n'); if (n) n.textContent = (S && S.on && S.open) || (N && N.on && N.motion) ? '!' : '';
  }
  async function act(name, fn) {
    if (busy) return; busy = name; msg = ''; err = ''; draw();
    try { const r = await fn(); if (r && r.state) { if ('seats' in r.state || 'total' in r.state) P = r.state; else if ('motion' in r.state || 'threshold' in r.state) N = r.state; else S = r.state; } if (r && r.ok) msg = r.done || r.text || ''; else err = (r && r.error) || L('처리하지 못했습니다.', 'Something went wrong.'); }
    catch (e) { err = String(e && e.message || e); }
    busy = ''; draw();
  }
  function itemBox(it, i, live) {
    const box = h('div', 'au-item' + (it.verdict ? ' ' + it.verdict : ''));
    const hd = h('div', 'au-ih'); hd.append(h('b', '', it.topic), h('span', 'au-mp', [it.mp, it.faction].filter(Boolean).join(' · '))); box.append(hd);
    box.append(h('p', 'au-q', it.question));
    if (it.verdict) {
      if (it.answer) box.append(h('p', 'au-a', L('답변: ', 'Answer: ') + it.answer));
      const v = h('div', 'au-v'); v.append(h('span', 'au-tag ' + it.verdict, it.verdictName), h('span', '', it.remark || '')); box.append(v);
    } else if (live) {
      const ta = h('textarea', 'au-in'); ta.rows = 3; ta.maxLength = 1200; ta.value = drafts[i] || ''; ta.placeholder = L('의원의 질의에 답하세요…', 'Answer the member\'s question…'); ta.oninput = () => { drafts[i] = ta.value; };
      const row = h('div', 'au-row'); row.append(ta);
      row.append(btn('au-btn', busy === 'a' + i ? L('판정 중…', 'Judging…') : L('답변', 'Answer'), () => act('a' + i, async () => { const r = await window.sllm.auditAnswer(i, ta.value); if (r && r.ok) delete drafts[i]; return r; }), !!busy));
      row.append(btn('au-btn ghost', L('답변 거부', 'Decline to answer'), () => act('a' + i, () => window.sllm.auditAnswer(i, '')), !!busy));
      box.append(row);
    }
    return box;
  }
  function draw() {
    badge();
    const r = $('auditRoot'); if (!r) return; r.textContent = '';
    const w = h('div', 'au-main'); r.append(w);
    if (!(P && P.sid) && !(S && S.sid) && !(N && N.sid)) { w.append(h('p', 'au-empty', L('세이브를 불러오면 표시됩니다.', 'Shown once a save is loaded.'))); return; }
    if (msg) w.append(h('div', 'au-ok', msg)); if (err) w.append(h('div', 'au-err', err));
    if (P && P.sid && P.regime !== 'none') drawParliament(w);
    if (N && N.on && N.sid) drawNoconf(w);
    if (!S || !S.on || !S.sid) return;
    w.append(h('p', 'au-hh', L('국정감사', 'National audit')));
    w.append(h('p', 'au-note', S.regime === 'sham' ? L(`${S.every}년마다 국정감사가 열리지만, 우리 의회는 정부를 칭송하는 자리일 뿐입니다. 외국 언론은 요식 감사라 비꼽니다.`, `A national audit is held every ${S.every} years, but our parliament only praises the government. Foreign newspapers call it a rubber stamp.`)
      : L(`${S.every}년마다 의회가 정부를 감사합니다. 감사 해에는 그해 안에 의원들의 질의(3개)에 직접 답해야 합니다. 해명되면 안정도가 오르고, 얼버무리거나 거짓말하면 논란이 됩니다.`, `Every ${S.every} years parliament audits the government. In an audit year you must answer the members' three questions yourself before the year ends. Clear answers raise stability; evasions and lies cause an uproar.`)));
    if (S.open) {
      const card = h('div', 'au-card');
      card.append(h('div', 'au-ch', L(`${S.year}년 국정감사`, `National audit ${S.year}`)));
      if (S.draft) { S.draft.items.forEach((it, i) => card.append(itemBox(it, i, true))); }
      else {
        const row = h('div', 'au-row');
        row.append(btn('au-btn', busy === 'start' ? L('의제를 준비하는 중…', 'Preparing the agenda…') : S.regime === 'sham' ? L('감사 받기', 'Attend the audit') : L('감사 출석', 'Appear before the audit'), () => act('start', () => window.sllm.auditStart()), !!busy));
        if (S.regime === 'free') row.append(btn('au-btn danger', L('출석 거부', 'Refuse to appear'), () => { if (confirm(L('출석을 거부하면 2년 동안 모든 행성 안정도 −8, 민심이 크게 떨어집니다. 거부할까요?', 'Refusing costs −8 stability on all planets for 2 years and a big drop in approval. Refuse?'))) act('refuse', () => window.sllm.auditRefuse()); }, !!busy));
        card.append(row);
      }
      w.append(card);
    } else w.append(h('p', 'au-note', L(`다음 국정감사: ${S.next}년`, `Next national audit: ${S.next}`)));
    if (S.recs && S.recs.length) {
      w.append(h('p', 'au-hh', L('지난 감사', 'Past audits')));
      for (const rec of S.recs) {
        const box = h('details', 'au-rec');
        const kind = { held: L('감사', 'Audit'), sham: L('요식 감사', 'Rubber stamp'), refused: L('출석 거부', 'Refused'), missed: L('불출석', 'Missed') }[rec.kind] || rec.kind;
        const out = { clean: L('무사히 마침', 'Went well'), mixed: L('팽팽함', 'Even'), scandal: L('큰 논란', 'Uproar') }[rec.outcome] || '';
        const sm = h('summary'); sm.append(h('b', '', L(`${rec.year}년`, String(rec.year))), h('span', '', [kind, out, rec.perjury ? L(`위증 의심 ${rec.perjury}`, `${rec.perjury} perjury`) : ''].filter(Boolean).join(' · '))); box.append(sm);
        rec.items.forEach((it, i) => box.append(itemBox(it, i, false)));
        w.append(box);
      }
    }
  }
  const SIDE = { ruling: ['여당', 'Ruling party'], coalition: ['연정', 'Coalition'], deal: ['법안 거래', 'Deal'], ind: ['무소속', 'Independents'], opposition: ['야당', 'Opposition'] };
  const SIDE_COLOR = { ruling: 'var(--hi)', coalition: '#8fe3a8', deal: '#b9a6ff', ind: '#8a93a6', opposition: '#ff8a7a' };
  /** 반원 의석도(200석, 바깥 줄부터). */
  function hemicycle(seats, total) {
    const rows = 8, pts = []; let rLen = 0; const radii = []; for (let i = 0; i < rows; i++) { const r = 40 + i * 8; radii.push(r); rLen += r; }
    for (let i = 0; i < rows; i++) { const n = Math.round(total * radii[i] / rLen); for (let j = 0; j < n; j++) { const a = Math.PI - (Math.PI * (j + 0.5)) / n; pts.push({ a, x: 110 + radii[i] * Math.cos(a), y: 104 - radii[i] * Math.sin(a) }); } }
    pts.sort((p, q) => q.a - p.a); while (pts.length > total) pts.pop();
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 220 110'); svg.setAttribute('class', 'au-hemi');
    let k = 0; for (const s of seats) for (let i = 0; i < s.seats && k < pts.length; i++, k++) { const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', pts[k].x.toFixed(1)); c.setAttribute('cy', pts[k].y.toFixed(1)); c.setAttribute('r', '2.6'); c.setAttribute('fill', SIDE_COLOR[s.side] || '#888'); svg.append(c); }
    return svg;
  }
  function drawParliament(w) {
    w.append(h('p', 'au-hh', L('의석', 'Seats')));
    if (P.regime === 'sham') { w.append(h('p', 'au-note', L('우리 의회는 정부를 칭송하는 곳입니다. 야당은 이름뿐인 관제 야당입니다.', 'Our parliament exists to praise the government. The opposition is a token, state-approved one.'))); return; }
    if (P.noFac === 'none') { w.append(h('p', 'au-note', L('아직 정당(파벌)이 생기지 않았습니다. 의원 200명이 모두 무소속이라 여당·야당도, 연정·거래·영수회담도 없습니다. 불신임 표결에서도 의석 보정은 없습니다. 게임에서 파벌이 생기면 다음 달부터 의석이 나뉩니다.', 'No parties (factions) have formed yet. All 200 members sit as independents, so there is no government or opposition bloc, and no coalitions, deals or leaders\' summits. No-confidence votes get no seat adjustment. Once factions form in the game, seats are divided from the following month.'))); return; }
    if (!P.seats || !P.seats.length) { w.append(h('p', 'au-empty', L('파벌 정보가 오면 의석이 표시됩니다(다음 달).', 'Seats appear once faction data arrives (next month).'))); return; }
    const card = h('div', 'au-parl');
    const top = h('div', 'au-ptop'); top.append(hemicycle(P.seats, P.total));
    const sum = h('div', 'au-psum'); sum.append(h('b', '', L(`정부 쪽 ${P.gov} / ${P.total}석`, `Government ${P.gov} / ${P.total} seats`)), h('span', 'au-tag ' + (P.majority ? 'cleared' : 'perjury'), P.majority ? L('과반', 'Majority') : L(`과반 미달(${P.majorityNeed}석 필요)`, `No majority (${P.majorityNeed} needed)`)));
    if (P.oppLeader) sum.append(h('span', 'au-note', L(`야당 대표: ${P.oppLeader.name}(${P.oppLeader.faction}) · 관계 ${P.relation}`, `Opposition leader: ${P.oppLeader.name} (${P.oppLeader.faction}) · relations ${P.relation}`)));
    top.append(sum); card.append(top);
    const list = h('div', 'au-plist');
    for (const s of P.seats) {
      const row = h('div', 'au-prow'); const dot = h('i', 'au-dot'); dot.style.background = SIDE_COLOR[s.side] || '#888';
      row.append(dot, h('b', '', s.name), h('span', 'au-side', L(...SIDE[s.side])), h('span', 'au-seat', L(`${s.seats}석`, `${s.seats}`)), h('span', 'au-appr', s.approval === null ? '' : L(`정부 승인 ${s.approval}%`, `approval ${s.approval}%`)));
      const acts = h('span', 'au-pacts');
      if (s.side === 'coalition') acts.append(btn('au-btn ghost', L('연정 끝내기', 'End coalition'), () => act('leave', () => window.sllm.parliamentAct('leave', s.key)), !!busy));
      if (s.side === 'opposition' && s.offer) {
        const o = btn('au-btn', L(`연정 제안(${s.offer.chance}%)`, `Offer coalition (${s.offer.chance}%)`), () => act('offer', () => window.sllm.parliamentAct('offer', s.key)), !!busy || !!s.offer.block); if (s.offer.block) o.title = s.offer.block; acts.append(o);
        const d = btn('au-btn ghost', L('법안 거래', 'Legislative deal'), () => act('deal', () => window.sllm.parliamentAct('deal', s.key)), !!busy || !!P.deal.block || !!P.deal.active); d.title = P.deal.block || L('2년 동안 이 파벌 의석을 정부 쪽으로(여당 승인도 조금 하락)', 'Count this faction for the government for 2 years (ruling faction approval dips)'); acts.append(d);
        const pc = btn('au-btn danger', L(`의원 빼오기(에너지 ${P.poach.energy})`, `Poach MPs (${P.poach.energy} energy)`), () => { if (confirm(L(`에너지 ${P.poach.energy}로 의원 ${P.poach.seats}명을 데려옵니다. 30% 확률로 매수가 드러나 스캔들이 됩니다. 할까요?`, `Spend ${P.poach.energy} energy to bring over ${P.poach.seats} members. 30% chance the bribery comes out as a scandal. Go ahead?`))) act('poach', () => window.sllm.parliamentAct('poach', s.key)); }, !!busy || !!P.poach.block || !P.running); if (P.poach.block) pc.title = P.poach.block; acts.append(pc);
      }
      row.append(acts); list.append(row);
    }
    card.append(list);
    // 영수회담
    if (P.oppLeader) {
      const tb = h('div', 'au-talk'); tb.append(h('b', '', L(`영수회담 — ${P.oppLeader.name}`, `Leaders' summit — ${P.oppLeader.name}`)));
      for (const t of P.talk.turns) { const r = h('div', 'au-tt ' + t.who); r.append(h('small', '', t.who === 'us' ? L('나', 'Me') : P.oppLeader.name), h('span', '', t.text)); tb.append(r); }
      if (P.talk.block) tb.append(h('p', 'au-note', P.talk.block));
      else {
        const ta = h('textarea', 'au-in'); ta.rows = 2; ta.maxLength = 800; ta.value = tdraft; ta.placeholder = L('야당 대표에게 할 말…(협조 요청·양보·압박)', 'What you say to the opposition leader… (ask, concede, press)'); ta.oninput = () => { tdraft = ta.value; };
        const say = () => act('talk', async () => { const r = await window.sllm.parliamentTalk(ta.value, false); if (r && r.ok) tdraft = ''; return r; });
        ta.onkeydown = (ev) => { if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); say(); } };
        const row = h('div', 'au-row'); row.append(ta, btn('au-btn', busy === 'talk' ? L('듣는 중…', 'Listening…') : P.talk.active ? L('말하기', 'Speak') : L('회담 열기', 'Open the summit'), say, !!busy));
        if (P.talk.active) row.append(btn('au-btn ghost', L('회담 마치기', 'End summit'), () => act('tend', () => window.sllm.parliamentTalk('', true)), !!busy));
        tb.append(row);
        if (P.talk.active) tb.append(h('p', 'au-note', L(`남은 말 ${P.talk.left}번. 관계가 좋으면 야당 의원이 넘어오고 연정이 쉬워지며, 나쁘면 장외 투쟁이 벌어집니다.`, `${P.talk.left} line(s) left. Good relations bring opposition members over and make coalitions easier; bad ones bring street rallies.`)));
      }
      card.append(tb);
    }
    if (P.log && P.log.length) { const ol = h('ol', 'au-plog'); for (const x of P.log) { const li = h('li'); li.append(h('span', '', x.date), h('b', '', x.text)); ol.append(li); } card.append(ol); }
    w.append(card);
  }
  function drawNoconf(w) {
    w.append(h('p', 'au-hh', L('불신임', 'No confidence')));
    if (N.regime !== 'free') { w.append(h('p', 'au-note', L('정부를 끌어내릴 수 있는 의회가 없는 정부 형태입니다.', 'Under this form of government parliament cannot bring down the government.'))); return; }
    w.append(h('p', 'au-note', L(`지지율이 석 달 이어서 ${N.threshold}% 아래면 의회가 불신임안을 냅니다${N.hot ? '(최근 국정감사 논란으로 기준이 올랐습니다)' : ''}. 지금 지지율 ${N.approval === null ? '?' : N.approval + '%'} · 기준 아래 ${N.low}/${N.lowNeed}달.`, `If approval stays below ${N.threshold}% for three months, parliament moves a motion of no confidence${N.hot ? ' (raised after a recent audit scandal)' : ''}. Approval now ${N.approval === null ? '?' : N.approval + '%'} · below the line ${N.low}/${N.lowNeed} month(s).`)));
    if (N.motion) {
      const card = h('div', 'au-card');
      card.append(h('div', 'au-ch', L(`불신임안 — ${N.motion.date}`, `Motion of no confidence — ${N.motion.date}`)));
      const it = h('div', 'au-item'); const hd = h('div', 'au-ih'); hd.append(h('b', '', N.motion.mover)); it.append(hd, h('p', 'au-q', N.motion.charge)); card.append(it);
      card.append(h('p', 'au-note', L('석 달 안에 변론하지 않으면 변론 없이 표결합니다. 진솔하고 구체적인 연설일수록 흔들리는 의원을 붙잡습니다.', 'If you do not defend yourself within three months, the vote goes ahead without a defence. An honest, concrete speech wins over wavering members.')));
      const ta = h('textarea', 'au-in'); ta.rows = 5; ta.maxLength = 2000; ta.value = speech; ta.placeholder = L('의회에서 할 변론 연설…', 'Your defence speech to parliament…'); ta.oninput = () => { speech = ta.value; };
      const row = h('div', 'au-row'); row.append(ta);
      row.append(btn('au-btn', busy === 'defend' ? L('표결 중…', 'Voting…') : L('변론하고 표결', 'Defend and vote'), () => act('defend', async () => { const r = await window.sllm.noconfDefend(ta.value); if (r && r.ok) speech = ''; return r; }), !!busy));
      row.append(btn('au-btn danger', L('의회 해산', 'Dissolve parliament'), () => { if (confirm(L('의회를 해산하면 2년 동안 모든 행성 안정도 −10, 민심이 크게 떨어집니다. 해산할까요?', 'Dissolving parliament costs −10 stability on all planets for 2 years and a big drop in approval. Dissolve?'))) act('dissolve', () => window.sllm.noconfDissolve()); }, !!busy));
      card.append(row); w.append(card);
    }
    for (const v of (N.votes || [])) {
      const box = h('details', 'au-rec');
      const what = v.kind === 'dissolved' ? L('의회 해산', 'Parliament dissolved') : v.survived ? L(`부결 · 정부 지지 ${v.gov}%`, `Failed · ${v.gov}% for the government`) : L(`가결(레임덕) · 정부 지지 ${v.gov}%`, `Passed (lame duck) · ${v.gov}% for the government`);
      const sm = h('summary'); sm.append(h('b', '', v.date), h('span', '', what)); box.append(sm);
      if (v.speech) box.append(h('p', 'au-a', L('변론: ', 'Defence: ') + v.speech));
      if (v.reaction) box.append(h('p', 'au-q', v.reaction));
      w.append(box);
    }
  }
  async function load() {
    try { S = await window.sllm.auditState(); } catch (e) { S = null; }
    try { N = window.sllm.noconfState ? await window.sllm.noconfState() : null; } catch (e) { N = null; }
    try { P = window.sllm.parliamentState ? await window.sllm.parliamentState() : null; } catch (e) { P = null; }
    draw();
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.auditState) return;
    setTimeout(() => { build(); load(); }, 520); // 「여론조사」 아이콘(office-civic.js, 450ms) 뒤
    if (window.sllm.onAuditUpdate) window.sllm.onAuditUpdate((v) => { S = v; draw(); });
    if (window.sllm.onNoconfUpdate) window.sllm.onNoconfUpdate((v) => { N = v; draw(); });
    if (window.sllm.onParliamentUpdate) window.sllm.onParliamentUpdate((v) => { P = v; draw(); });
    document.addEventListener('sllm-language', () => {
      const b = $('auditCall'); if (b) b.querySelector('span').textContent = TITLE();
      const t = $('auditView') && $('auditView').querySelector('h3'); if (t) t.textContent = TITLE();
      const bk = $('auditView') && $('auditView').querySelector('.back'); if (bk) bk.textContent = '‹ ' + L('바탕화면', 'Desktop');
      load();
    });
  });
  window.SLLMAudit = { load };
})();
