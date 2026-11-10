// 집무실 「정책」 화면(정책 퀘스트, 2026-10-18). 설계: docs/POLICY_QUEST_SPEC_KO.md, 앱: src/features/policy-app.ts.
// office.html 은 아이콘·빈 칸(#policy)·이 파일만 더하고, 그리기·입력은 모두 여기서 한다(집무실 다른 작업과 파일 충돌을 줄이려고).
// 언어 팩 규칙: 문구는 L('한국어', 'English')·pick 으로만 고른다(언어 코드를 직접 비교하지 않음).
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const btn = (cls, text, fn, disabled) => { const b = h('button', cls, text); b.type = 'button'; b.onclick = fn; if (disabled) b.disabled = true; return b; };
  const RES = { energy: ['에너지', 'Energy'], minerals: ['광물', 'Minerals'], food: ['식량', 'Food'], alloys: ['합금', 'Alloys'], consumer_goods: ['소비재', 'Consumer Goods'], unity: ['통합', 'Unity'], physics_research: ['물리학 연구', 'Physics Research'], society_research: ['사회학 연구', 'Society Research'], engineering_research: ['공학 연구', 'Engineering Research'] };
  const GROUPS = { economy: ['경제', 'Economy'], research: ['연구', 'Research'], society: ['사회', 'Society'], build: ['건설', 'Construction'], empire: ['제국 운영', 'Administration'], leader: ['지도자', 'Leaders'], explore: ['탐사', 'Exploration'], diplomacy: ['외교·첩보', 'Diplomacy & Espionage'], fleet: ['함대', 'Fleet'], army: ['지상군', 'Armies'] };
  const pair = (m, k) => (m[k] ? L(m[k][0], m[k][1]) : k);
  const DIFF = { 1: ['쉬움', 'Easy'], 2: ['보통', 'Normal'], 3: ['어려움', 'Hard'] };
  const KIND = { internal: ['내부 정책', 'Internal policy'], external: ['외부 정책', 'External policy'] };
  const STATUS = { ramp: ['달성 기간', 'Ramp-up'], ok: ['유지 중', 'On track'], warn: ['경고', 'Warning'], failed: ['실패', 'Failed'], done: ['달성', 'Achieved'] };
  const END = { active: ['시행 중', 'In force'], complete: ['완수 · 선택 대기', 'Completed · awaiting choice'], success: ['성공', 'Success'], collapsed: ['붕괴', 'Collapsed'], repealed: ['폐지', 'Repealed'] };
  let S = null, view = 'main', wiz = null, docId = '', err = '', rec = null;

  function condText(c, target) {
    const t = c.type, v = c.target, name = target || '?';
    const res = pair(RES, c.res);
    if (t === 'income') return L(`${res} 월 수입 ${v} 이상 유지`, `Keep ${res} income at ${v}+ per month`);
    if (t === 'stock') return L(`${res} 창고 ${v} 이상 유지`, `Keep ${res} stockpile at ${v}+`);
    if (t === 'capstab') return L(`수도 안정도 ${v} 이상 유지`, `Keep capital stability at ${v}+`);
    if (t === 'planets') return L(`소유 행성 ${v}개 이상 유지`, `Own at least ${v} planets`);
    if (t === 'naval') { const p = Math.round(v * 100); return L(`해군 수용량 ${p}% 이상 사용`, `Use ${p}%+ of naval capacity`); }
    if (t === 'peace') return L('전쟁하지 않기', 'Stay out of war');
    if (t === 'federation') return L('연방 회원 유지', 'Stay in a federation');
    if (t === 'galcom') return L('은하 공동체 회원 유지', 'Stay in the Galactic Community');
    if (t === 'pact') return L('연구·통상 협약 1개 이상 유지', 'Keep at least one research or commercial pact');
    if (t === 'friend') return L(`${name}의 우리 관계 ${v} 이상 유지`, `Keep ${name}'s opinion of us at ${v}+`);
    if (t === 'rival') return L(`${name}의 우리 관계 ${v} 이하 유지`, `Keep ${name}'s opinion of us at ${v} or lower`);
    if (t === 'subjects') return L(`모든 종속국 충성도 ${v} 이상 유지`, `Keep every subject's loyalty at ${v}+`);
    return t;
  }
  const fmt = (c, x) => (x === undefined || x === null ? '—' : c.type === 'naval' ? Math.round(x * 100) + '%' : c.dir === 'bool' ? (x >= 1 ? L('예', 'Yes') : L('아니오', 'No')) : String(Math.round(x * 10) / 10));
  const buffLabel = (b) => (b ? L(b.ko, b.en) : '?');
  const allBuffs = () => (S ? [...S.buffs.internal, ...S.buffs.external] : []);
  const buffOf = (id) => allBuffs().find((b) => b.id === id);

  async function load() { try { S = await window.sllm.policyState(); } catch (e) { S = null; } draw(); }
  function badge() { const n = (S && S.warnings) || 0, b = $('nPolicy'); if (!b) return; b.textContent = n > 9 ? '9+' : String(n); b.classList.toggle('show', n > 0); }

  function draw() {
    badge();
    const root = $('polRoot'); if (!root || !$('policy').classList.contains('on')) return;
    root.textContent = '';
    if (!S || !S.sid) { root.append(h('div', 'empty pol-pad', L('세이브를 불러오면 정책을 선포할 수 있습니다.', 'Load a save to proclaim policies.'))); return; }
    if (view === 'doc') return drawDoc(root);
    if (view === 'wiz' && wiz) return drawWiz(root);
    drawMain(root);
  }

  // ── 메인: 내부/외부 칸 + 지난 정책 ──
  function drawMain(root) {
    const wrap = h('div', 'pol-main');
    const slots = h('div', 'pol-slots');
    for (const kind of ['internal', 'external']) slots.append(slot(kind));
    wrap.append(slots);
    if (err) wrap.append(h('div', 'pol-err', err));
    if (S.legacy && S.legacy.length) { const lg = h('div', 'pol-legacy'); lg.append(h('b', '', L('정책 유산', 'Policy legacy'))); for (const l of S.legacy) lg.append(h('span', '', `${l.name} · ${L(`${l.until}까지`, `until ${l.until}`)}`)); wrap.append(lg); }
    const hist = h('div', 'pol-hist'); hist.append(h('h4', '', L('지난 정책', 'Past policies')));
    if (!S.history.length) hist.append(h('div', 'empty', L('아직 끝난 정책이 없습니다.', 'No finished policies yet.')));
    for (const p of S.history) { const r = h('button', 'pol-hrow'); r.type = 'button'; r.onclick = () => { docId = p.id; view = 'doc'; draw(); }; r.append(h('span', 'k', pair(KIND, p.kind)), h('b', '', p.title), h('em', 'st ' + p.status, pair(END, p.status)), h('small', '', p.closed || '')); hist.append(r); }
    wrap.append(hist);
    const rules = h('div', 'pol-rules');
    rules.textContent = L(`정책마다 목표 2개: 버프를 고르고 난이도(쉬움 +${S.rules.pct[1]}% · 보통 +${S.rules.pct[2]}% · 어려움 +${S.rules.pct[3]}%)를 정하면, 같은 폭의 유지 조건이 무작위로 붙습니다. 늘려야 하는 조건은 첫 ${S.rules.ramp}개월이 달성 기간이고, 그 뒤 ${S.rules.grace}개월 유예가 지나면 그 목표의 효과가 끊기고 불이익(1년)이 붙습니다. 기간은 1~3년 중에서 고르고, 다 채우면 유산(1단계 효과 1년) 또는 연장.`,
      `Each policy has two goals: pick buffs and a difficulty (Easy +${S.rules.pct[1]}% · Normal +${S.rules.pct[2]}% · Hard +${S.rules.pct[3]}%) and a matching upkeep condition is drawn at random. Growth conditions have a ${S.rules.ramp}-month ramp-up; after a ${S.rules.grace}-month grace period a missed goal loses its effect and adds a 1-year penalty. Pick a length of 1–3 years; when it ends, take a legacy (tier-1 effect for a year) or extend.`);
    wrap.append(rules);
    root.append(wrap);
  }
  function slot(kind) {
    const card = h('div', 'pol-card ' + kind), p = S.active.find((x) => x.kind === kind);
    card.append(h('div', 'pol-kind', pair(KIND, kind)));
    if (!p) {
      const cd = S.cooldown && S.cooldown[kind];
      if (cd && cd > S.date) { card.append(h('div', 'empty', L(`정책 붕괴 뒤 국민 신뢰를 회복하는 중입니다(${cd}까지).`, `Public trust is recovering after a failed policy (until ${cd}).`))); return card; }
      const noTarget = kind === 'external' && !S.targets.length;
      card.append(h('div', 'empty', kind === 'internal' ? L('우리 제국 안의 목표(수입·창고·안정도·행성·함대·평화)를 걸고 경제·연구·사회·건설 버프를 받습니다.', 'Stake goals inside the empire (income, stockpiles, stability, planets, fleet, peace) for economy, research, society or construction buffs.') : L('다른 제국 하나를 대상으로 관계·연방·협약·종속국 목표를 걸고 외교·함대·지상군 버프를 받습니다.', 'Target another empire with relation, federation, pact or subject goals for diplomacy, fleet or army buffs.')));
      card.append(btn('act', kind === 'internal' ? L('새 내부 정책', 'New internal policy') : L('새 외부 정책', 'New external policy'), () => startWiz(kind), noTarget || S.busy));
      if (noTarget) card.append(h('small', 'pol-note', L('아직 연락 중인 제국이 없습니다(단말기 연락처가 차면 고를 수 있습니다).', 'No empires in contact yet (they appear once the terminal contact list fills).')));
      return card;
    }
    const head = h('div', 'pol-head'); const t = h('b', 'pol-title', p.title); t.setAttribute('data-i18n-skip', ''); head.append(t);
    if (p.target) { const tg = h('span', 'pol-target', L(`대상: ${p.target.name}`, `Target: ${p.target.name}`)); tg.setAttribute('data-i18n-skip', ''); head.append(tg); }
    const left = Math.ceil((p.daysLeft || 0) / 30);
    head.append(h('small', '', `${p.start} → ${p.end} (${L(`${p.years || 2}년`, `${p.years || 2} yr`)}) · ` + (p.status === 'complete' ? pair(END, 'complete') : L(`남은 ${left}개월`, `${left} months left`)) + (p.shield ? ' · ' + L('기자회견 호평: 다음 불이익 1번 면제', 'Press praise: next penalty waived') : '')));
    card.append(head);
    for (const g of p.goals) card.append(goalRow(p, g));
    const row = h('div', 'pol-btns');
    row.append(btn('pol-sub', L('선언문 보기', 'View declaration'), () => { docId = p.id; view = 'doc'; draw(); }));
    if (p.status === 'complete') {
      row.append(btn('act', L('유산 받기 (1년)', 'Take legacy (1 yr)'), () => run(() => window.sllm.policyFinish(p.id, 'legacy')), S.busy));
      const ys = h('select', 'pol-ysel'); for (const y of S.rules.years) { const o = h('option', '', L(`${y}년`, `${y} yr`)); o.value = String(y); if (y === (p.years || 2)) o.selected = true; ys.append(o); }
      row.append(ys, btn('act', L('연장 (새 조건)', 'Extend (new conditions)'), () => run(() => window.sllm.policyFinish(p.id, 'extend', Number(ys.value))), S.busy));
    } else {
      row.append(btn('pol-danger', L('폐지', 'Repeal'), () => { if (!confirm(L('도중에 폐지하면 남은 목표마다 실패와 같은 불이익이 붙고, 1년 동안 같은 종류 정책을 낼 수 없습니다. 폐지할까요?', 'Repealing applies the failure penalty for each remaining goal and blocks this kind of policy for a year. Repeal?'))) return; run(() => window.sllm.policyRepeal(p.id)); }, S.busy));
    }
    card.append(row);
    return card;
  }
  function goalRow(p, g) {
    const r = h('div', 'pol-goal ' + g.status);
    const top = h('div', 'pol-gtop');
    top.append(h('b', '', `${pair(STATUS, g.status)}${g.status === 'warn' ? ` ${g.miss}/${S.rules.grace}` : ''}`), h('span', 'pol-buff', `${buffLabel(buffOf(g.buff))} ${g.pct}`), h('em', 'pol-diff', pair(DIFF, g.tier)));
    r.append(top);
    const c = h('div', 'pol-cond', condText(g.cond, p.target && p.target.name)); r.append(c);
    const v = g.last, tgt = g.cond.target, base = g.cond.base;
    const bar = h('div', 'pol-bar'), fill = h('i');
    if (g.cond.dir !== 'bool' && typeof v === 'number') { const lo = Math.min(base, tgt, v), hi = Math.max(base, tgt, v), span = hi - lo || 1; fill.style.left = '0'; fill.style.width = Math.max(2, Math.min(100, ((g.cond.dir === 'le' ? hi - v : v - lo) / span) * 100)) + '%'; const mark = h('u'); mark.style.left = Math.max(0, Math.min(100, ((g.cond.dir === 'le' ? hi - tgt : tgt - lo) / span) * 100)) + '%'; bar.append(fill, mark); }
    else { fill.style.width = typeof v === 'number' && v >= 1 ? '100%' : '0%'; bar.append(fill); }
    r.append(bar, h('small', '', L(`시행 때 ${fmt(g.cond, base)} · 지금 ${fmt(g.cond, v)} · 목표 ${fmt(g.cond, tgt)}`, `At start ${fmt(g.cond, base)} · now ${fmt(g.cond, v)} · goal ${fmt(g.cond, tgt)}`)));
    return r;
  }

  // ── 새 정책 마법사 ──
  function startWiz(kind) { wiz = { kind, step: 1, years: S.rules.defaultYears || 2, title: '', body: '', target: S.targets[0] ? S.targets[0].idx : 0, buffs: ['', ''], diffs: [1, 1] }; rec = null; err = ''; view = 'wiz'; window.sllm.policyCancelDraft(); draw(); }
  function drawWiz(root) {
    const w = h('div', 'pol-wiz');
    const steps = h('ol', 'pol-steps'); [[1, '선언문', 'Declaration'], [2, '목표', 'Goals'], [3, '조건 확인', 'Conditions']].forEach(([n, k, e]) => { const li = h('li', wiz.step === n ? 'on' : wiz.step > n ? 'done' : '', L(k, e)); steps.append(li); });
    w.append(h('h4', '', pair(KIND, wiz.kind)), steps);
    if (wiz.step === 1) step1(w); else if (wiz.step === 2) step2(w); else step3(w);
    if (err) w.append(h('div', 'pol-err', err));
    root.append(w);
  }
  function step1(w) {
    if (wiz.kind === 'external') {
      const lab = h('label', 'pol-field'); lab.append(h('span', '', L('대상 제국', 'Target empire')));
      const sel = h('select'); sel.setAttribute('data-i18n-skip', ''); for (const t of S.targets) { const o = h('option', '', t.name); o.value = String(t.idx); if (t.idx === wiz.target) o.selected = true; sel.append(o); }
      sel.onchange = () => { wiz.target = Number(sel.value); }; lab.append(sel); w.append(lab);
    }
    const lt = h('label', 'pol-field'); lt.append(h('span', '', L('정책 제목', 'Policy title')));
    const ti = h('input'); ti.type = 'text'; ti.maxLength = S.rules.titleMax; ti.value = wiz.title; ti.placeholder = L('예: 인류 우선 재확인 칙령', 'e.g. Edict Reaffirming Human Primacy'); ti.oninput = () => { wiz.title = ti.value; }; lt.append(ti); w.append(lt);
    const ly = h('div', 'pol-field'); ly.append(h('span', '', L('정책 기간', 'Policy length')));
    const yr = h('div', 'pol-diffs');
    for (const y of S.rules.years) { const lab = h('label', wiz.years === y ? 'on' : ''); const r = h('input'); r.type = 'radio'; r.name = 'pyears'; r.checked = wiz.years === y; r.onchange = () => { wiz.years = y; draw(); }; lab.append(r, h('span', '', L(`${y}년`, y === 1 ? '1 year' : `${y} years`))); yr.append(lab); }
    ly.append(yr, h('small', 'pol-note', L('길게 잡을수록 버프를 오래 받지만, 조건을 그만큼 오래 지켜야 합니다.', 'A longer policy keeps the buffs longer, but you must hold the conditions just as long.'))); w.append(ly);
    const lb = h('label', 'pol-field'); lb.append(h('span', '', L('선언문 (자유롭게 — 롤플레이)', 'Declaration (free text — roleplay)')));
    const ta = h('textarea'); ta.maxLength = S.rules.bodyMax; ta.rows = 7; ta.value = wiz.body; ta.placeholder = L('국민과 은하에 무엇을, 왜 선포하는지 적으세요. 효과는 다음 단계에서 고른 버프로만 정해집니다.', 'Write what you proclaim to your people and the galaxy, and why. The effects come only from the buffs you pick next.'); ta.oninput = () => { wiz.body = ta.value; }; lb.append(ta); w.append(lb);
    const row = h('div', 'pol-btns');
    row.append(btn('pol-sub', L('취소', 'Cancel'), () => { view = 'main'; wiz = null; err = ''; window.sllm.policyCancelDraft(); draw(); }));
    row.append(btn('act', L('다음', 'Next'), () => { if (!wiz.title.trim() || wiz.body.trim().length < 2) { err = L('제목과 선언문을 입력해 주세요.', 'Enter a title and a declaration.'); draw(); return; } err = ''; wiz.step = 2; draw(); }));
    w.append(row);
  }
  function buffSelect(i) {
    const list = S.buffs[wiz.kind], sel = h('select'); sel.append(Object.assign(h('option', '', L('— 버프 고르기 —', '— Pick a buff —')), { value: '' }));
    const groups = {}; for (const b of list) (groups[b.group] = groups[b.group] || []).push(b);
    const used = new Set([...S.active.flatMap((p) => p.goals.map((g) => g.buff)), ...(S.legacy || []).map((l) => l.buff)]);
    for (const [g, arr] of Object.entries(groups)) {
      const og = document.createElement('optgroup'); og.label = pair(GROUPS, g);
      for (const b of arr) { const o = h('option', '', `${buffLabel(b)}  (${b.t.join(' / ')})`); o.value = b.id; if (used.has(b.id) || (wiz.buffs[1 - i] === b.id)) o.disabled = true; if (wiz.buffs[i] === b.id) o.selected = true; og.append(o); }
      sel.append(og);
    }
    sel.onchange = () => { wiz.buffs[i] = sel.value; draw(); };
    return sel;
  }
  function step2(w) {
    const recRow = h('div', 'pol-rec');
    recRow.append(btn('pol-sub', L('AI 추천 받기 (선언문에 어울리는 버프 3개)', 'Ask AI for 3 buffs that fit the declaration'), async () => {
      err = ''; rec = { busy: true, ids: [], why: '' }; draw();
      try { const r = await window.sllm.policyRecommend(wiz.kind, wiz.title, wiz.body); rec = r && r.ok ? { busy: false, ids: r.ids, why: r.why } : null; if (!r || !r.ok) err = (r && r.error) || L('추천을 받지 못했습니다.', 'Could not get suggestions.'); } catch (e) { rec = null; err = String(e); }
      draw();
    }, rec && rec.busy));
    if (rec && rec.busy) recRow.append(h('small', '', L('보좌관이 선언문을 읽는 중…', 'An aide is reading the declaration…')));
    if (rec && !rec.busy) {
      for (const id of rec.ids) { const b = buffOf(id); if (!b) continue; recRow.append(btn('pol-chip', buffLabel(b), () => { const j = wiz.buffs[0] ? 1 : 0; if (wiz.buffs.includes(id)) return; wiz.buffs[j] = id; draw(); })); }
      if (rec.why) { const wy = h('small', 'pol-why', rec.why); wy.setAttribute('data-i18n-skip', ''); recRow.append(wy); }
    }
    w.append(recRow);
    for (const i of [0, 1]) {
      const box = h('div', 'pol-gpick'); box.append(h('b', '', L(`목표 ${i + 1}`, `Goal ${i + 1}`)), buffSelect(i));
      const ds = h('div', 'pol-diffs'), b = buffOf(wiz.buffs[i]);
      for (const d of [1, 2, 3]) { const lab = h('label', wiz.diffs[i] === d ? 'on' : ''); const r = h('input'); r.type = 'radio'; r.name = 'pdiff' + i; r.checked = wiz.diffs[i] === d; r.onchange = () => { wiz.diffs[i] = d; draw(); }; lab.append(r, h('span', '', `${pair(DIFF, d)} · ${b ? b.t[d - 1] : '+' + S.rules.pct[d] + '%'}`)); ds.append(lab); }
      box.append(ds, h('small', 'pol-note', L(`조건도 같은 폭(+${S.rules.pct[wiz.diffs[i]]}%)으로 시행 때 값보다 높게 붙습니다.`, `The condition is drawn at the same step (+${S.rules.pct[wiz.diffs[i]]}%) above today's value.`)));
      w.append(box);
    }
    const row = h('div', 'pol-btns');
    row.append(btn('pol-sub', L('이전', 'Back'), () => { wiz.step = 1; err = ''; draw(); }));
    row.append(btn('act', S.busy ? L('게임에서 지금 값을 재는 중…', 'Measuring in game…') : L('조건 뽑기', 'Draw conditions'), async () => {
      if (!wiz.buffs[0] || !wiz.buffs[1]) { err = L('버프 2개를 골라 주세요.', 'Pick two buffs.'); draw(); return; }
      err = ''; const r = await window.sllm.policyDraft({ kind: wiz.kind, buffs: wiz.buffs, diffs: wiz.diffs, target: wiz.kind === 'external' ? wiz.target : undefined });
      if (!r || !r.ok) { err = (r && r.error) || L('조건을 뽑지 못했습니다.', 'Could not draw conditions.'); draw(); return; }
      S = await window.sllm.policyState(); wiz.step = 3; draw();
    }, S.busy));
    w.append(row);
  }
  function step3(w) {
    const d = S.draft; if (!d) { wiz.step = 2; return step2(w); }
    const tname = d.target && d.target.name;
    d.conds.forEach((c, i) => {
      const b = buffOf(d.buffs[i]), box = h('div', 'pol-gpick');
      box.append(h('b', '', L(`목표 ${i + 1}`, `Goal ${i + 1}`)), h('div', 'pol-buff', `${buffLabel(b)} ${b ? b.t[d.diffs[i] - 1] : ''} · ${pair(DIFF, d.diffs[i])}`));
      box.append(h('div', 'pol-cond big', condText(c, tname)), h('small', 'pol-note', (c.ramp ? L(`첫 ${S.rules.ramp}개월은 달성 기간(판정 안 함). `, `First ${S.rules.ramp} months are ramp-up (not judged). `) : '') + L(`지금 ${fmt(c, c.base)} → 목표 ${fmt(c, c.target)}`, `Now ${fmt(c, c.base)} → goal ${fmt(c, c.target)}`)));
      box.append(btn('pol-sub', d.rerolled[i] ? L('다시 뽑기 사용함', 'Reroll used') : L('이 조건 다시 뽑기 (1번)', 'Reroll this condition (once)'), async () => { wiz.rv = null; const r = await window.sllm.policyReroll(i); if (!r || !r.ok) err = (r && r.error) || ''; S = await window.sllm.policyState(); draw(); }, d.rerolled[i] || S.busy));
      w.append(box);
    });
    w.append(h('div', 'pol-rules', L(`선포하면 버프 2개가 ${wiz.years}년 동안 걸립니다. 조건을 어기면 ${S.rules.grace}개월 유예 뒤 그 목표의 효과가 끊기고 ${d.kind === 'internal' ? '모든 행성 안정도 −5' : `${tname || '대상 제국'}의 우리 관계 −50`}(1년). 두 목표가 모두 끊기거나 도중에 폐지하면 정책이 무너지고 1년 동안 같은 종류 정책을 낼 수 없습니다.`,
      `Proclaiming applies both buffs for ${wiz.years === 1 ? '1 year' : wiz.years + ' years'}. If a condition is missed, after a ${S.rules.grace}-month grace that goal's effect ends and ${d.kind === 'internal' ? 'all planets get −5 stability' : `${tname || 'the target'}'s opinion of us drops by 50`} (1 year). If both goals fail or you repeal early, the policy collapses and that kind is blocked for a year.`)));
    // 파벌 심사(2026-10-19): 파벌이 생기면 정책은 파벌 표결을 거친다(민주정 = 과반 필요, 제국정 등 = 강행 가능·반대 파벌 승인도 하락, 독재정 = 심사 없음)
    if (!wiz.rv && !wiz.rvLoading) { wiz.rvLoading = true; window.sllm.policyReview().then((r) => { wiz.rv = r || { ok: false }; wiz.rvLoading = false; draw(); }).catch(() => { wiz.rv = { ok: false }; wiz.rvLoading = false; draw(); }); }
    const rv = wiz.rv, rvb = h('div', 'pol-review'); rvb.dataset.i18nSkip = '';
    rvb.append(h('b', '', L('파벌 심사', 'Faction review')));
    if (!rv) rvb.append(h('p', 'pol-note', L('파벌들이 정책을 검토하는 중…', 'The factions are reviewing the policy…')));
    else if (!rv.ok) rvb.append(h('p', 'pol-note', rv.error || L('심사 결과를 읽지 못했습니다.', 'Could not read the review.')));
    else if (!rv.review) rvb.append(h('p', 'pol-note', rv.factionsFormed ? rv.ruleText : L('아직 파벌이 형성되지 않아 심사 없이 통과합니다.', 'No factions have formed yet, so it passes without review.')));
    else {
      rvb.append(h('p', 'pol-note', rv.ruleText));
      const VOTE = { yes: ['찬성', 'Aye'], no: ['반대', 'Nay'], abstain: ['기권', 'Abstain'] };
      const ol = h('ol', 'pol-votes');
      for (const v of rv.review.votes) { const li = h('li', 'v-' + v.vote); li.append(h('span', 'n', `${v.name} · ${Math.round(v.support * 100)}%`), h('b', '', L(VOTE[v.vote][0], VOTE[v.vote][1])), h('small', '', v.why.join(' · '))); ol.append(li); }
      rvb.append(ol);
      const pc = (x) => Math.round(x * 100) + '%';
      rvb.append(h('div', 'pol-tally ' + (rv.review.passed ? 'ok' : 'bad'), L(`찬성 ${pc(rv.review.yes)} · 반대 ${pc(rv.review.no)} · 기권 ${pc(rv.review.abstain)} → ${rv.review.passed ? '가결' : '부결'}`, `Aye ${pc(rv.review.yes)} · Nay ${pc(rv.review.no)} · Abstain ${pc(rv.review.abstain)} → ${rv.review.passed ? 'Passed' : 'Rejected'}`)));
    }
    // 필리버스터(2026-11-03 원내 공방): 통과했어도 반대한 야당 의석이 3분의 1을 넘으면 야당이 막는다 → 기다리기 / 날치기 통과
    const fb = rv && rv.ok && rv.filibuster;
    if (fb) {
      const fbx = h('div', 'pol-ref pol-fili');
      fbx.append(h('b', '', L('필리버스터', 'Filibuster')), h('p', 'pol-note', L(`야당(${fb.by.join(', ')}, ${fb.seats}석)이 필리버스터로 의사 진행을 막고 있습니다.`, `The opposition (${fb.by.join(', ')}, ${fb.seats} seats) is filibustering the bill.`)));
      if (fb.mode === 'wait') fbx.append(h('p', 'pol-note', fb.ready ? L('필리버스터가 끝났습니다. 이제 선포할 수 있습니다.', 'The filibuster is over. You can proclaim now.') : L(`기다리는 중입니다. ${fb.until}부터 선포할 수 있습니다.`, `Waiting it out. You can proclaim from ${fb.until}.`)));
      else if (fb.mode === 'ram') fbx.append(h('p', 'pol-note', L('날치기 통과를 결정했습니다. 선포하면 대가를 치릅니다.', 'You chose to ram it through. Proclaiming will cost you.')));
      else {
        const fr = h('div', 'pol-btns');
        const ans = async (what) => { err = ''; const r = await window.sllm.policyFilibuster(what); if (!r || !r.ok) err = (r && r.error) || L('처리하지 못했습니다.', 'Something went wrong.'); else wiz.rv = r; draw(); };
        fr.append(btn('pol-sub', L(`기다리기 (${Math.round(fb.days / 30)}달 뒤 선포)`, `Wait it out (proclaim in ${Math.round(fb.days / 30)} months)`), () => ans('wait')),
          btn('act danger', L(`날치기 통과 (민심 ${fb.ramMood} · 야당 관계 ${fb.ramRelation})`, `Ram it through (mood ${fb.ramMood} · opposition relations ${fb.ramRelation})`), () => ans('ram')));
        fbx.append(fr);
      }
      rvb.append(fbx);
    }
    w.append(rvb);
    // 국민투표(2026-11-03): 파벌 심사 대신 국민에게 직접 묻는다(2년에 한 번). 권위 정부 = 요식 투표, 단일 의식 = 없음.
    const ref = rv && rv.ok && rv.referendum ? rv.referendum : null, refRes = ref && ref.result;
    if (ref && ref.regime !== 'none') {
      const rb = h('div', 'pol-ref'); rb.dataset.i18nSkip = '';
      rb.append(h('b', '', L('국민투표', 'Referendum')));
      if (refRes) rb.append(h('div', 'pol-tally ' + (refRes.passed ? 'ok' : 'bad'), L(`찬성 ${refRes.yes}% → ${refRes.passed ? '가결' : '부결'}${refRes.sham ? ' (요식 투표)' : ''}`, `${refRes.yes}% yes → ${refRes.passed ? 'Approved' : 'Rejected'}${refRes.sham ? ' (rubber-stamp vote)' : ''}`)));
      else {
        rb.append(h('p', 'pol-note', ref.regime === 'sham' ? L('정부 형태상 국민투표는 형식일 뿐입니다. 늘 통과하지만 민심은 오르지 않고, 외국 언론이 비웃습니다.', 'Under this government a referendum is a formality. It always passes, but public mood does not rise and foreign newspapers mock it.')
          : L('파벌 심사 대신 국민에게 직접 묻습니다. 통과하면 2년 동안 모든 행성 안정도 +5·민심 +3. 부결되면 민주정에서는 선포할 수 없고, 다른 정부는 강행할 수 있지만 안정도 −5(1년)·민심 하락. 2년에 한 번만 열 수 있습니다.', 'Ask the people directly instead of the factions. If it passes, all planets get +5 stability and public mood +3 for two years. If it fails, a democracy cannot proclaim it; other governments may force it through at −5 stability (1 year) and a drop in public mood. Only once every two years.')));
        if (!ref.ready) rb.append(h('p', 'pol-note', L(`다음 국민투표는 ${ref.until}부터 열 수 있습니다.`, `The next referendum can be held from ${ref.until}.`)));
        else rb.append(btn('pol-sub', L('국민투표에 부치기', 'Put to a referendum'), async () => {
          if (!wiz.title || !String(wiz.title).trim()) { err = L('정책 제목을 먼저 적어 주세요.', 'Write the policy title first.'); draw(); return; }
          err = ''; const r = await window.sllm.policyReferendum(wiz.title);
          if (!r || !r.ok) { err = (r && r.error) || L('국민투표를 열지 못했습니다.', 'Could not hold the referendum.'); draw(); return; }
          wiz.rv = r; draw();
        }, S.busy));
      }
      w.append(rb);
    }
    const rejected = refRes ? !refRes.passed : !!(rv && rv.ok && rv.review && !rv.review.passed);
    const row = h('div', 'pol-btns');
    row.append(btn('pol-sub', L('이전', 'Back'), () => { wiz.step = 2; wiz.rv = null; err = ''; window.sllm.policyCancelDraft(); draw(); }));
    const enact = async (force) => {
      err = ''; const r = await window.sllm.policyEnact(wiz.title, wiz.body, wiz.years, force);
      if (!r || !r.ok) { err = (r && r.error) || L('선포하지 못했습니다.', 'Could not proclaim.'); draw(); return; }
      view = 'main'; wiz = null; rec = null; await load();
    };
    if (rejected && rv.rule === 'vote') row.append(btn('act', L('부결 — 선포할 수 없음', 'Rejected — cannot proclaim'), () => {}, true));
    else if (rejected) row.append(btn('act danger', S.busy ? L('선포하는 중…', 'Proclaiming…') : refRes ? L('강행 선포 (국민투표 거역: 안정도 −5)', 'Force through (defying the referendum: −5 stability)') : L('강행 선포 (반대 파벌 승인도 하락)', 'Force through (opposing factions lose approval)'), () => enact(true), S.busy));
    else if (fb && !fb.ready) row.append(btn('act', fb.mode === 'wait' ? L('필리버스터 중', 'Filibuster under way') : L('필리버스터에 먼저 답하세요', 'Answer the filibuster first'), () => {}, true));
    else row.append(btn('act', S.busy ? L('선포하는 중…', 'Proclaiming…') : fb && fb.mode === 'ram' ? L('날치기 선포', 'Ram it through') : L('선포', 'Proclaim'), () => enact(false), S.busy || !rv));
    w.append(row);
    if (rejected && rv.rule === 'vote') w.append(h('p', 'pol-note', L('반대 파벌의 가치관에 맞는 버프·조건으로 정책을 다시 짜 보세요. 파벌 승인도가 오르면 찬성하는 파벌도 늘어납니다.', 'Redesign the policy with buffs and conditions that suit the opposing factions. Factions with higher approval are more likely to vote yes.')));
  }

  // ── 선언문(공문서 모양) ──
  function drawDoc(root) {
    const p = [...S.active, ...S.history].find((x) => x.id === docId); if (!p) { view = 'main'; return drawMain(root); }
    const wrap = h('div', 'pol-docwrap'), paper = h('article', 'pol-paper ' + p.kind);
    paper.append(h('div', 'pol-seal', '✦'), h('small', 'pol-dk', p.kind === 'internal' ? L('제국 칙령', 'IMPERIAL EDICT') : L('대외 정책 선언', 'FOREIGN POLICY DECLARATION')));
    const t = h('h2', '', p.title); t.setAttribute('data-i18n-skip', ''); paper.append(t);
    if (p.target) { const tg = h('div', 'pol-dt', L(`수신: ${p.target.name} 정부`, `To: the Government of ${p.target.name}`)); tg.setAttribute('data-i18n-skip', ''); paper.append(tg); }
    const body = h('p', 'pol-dbody', p.body); body.setAttribute('data-i18n-skip', ''); paper.append(body);
    const goals = h('ul', 'pol-dgoals'); for (const g of p.goals) goals.append(h('li', '', `${buffLabel(buffOf(g.buff))} ${g.pct} — ${condText(g.cond, p.target && p.target.name)}`)); paper.append(goals);
    const sig = h('div', 'pol-sig', `${S.empire || ''} · ${p.start} – ${p.end}`); sig.setAttribute('data-i18n-skip', ''); paper.append(sig);
    paper.append(h('div', 'pol-dstate ' + p.status, pair(END, p.status)));
    wrap.append(paper, btn('pol-sub', L('‹ 정책으로', '‹ Back to policies'), () => { view = 'main'; draw(); }));
    root.append(wrap);
  }

  async function run(fn) { err = ''; try { const r = await fn(); if (r && !r.ok) err = r.error || ''; } catch (e) { err = String(e); } await load(); }

  document.addEventListener('DOMContentLoaded', () => {
    const sec = $('policy'); if (!sec) return;
    new MutationObserver(() => { if (sec.classList.contains('on')) { if (view !== 'wiz') view = 'main'; load(); } }).observe(sec, { attributes: true, attributeFilter: ['class'] });
    if (window.sllm.onPolicyState) window.sllm.onPolicyState((v) => { S = v; draw(); });
    if (window.sllm.onOfficeGo) window.sllm.onOfficeGo((v) => { if (v === 'policy' && typeof window.show === 'function') window.show('policy'); });
    document.addEventListener('sllm-language', draw);
    load();
  });
})();
