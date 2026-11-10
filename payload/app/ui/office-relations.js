// 집무실 인물 카드의 「인간관계」 칸(2026-10-23 초안). 앱: src/features/relations-app.ts(relationsInfo) · 규칙: src/discontent.ts relationCard.
// 플레이어가 알 수 있는 관계만 보인다(통치자와의 관계, 공개된 관계, 소개해서 알게 된 관계). 문구는 L(한, 영)만(언어 팩 호환).
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const css = '.rel{margin:6px 0;padding:7px 9px;border:1px solid color-mix(in srgb,var(--line,#5fd4e4) 45%,transparent);font-size:12px}'
    + '.rel .pt{font-weight:700;letter-spacing:.06em;margin-bottom:4px;opacity:.85}.rel .rw{display:flex;gap:8px}.rel .rw span:first-child{opacity:.7;min-width:84px}'
    + '.rel .rom{margin-top:6px;padding-top:6px;border-top:1px dashed color-mix(in srgb,var(--line,#5fd4e4) 45%,transparent)}.rel .rbtn{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}.rel .rbtn .act{font-size:11.5px;padding:3px 8px}.rel .msg{margin-top:5px;padding:5px 7px;background:color-mix(in srgb,var(--hi,#5fd4e4) 10%,transparent);font-size:12px}'
    + '.rel .exb{display:block;margin-top:6px;background:none;border:1px solid #e0705f66;color:#f3b0a4;font-size:11px;padding:2px 8px;cursor:pointer}'
    + '.rel .arr{display:flex;gap:4px;margin-top:6px;align-items:center}.rel .arr select{flex:1;min-width:0;background:rgba(0,0,0,.25);color:inherit;border:1px solid color-mix(in srgb,var(--line,#5fd4e4) 45%,transparent);font-size:11.5px}.rel .arr .act{font-size:11.5px;padding:3px 8px}.rel .marr{margin-top:5px;padding:5px 7px;border-left:3px solid #e8b860;background:#e8b86012}'
    + '.rel .keep{display:block;margin-top:6px;font-size:11.5px;opacity:.85;cursor:pointer}'
    + '.rel .disc{margin-top:5px;padding:5px 7px;border-left:3px solid #ff8a7a;background:#ff6a5a12}.rel .nt{opacity:.65;font-size:11px;margin-top:3px}'
    + ' .rel .rw.acts{display:flex;gap:6px;flex-wrap:wrap} .rel .story{font-style:italic;margin:2px 0 4px} .med-ov{position:fixed;inset:0;z-index:900;background:#0009;display:flex;align-items:center;justify-content:center} .med{width:min(560px,92vw);max-height:86vh;display:flex;flex-direction:column;background:linear-gradient(170deg,#0f2733f2,#071820f2);border:1px solid var(--line,#2b5a66);border-radius:12px;padding:12px 14px;gap:8px;box-shadow:0 18px 60px #000c;font-size:13px} .med-hd{display:flex;justify-content:space-between;align-items:center} .med-hd b{font-size:14.5px;color:var(--hi,#7fe0c4)} .med-faces{display:flex;gap:6px;align-items:center;flex-wrap:wrap} .med-face{border:1px solid var(--line,#2b5a66);background:#0b1b23;color:var(--text,#dcecf0);border-radius:999px;padding:3px 12px;cursor:pointer} .med-face.to{border-color:var(--hi,#7fe0c4);box-shadow:0 0 0 1px var(--hi,#7fe0c4)} .med-log{flex:1;min-height:160px;max-height:46vh;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding:4px 0} .med-ln{max-width:88%;padding:6px 10px;border-radius:10px;background:#12303b;border:1px solid #1e4552} .med-ln b{display:block;font-size:11.5px;color:var(--hi,#7fe0c4)} .med-ln.me{align-self:flex-end;background:#1d3a2c;border-color:#2c5a44} .med-ln.me b{color:#e8c872;text-align:right} .med-sys{align-self:center;color:var(--dim,#7fa3ad);font-style:italic;font-size:12px} .med-err{color:#e0705f;font-size:12px;min-height:1em} .med-in{display:flex;gap:6px;align-items:flex-end} .med-in textarea{flex:1;resize:none;background:#04121a;color:var(--text,#dcecf0);border:1px solid var(--line,#2b5a66);border-radius:6px;padding:6px 8px;font:inherit}';
  const STAGE = { dating: ['교제 중', 'Dating'], engaged: ['약혼', 'Engaged'], married: ['배우자', 'Spouse'] };
  function style() { if (document.getElementById('relCss')) return; const s = h('style'); s.id = 'relCss'; s.textContent = css; document.head.append(s); }
  function row(box, k, v) { const r = h('div', 'rw'); const b = h('span', '', v); b.setAttribute('data-i18n-skip', ''); r.append(h('span', '', k), b); box.append(r); }
  const RSTAGE = { none: ['지인', 'Acquaintance'], interest: ['서로 관심', 'Mutual interest'], dating: ['교제 중', 'Dating'], engaged: ['약혼', 'Engaged'], married: ['배우자', 'Spouse'], ended: ['지난 인연', 'Former partner'] };
  const act = (text, fn, why) => { const b = h('button', 'act', text); b.type = 'button'; b.style.background = 'none'; if (why) { b.disabled = true; b.title = why; } else b.onclick = fn; return b; };
  /** 통치자와 이 사람의 연애(romance-app). 버튼 결과는 같은 칸에 한 줄로 보이고 다시 그린다. */
  function drawRomance(box, p, ro, msg, reload) {
    if (!ro) return;
    const sec = h('div', 'rom'); sec.append(h('div', 'pt', L('통치자와의 관계', 'With the ruler')));
    const st = h('div', 'rw'); st.append(h('span', '', L(...(RSTAGE[ro.stage] || RSTAGE.none))), h('span', '', ro.affection === null ? L('호감 미확인', 'Affection unknown') : L(`호감 ${ro.affection}/100`, `Affection ${ro.affection}/100`))); sec.append(st);
    if (ro.dates) sec.append(h('div', 'nt', L(`데이트 ${ro.dates}번 · 지난번 ${ro.last.on} ${ro.last.result}`, `${ro.dates} date(s) · last ${ro.last.on}: ${ro.last.result}`)));
    const run = (fn) => async () => { const r = await fn().catch((e) => ({ ok: false, error: String(e) })); reload(r && (r.text || (r.ok ? '' : r.error)) || (r && r.guests ? L(`하객: ${r.guests.join(', ') || '없음'}`, `Guests: ${r.guests.join(', ') || 'none'}`) : '')); };
    const row = h('div', 'rbtn');
    if (ro.stage !== 'married') row.append(act(L('💐 데이트 신청', '💐 Ask on a date'), () => window.sllm.dateOpen(p.key).then((r) => { if (r && !r.ok) reload(r.error); }), ro.canDate ? '' : ro.dateWhy));
    else row.append(act(L('💐 함께 나들이', '💐 Go out together'), () => window.sllm.dateOpen(p.key).then((r) => { if (r && !r.ok) reload(r.error); }), ro.canDate ? '' : ro.dateWhy));
    if (ro.canConfess) row.append(act(L('마음 전하기', 'Confess'), run(() => window.sllm.romanceConfess(p.key)), ro.canConfess.ok ? '' : ro.canConfess.reason));
    if (ro.canPropose) row.append(act(L('💍 청혼', '💍 Propose'), run(() => window.sllm.romancePropose(p.key)), ro.canPropose.ok ? '' : ro.canPropose.reason || L('호감이 90 이상이어야 합니다.', 'Affection must be at least 90.')));
    const w = ro.wedding;
    if (w && w.state === 'engaged') {
      const c = w.cost;
      row.append(act(L(`국가공인 결혼식 준비 (에너지 ${c.state.energy}·식량 ${c.state.food}·광물 ${c.state.minerals})`, `Prepare a state wedding (energy ${c.state.energy}, food ${c.state.food}, minerals ${c.state.minerals})`), run(() => window.sllm.weddingPrepare(p.key, 'state'))));
      row.append(act(L(`비공식 결혼식 준비 (에너지 ${c.informal.energy}·식량 ${c.informal.food}·광물 ${c.informal.minerals})`, `Prepare an informal wedding (energy ${c.informal.energy}, food ${c.informal.food}, minerals ${c.informal.minerals})`), run(() => window.sllm.weddingPrepare(p.key, 'informal'))));
      sec.append(h('div', 'nt', L('준비는 게임 시간 1년입니다. 확정할 때 비용을 내고, 취소·이별 때는 낸 비용의 50%를 돌려받습니다.', 'Preparation takes one game year. You pay when you confirm; on cancellation or breakup, 50% is refunded.')));
    } else if (w && w.state === 'preparing') {
      if (w.due) row.append(act(L('💒 예식 올리기', '💒 Hold the ceremony'), run(() => window.sllm.weddingHold(p.key))));
      else sec.append(h('div', 'nt', L(`${w.scale === 'state' ? '국가공인' : '비공식'} 결혼식 — ${w.scheduledOn} 예정`, `${w.scale === 'state' ? 'State' : 'Informal'} wedding — set for ${w.scheduledOn}`)));
    }
    if (w && (w.state === 'engaged' || w.state === 'preparing')) row.append(act(L('결혼식 취소 (교제는 유지)', 'Call off the wedding (stay together)'), () => { if (window.confirm(L(w.state === 'preparing' ? '결혼식 준비를 접습니까? 낸 비용의 50%를 돌려받고, 교제는 그대로입니다.' : '약혼을 물립니까? 교제는 그대로입니다.', w.state === 'preparing' ? 'Call off the wedding? 50% of what you paid is refunded; you stay together.' : 'Call off the engagement? You stay together.'))) run(() => window.sllm.weddingCancel(p.key))(); }));
    if (ro.canBreakup) row.append(act(L('관계 정리', 'End the relationship'), () => { if (window.confirm(L('정말 관계를 정리합니까? 함께한 기록은 남고, 준비 중인 결혼식은 취소되어 50%를 돌려받습니다.', 'Really end the relationship? Your shared history stays; a wedding in preparation is cancelled with a 50% refund.'))) run(() => window.sllm.romanceBreakup(p.key))(); }));
    sec.append(row); if (!ro.canDate && ro.dateWhy) sec.append(h('div', 'nt', ro.dateWhy)); if (msg) { const m = h('div', 'msg', msg); m.setAttribute('data-i18n-skip', ''); sec.append(m); }
    box.append(sec);
  }
  function draw(box, v, p, ro, msg, reload, kp, fam) {
    box.textContent = ''; box.classList.add('rel');
    const hasRel = v && (v.friends.length || v.rivals.length || v.partner || v.conflicts.length || v.discontent || v.marriage);
    const hasFam = fam && (fam.parents.length || fam.children.length || fam.siblings.length);
    if (!hasRel && !ro && !kp && !hasFam) { box.hidden = true; return; }
    box.hidden = false; style();
    if (hasFam) { // 가족(통치자의 아이, 2026-10-27): 부모·자녀·형제자매(이복 포함). 앱: children-app familyInfo
      box.append(h('div', 'pt', L('가족', 'Family')));
      if (fam.parents.length) row(box, L('부모', 'Parents'), fam.parents.join(', '));
      if (fam.children.length) row(box, L('자녀', 'Children'), fam.children.join(', '));
      if (fam.siblings.length) row(box, L('형제자매', 'Siblings'), fam.siblings.join(', '));
    }
    if (hasRel) {
      box.append(h('div', 'pt', L('인간관계', 'Relationships')));
      if (window.SLLMRelGraph) { const gb = act(L('🕸 관계도', '🕸 Relationship chart'), () => window.SLLMRelGraph.open(p.key)); gb.title = L('이 인물을 가운데 두고 우리 지도자들의 알려진 관계를 그림으로 봅니다.', 'See the known relationships among our leaders, centred on this person.'); box.append(gb); } // 인물 관계도(office-relgraph.js, 2026-11-09)
      if (v.partner) row(box, L(...(STAGE[v.partner.stage] || STAGE.dating)), v.partner.name);
      if (v.friends.length) row(box, L('친구', 'Friends'), v.friends.join(', '));
      if (v.rivals.length) row(box, L('껄끄러운 사이', 'At odds with'), v.rivals.join(', '));
      for (const c of v.conflicts) { // 33·34: 갈등마다 「이유 알아보기」(사연은 한 번만 생성해 저장)·「두 사람 중재하기」
        row(box, L('갈등', 'Conflict'), `${c.with} (${c.since}~)`);
        if (c.story) { const st = h('div', 'nt story', c.story); st.setAttribute('data-i18n-skip', ''); box.append(st); }
        const cr = h('div', 'rw acts');
        if (!c.story && c.id) cr.append(act(L('이유 알아보기', 'Find out why'), async () => { const r = await window.sllm.relConflictStory(c.id).catch((e) => ({ ok: false, error: String(e) })); reload(r.ok ? '' : r.error); }));
        if (c.mediable === 'yes') cr.append(act(L('두 사람 중재하기', 'Mediate between them'), () => openMediation(c.id, reload)));
        else if (c.mediable === 'ruler') cr.append(h('span', 'nt', L('통치자 본인과의 갈등 — 직접 이야기해 푸세요.', 'A conflict with you — talk it out yourself.')));
        if (cr.children.length) box.append(cr);
      }
      if (v.discontent) { const d = h('div', 'disc'); d.append(h('div', '', L(`마음의 짐 — ${v.discontent.since}부터`, `Heavy heart — since ${v.discontent.since}`)), h('div', 'nt', v.discontent.effect + (v.discontent.game === 'applied' ? '' : ' · ' + L('게임 반영 대기', 'waiting for the game')))); box.append(d); }
      if (v.marriage) { const d = h('div', v.marriage.want === 'married' ? 'marr' : 'disc'); d.append(h('div', '', v.marriage.want === 'married' ? L(`결혼함 — ${v.marriage.since}부터`, `Married — since ${v.marriage.since}`) : L(`사별 — ${v.marriage.since} (${v.marriage.partner})`, `Widowed — ${v.marriage.since} (${v.marriage.partner})`)), h('div', 'nt', v.marriage.effect + (v.marriage.game === 'applied' ? '' : ' · ' + L('게임 반영 대기', 'waiting for the game')))); box.append(d); }
      box.append(h('div', 'nt', L('갈등은 사교회에서 당사자끼리 이야기하면 풀리기도 합니다.', 'Conflicts can ease when the two talk at a social gathering.')));
    }
    drawRomance(box, p, ro, msg, reload);
    if (kp && !kp.ruler) { // 은퇴 뒤에도 연락 유지(19): 일반 지도자만 고른다. 통치자는 기본 유지
      const lab = h('label', 'keep'); const cb = h('input'); cb.type = 'checkbox'; cb.checked = !!kp.keep;
      cb.onchange = async () => { await window.sllm.retiredKeep(p.key, cb.checked).catch(() => null); };
      lab.append(cb, h('span', '', L(' 은퇴 뒤에도 연락 유지', ' Keep in touch after retirement'))); lab.title = L('이 인물이 해임·은퇴로 떠나면 집무실 「은퇴 인물」에서 계속 연락할 수 있습니다.', 'If this person is dismissed or retires, you can keep contacting them from the office "Retired".');
      box.append(lab);
      if (v && v.arrange && v.arrange.with.length) { // 만남 주선(2026-10-23): 좋은 교류 한 번의 기회, 교제를 확정하지 않음
        const ar = h('div', 'arr'), sel = h('select'); for (const o of v.arrange.with) { const op = h('option', '', o.name + (o.done ? L(' (올해 주선함)', ' (arranged this year)') : '')); op.value = o.key; op.disabled = o.done; op.setAttribute('data-i18n-skip', ''); sel.append(op); }
        const go = h('button', 'act', L(`만남 주선 (올해 ${v.arrange.left}번 남음)`, `Arrange a meeting (${v.arrange.left} left this year)`)); go.type = 'button'; go.disabled = !v.arrange.left;
        go.title = L('두 사람이 따로 만나 이야기하게 합니다. 사이가 가까워질 기회가 생기지만, 어색하게 끝날 수도 있습니다. 같은 두 사람은 1년에 한 번.', 'Have the two meet privately. It is a chance to grow closer, but it may end awkwardly. Once a year for the same pair.');
        go.onclick = async () => { go.disabled = true; const r = await window.sllm.relArrange(p.key, sel.value).catch((e) => ({ ok: false, error: String(e) })); reload(r.ok ? r.msg : r.error); };
        ar.append(sel, go); box.append(ar);
        if (msg && !ro) { const m = h('div', 'msg', msg); m.setAttribute('data-i18n-skip', ''); box.append(m); }
      }
      if (window.SLLMExecution) { const ex = h('button', 'act exb', L('처형…', 'Execute…')); ex.type = 'button'; ex.title = L('이 지도자를 처형합니다(최종 확인을 거칩니다)', 'Execute this leader (asks for final confirmation)'); window.sllm.execCheck(p.key).then((c) => { if (c && !c.ok) { ex.disabled = true; ex.title = c.why || ''; } }).catch(() => {}); ex.onclick = () => window.SLLMExecution.open({ key: p.key, name: p.name }); box.append(ex); } // 처형(06)
    }
  }
  // 두 사람 중재 창(32·33, 2026-10-24): 집무실 위에 덮는 대화 칸. 얼굴을 누르면 그 사람에게, 아니면 둘 모두에게. 「마치기」 때 합의 여부를 한 번 판정.
  function openMediation(id, reload) {
    document.getElementById('medBox')?.remove();
    const ov = h('div', 'med-ov'); ov.id = 'medBox'; const box = h('div', 'med'); ov.append(box);
    const hd = h('div', 'med-hd'), ttl = h('b', '', L('두 사람 중재', 'Mediation')), x = h('button', 'act', L('마치기', 'Finish')); x.type = 'button'; hd.append(ttl, x);
    const faces = h('div', 'med-faces'), brief = h('div', 'nt'), log = h('div', 'med-log'), err = h('div', 'med-err'), inr = h('div', 'med-in'), ta = h('textarea'), send = h('button', 'act', L('말하기', 'Say')); send.type = 'button';
    ta.rows = 2; ta.placeholder = L('두 사람에게 말을 건네세요… (Enter 전송)', 'Speak to them… (Enter to send)'); inr.append(ta, send); brief.setAttribute('data-i18n-skip', '');
    box.append(hd, faces, brief, log, err, inr); document.body.append(ov);
    let S = null, to = '', busy = false;
    const draw = () => {
      if (!S) return; faces.replaceChildren();
      for (const p of S.parties) { const f = h('button', 'med-face' + (to === p.pid ? ' to' : ''), p.name); f.type = 'button'; f.setAttribute('data-i18n-skip', ''); f.title = L('이 사람에게 말하기', 'Speak to this person'); f.onclick = () => { to = to === p.pid ? '' : p.pid; draw(); ta.focus(); }; faces.append(f); }
      const all = h('span', 'nt', to ? L('→ 한 사람에게', '→ to one person') : L('→ 두 사람 모두에게', '→ to both')); faces.append(all);
      brief.textContent = S.brief || L('두 사람 사이에 무슨 일이 있었는지는 아직 모릅니다. 이야기하며 들어 보세요.', 'You do not yet know what happened between them. Listen as you talk.');
      log.replaceChildren();
      if (!S.lines.length) log.append(h('div', 'med-sys', L('두 사람이 서로 눈을 피한 채 당신 앞에 섰습니다.', 'The two stand before you, avoiding each other\'s eyes.')));
      for (const l of S.lines) { const d = h('div', 'med-ln' + (l.ruler ? ' me' : '')); const nm = h('b', '', l.name), tx = h('span', '', l.text); nm.setAttribute('data-i18n-skip', ''); tx.setAttribute('data-i18n-skip', ''); d.append(nm, tx); log.append(d); }
      if (busy) { const d = h('div', 'med-sys', '…'); log.append(d); }
      log.scrollTop = log.scrollHeight; send.disabled = busy || !!S.busy; x.disabled = busy;
    };
    const say = async () => { const t = ta.value.trim(); if (!t || busy) return; ta.value = ''; busy = true; err.textContent = ''; draw(); const r = await window.sllm.relMediateSay(id, t, to).catch((e) => ({ ok: false, error: String(e) })); busy = false; if (r.ok) S = r.state; else { err.textContent = r.error || ''; ta.value = t; } draw(); ta.focus(); };
    send.onclick = say; ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); say(); } });
    x.onclick = async () => { if (busy) return; busy = true; draw(); const r = await window.sllm.relMediateClose(id).catch((e) => ({ ok: false, error: String(e) })); busy = false; ov.remove(); if (r.ok) reload(r.agreed ? L('두 사람이 갈등을 정리하기로 했습니다. ' + (r.note || ''), 'They agreed to settle it. ' + (r.note || '')) : S && S.lines.length ? L('합의에 이르지 못했습니다. 다음에 다시 시도할 수 있습니다. ' + (r.note || ''), 'No agreement was reached. You can try again later. ' + (r.note || '')) : ''); else reload(r.error || ''); };
    ov.addEventListener('keydown', (e) => { if (e.key === 'Escape') x.click(); });
    window.sllm.relMediateState(id).then((r) => { if (r.ok) { S = r.state; draw(); ta.focus(); } else { err.textContent = r.error || ''; } }).catch((e) => { err.textContent = String(e); });
  }
  function load(box, p, alive, msg) {
    box.hidden = true;
    if (!p || !p.key || !String(p.key).startsWith('p:') || !window.sllm.relationsInfo) return;
    const reload = (m) => load(box, p, alive, m);
    Promise.all([window.sllm.relationsInfo(p.key).catch(() => null), window.sllm.romanceInfo ? window.sllm.romanceInfo(p.key).catch(() => null) : null, window.sllm.retiredKeepState ? window.sllm.retiredKeepState(p.key).catch(() => null) : null, window.sllm.familyInfo ? window.sllm.familyInfo(p.key).catch(() => null) : null]).then(([v, ro, kp, fam]) => { if (alive()) { draw(box, v, p, ro, msg, reload, kp, fam); } });
  }
  window.SLLMRelations = { load, draw };
})();
