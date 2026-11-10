// 집무실 「의회」 맨 위 「양당」 칸(2026-11-06): 두 거대 정당(의석·지지율·계파), 정당 지지율 추이, 다음 총선, 선거전(공약·후보 토론), 대정부 질문, 이번 임기 공약.
// 앱: src/features/twoparty-app.ts, 규칙: src/twoparty.ts. 의회 화면(office-audit.js)이 다시 그려질 때마다 맨 위에 다시 붙는다. 문구는 L('한국어', 'English')만 — 언어 팩 호환.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const P = (p) => (Array.isArray(p) ? L(p[0], p[1]) : String(p || ''));
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const btn = (cls, text, fn, dis) => { const b = h('button', cls, text); b.type = 'button'; b.onclick = fn; b.disabled = !!dis; return b; };
  const NS = 'http://www.w3.org/2000/svg';
  const sv = (tag, at) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); return e; };
  const COL = { gov: '#e0c48a', opp: '#7fb4ff', und: '#8888' };
  let S = null, busy = '', msg = '', err = '', picks = new Set(), qdraft = '', ddraft = '';

  function spark(polls) {
    const W = 520, H = 90, Pd = 6, svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'tp-spark', role: 'img', 'aria-label': L('정당 지지율 추이', 'Party support over time') });
    if (!polls || polls.length < 2) { const t = sv('text', { x: W / 2, y: H / 2, fill: '#aaa', 'font-size': 11, 'text-anchor': 'middle' }); t.textContent = L('몇 달이 지나면 추이가 그려집니다.', 'The trend appears after a few months.'); svg.append(t); return svg; }
    const n = polls.length, x = (i) => Pd + (W - 2 * Pd) * (i / (n - 1)), y = (v) => Pd + (H - 2 * Pd) * (1 - v / 70);
    for (const k of ['gov', 'opp']) svg.append(sv('polyline', { points: polls.map((p, i) => `${x(i).toFixed(1)},${y(Math.min(70, p[k])).toFixed(1)}`).join(' '), fill: 'none', stroke: COL[k], 'stroke-width': 2 }));
    return svg;
  }
  function partyCard(p, side) {
    const c = h('div', 'tp-party ' + side);
    c.append(h('div', 'tp-role', side === 'gov' ? L('집권당', 'Governing party') : L('제1야당', 'Main opposition')));
    c.append(h('b', 'tp-name', P(p.name)));
    c.append(h('div', 'tp-lead', side === 'gov' ? L('대표: 우리 통치자', 'Leader: our ruler') : L(`대표: ${p.leader}`, `Leader: ${p.leader}`)));
    const nums = h('div', 'tp-nums'); nums.append(h('span', 'tp-poll', p.poll + '%'), h('span', 'tp-seat', L(`${p.seats}석`, `${p.seats} seats`))); c.append(nums);
    const bar = h('div', 'tp-bar'), f = h('i'); f.style.width = Math.min(100, p.poll) + '%'; f.style.background = COL[side]; bar.append(f); c.append(bar);
    if (p.members && p.members.length) c.append(h('small', 'tp-mem', L('계파: ', 'Wings: ') + p.members.map((m) => `${m.name} ${m.seats}`).join(' · ')));
    return c;
  }
  async function act(name, fn) {
    if (busy) return; busy = name; msg = ''; err = ''; draw();
    try { const r = await fn(); if (r && r.state) S = r.state; if (r && r.ok) msg = r.text || ''; else err = (r && r.error) || L('처리하지 못했습니다.', 'Something went wrong.'); }
    catch (e) { err = String(e && e.message || e); }
    busy = ''; draw();
  }
  function block() {
    const w = h('div', 'tp-main'); w.id = 'tpBlock'; w.setAttribute('data-i18n-skip', '');
    w.append(h('p', 'au-hh', L('양당 정치', 'Two-party politics')));
    if (msg) w.append(h('div', 'au-ok', msg)); if (err) w.append(h('div', 'au-err', err));
    const top = h('div', 'tp-row'); top.append(partyCard(S.gov, 'gov'), partyCard(S.opp, 'opp')); w.append(top);
    const line = h('div', 'tp-line');
    line.append(h('span', '', L(`무당층 ${S.und}%`, `Undecided ${S.und}%`)), h('span', '', L(`정부 쪽 의석 ${S.govSide}석${S.majority ? '(과반)' : '(과반 아님)'}`, `Government side ${S.govSide} seats${S.majority ? ' (majority)' : ' (no majority)'}`)));
    line.append(h('span', '', S.monthsLeft !== null ? L(`다음 총선 ${S.nextElection}(${Math.max(0, S.monthsLeft)}개월 뒤, ${S.every}년마다)`, `Next election ${S.nextElection} (in ${Math.max(0, S.monthsLeft)} months, every ${S.every} years)`) : ''));
    w.append(line);
    w.append(spark(S.polls));
    w.append(h('p', 'au-note', S.demo
      ? L('민주정: 국민이 예민합니다. 사건 하나하나가 지지율을 크게 흔들고(1.5배), 총선 결과가 의회 의석을 바꿉니다. 이긴 뒤 1년은 허니문, 오래 집권하면 피로가 쌓입니다.', 'Democracy: the public is sensitive. Every event moves support more (×1.5), and elections reshape the seats in parliament. A honeymoon follows a win; long rule breeds fatigue.')
      : L('자유로운 의회가 있지만 민주정만큼 민심이 크게 출렁이지는 않습니다. 총선은 10년마다입니다.', 'Parliament is free, but opinion swings less than in a democracy. Elections are held every 10 years.')));
    // 대정부 질문
    if (S.qt && (S.qt.open || S.qt.answer)) {
      const c = h('div', 'au-card'); c.append(h('div', 'au-ch', L('대정부 질문', 'Question time')));
      c.append(h('p', 'au-q', `${S.opp.leader}: ${P(S.qt.q)}`));
      if (S.qt.open) {
        c.append(h('small', 'au-note', L(`${S.qt.due}까지 답하지 않으면 답변을 피한 것으로 기록됩니다.`, `If you do not answer by ${S.qt.due}, it goes on record as dodged.`)));
        const ta = h('textarea', 'au-in'); ta.rows = 3; ta.maxLength = 1200; ta.value = qdraft; ta.placeholder = L('의회에서 직접 답하세요…', 'Answer in the chamber…'); ta.oninput = () => { qdraft = ta.value; };
        const row = h('div', 'au-row'); row.append(ta,
          btn('au-btn', busy === 'qt' ? L('판정 중…', 'Judging…') : L('답변', 'Answer'), () => act('qt', async () => { const r = await window.sllm.duoAnswer(ta.value); if (r && r.ok) qdraft = ''; return r; }), !!busy || !ta.value.trim()),
          btn('au-btn ghost', L('답변 거부', 'Refuse to answer'), () => act('qt', () => window.sllm.duoAnswer('')), !!busy));
        ta.addEventListener('input', () => { row.children[1].disabled = !!busy || !ta.value.trim(); });
        c.append(row);
      } else {
        c.append(h('p', 'au-a', L('우리 답변: ', 'Our answer: ') + S.qt.answer));
        c.append(h('p', 'au-q', `${S.opp.leader}: ${S.qt.rebuttal}`));
        if (S.qt.headline) c.append(h('span', 'au-tag ' + (S.qt.score > 0 ? 'cleared' : S.qt.score < 0 ? 'perjury' : 'weak'), S.qt.headline));
      }
      w.append(c);
    }
    // 선거전
    if (S.campaign) {
      const cp = S.campaign, c = h('div', 'au-card');
      c.append(h('div', 'au-ch', L(`선거전 — ${S.nextElection} 총선`, `Campaign — election on ${S.nextElection}`)));
      if (cp.report) c.append(h('p', 'au-note', L(`지난 공약 성적표: 지킴 ${cp.report.kept.map((p) => p.ko).join(', ') || '없음'} / 어김 ${cp.report.broken.map((p) => p.ko).join(', ') || '없음'}`, `Report card: kept ${cp.report.kept.map((p) => p.en).join(', ') || 'none'} / broken ${cp.report.broken.map((p) => p.en).join(', ') || 'none'}`)));
      c.append(h('b', '', L(`${P(S.opp.name)}의 공약`, `${P(S.opp.name)} pledges`)));
      const ou = h('ul', 'tp-ul'); for (const p of cp.opp) ou.append(h('li', '', P(p))); c.append(ou);
      c.append(h('b', '', L(`우리 ${P(S.gov.name)}의 공약`, `Our ${P(S.gov.name)} pledges`)));
      if (cp.pledges.length) {
        const ul = h('ul', 'tp-ul'); for (const p of cp.pledges) ul.append(h('li', '', `${L(p.ko, p.en)} — ${P(p.goal)}`)); c.append(ul);
        if (cp.auto) c.append(h('small', 'au-note', L('정부가 고르지 않아 당 지도부가 정한 공약입니다.', 'Chosen by the party leadership because the government did not pick.')));
      } else {
        c.append(h('small', 'au-note', L(`${cp.need}개를 고르세요. 다음 총선 때 언론이 지켰는지 따집니다(지키면 지지율 +, 어기면 −). 두 달 안에 안 고르면 당이 대신 정합니다.`, `Pick ${cp.need}. At the next election the press checks them (kept = support up, broken = down). If you do not pick within two months the party does.`)));
        const box = h('div', 'tp-picks');
        for (const p of cp.choices) {
          const lab = h('label', 'tp-pick'), cb = h('input'); cb.type = 'checkbox'; cb.checked = picks.has(p.id);
          cb.onchange = () => { if (cb.checked) picks.add(p.id); else picks.delete(p.id); draw(); };
          lab.append(cb, h('span', '', `${L(p.ko, p.en)} `), h('small', '', P(p.goal))); box.append(lab);
        }
        c.append(box);
        const prow = h('div', 'au-row'); prow.append(btn('au-btn', L(`공약 발표(${picks.size}/${cp.need})`, `Announce pledges (${picks.size}/${cp.need})`), () => act('pl', async () => { const r = await window.sllm.duoPledge([...picks]); if (r && r.ok) picks = new Set(); return r; }), !!busy || picks.size !== cp.need)); c.append(prow);
      }
      // 토론
      const d = cp.debate;
      c.append(h('b', '', L('후보 토론', 'Election debate')));
      const tw = h('div', 'au-talk');
      { const o = h('div', 'au-tt them'); o.append(h('small', '', S.opp.leader), document.createTextNode(P(d.opening))); tw.append(o); }
      for (const t of d.turns) { const e = h('div', 'au-tt ' + t.who); e.append(h('small', '', t.who === 'us' ? L('우리', 'Us') : S.opp.leader), document.createTextNode(t.text)); tw.append(e); }
      if (d.done) tw.append(h('span', 'au-tag ' + (d.score > 0 ? 'cleared' : d.score < 0 ? 'perjury' : 'weak'), d.headline || (d.score > 0 ? L('판정승', 'Won on points') : d.score < 0 ? L('판정패', 'Lost on points') : L('무승부', 'Even'))));
      else if (cp.pledges.length) {
        const ta = h('textarea', 'au-in'); ta.rows = 2; ta.maxLength = 1000; ta.value = ddraft; ta.placeholder = d.left <= 1 ? L('마지막 발언(마무리)…', 'Closing statement…') : L('반박하세요…', 'Your rebuttal…'); ta.oninput = () => { ddraft = ta.value; };
        const row = h('div', 'au-row'); row.append(ta, btn('au-btn', busy === 'db' ? L('토론 중…', 'Debating…') : L(`발언(남은 ${d.left}번)`, `Speak (${d.left} left)`), () => act('db', async () => { const r = await window.sllm.duoDebate(ta.value); if (r && r.ok) ddraft = ''; return r; }), !!busy));
        tw.append(row);
      } else tw.append(h('small', 'au-note', L('공약을 발표하면 토론에 나갈 수 있습니다.', 'Announce your pledges to take part in the debate.')));
      c.append(tw);
      w.append(c);
    }
    // 이번 임기 공약
    if (S.term && S.term.pledges.length && !S.campaign) {
      w.append(h('p', 'au-hh', L(`이번 임기 공약(${S.term.since}~)`, `This term's pledges (since ${S.term.since})`)));
      const ul = h('ul', 'tp-ul'); for (const p of S.term.pledges) ul.append(h('li', p.ok ? 'ok' : 'no', `${p.ok ? '✓' : '·'} ${L(p.ko, p.en)} — ${P(p.goal)}`)); w.append(ul);
    }
    if (S.history && S.history.length) {
      w.append(h('p', 'au-hh', L('지난 총선', 'Past elections')));
      const ul = h('ul', 'au-plog'); for (const x of S.history) { const li = h('li', '', x.date); li.append(h('b', '', L(`${x.names.gov[0]} ${x.vote.gov}% ${x.seats.gov}석 · ${x.names.opp[0]} ${x.vote.opp}% ${x.seats.opp}석`, `${x.names.gov[1]} ${x.vote.gov}% ${x.seats.gov} · ${x.names.opp[1]} ${x.vote.opp}% ${x.seats.opp}`))); ul.append(li); } w.append(ul);
    }
    if (S.log && S.log.length) { const ul = h('ul', 'au-plog'); for (const x of S.log.slice(0, 6)) { const li = h('li', '', x.d); li.append(h('b', '', P(x.t))); ul.append(li); } w.append(ul); }
    return w;
  }
  function draw() {
    const main = document.querySelector('#auditRoot .au-main'); if (!main) return;
    document.getElementById('tpBlock')?.remove();
    if (!S || !S.on) return;
    const b = block(), first = main.querySelector('.au-hh'); if (first) main.insertBefore(b, first); else main.append(b);
  }
  async function load() { try { S = await window.sllm.duoState(); } catch (e) { S = null; } draw(); }
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.duoState) return;
    const watch = () => {
      const root = document.getElementById('auditRoot'); if (!root) return setTimeout(watch, 400);
      new MutationObserver(() => { if (!document.getElementById('tpBlock') && document.querySelector('#auditRoot .au-main')) { draw(); void load(); } }).observe(root, { childList: true });
      void load();
    };
    watch();
    if (window.sllm.onDuoUpdate) window.sllm.onDuoUpdate((v) => { S = v; if (!busy) draw(); });
    if (window.sllm.onOfficeGo) window.sllm.onOfficeGo((v) => { if (v === 'parliament') { const b = document.getElementById('auditCall'); if (b) b.click(); } });
  });
})();
