// 처형 대화 상자(2026-10-23 초안). 앱: src/features/execution-app.ts · 규칙: src/execution-case.ts. 인물 카드(office-relations.js)의 「처형…」에서 연다.
// 1 사유·설명·공개 방식 → 2 최종 확인(이름·사유·근거 상태·방식·되돌릴 수 없음, 확인 체크) → 3 게임 결과와 아는 인물의 반응.
// 사유는 혐의 분류일 뿐 입증이 아니다(근거가 없으면 「플레이어 주장」). 문구는 L(한, 영)만(언어 팩 호환). 인물 이름·설명은 data-i18n-skip.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const skip = (e) => { e.setAttribute('data-i18n-skip', ''); return e; };
  const REASONS = [['treason', '반역·반란 가담', 'Treason or rebellion'], ['corruption', '부패·직권남용', 'Corruption or abuse of power'], ['responsibility', '군사·행정적 책임', 'Military or administrative failure'], ['other', '기타 — 직접 작성', 'Other — write it yourself']];
  const css = '#exBox{position:fixed;inset:0;z-index:9999;background:#000b;display:flex;align-items:center;justify-content:center}#exBox .card{width:min(560px,92vw);max-height:88vh;overflow:auto;background:#0d1a20;border:1px solid #b0504a;border-radius:8px;padding:16px 18px;color:var(--text,#dcecf0);font-size:13px}'
    + '#exBox h4{margin:0 0 8px;color:#f0a090}#exBox label{display:block;margin:3px 0;cursor:pointer}#exBox textarea{box-sizing:border-box;width:100%;min-height:60px;background:#0006;color:inherit;border:1px solid #5fd4e455;border-radius:4px;padding:6px 8px;font:inherit}#exBox .sec{margin:10px 0 4px;font-size:11.5px;letter-spacing:.06em;color:var(--dim,#7fa3ad)}'
    + '#exBox .note{color:var(--dim,#7fa3ad);font-size:12px;line-height:1.5}#exBox .conf{white-space:pre-wrap;border:1px solid #b0504a88;background:#b0504a14;padding:10px;border-radius:4px;line-height:1.6}#exBox .row{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}'
    + '#exBox button{border:1px solid #5fd4e477;background:#5fd4e414;color:inherit;border-radius:4px;padding:6px 14px;cursor:pointer}#exBox button.red{border-color:#e0705f;background:#e0705f22;color:#ffc8be}#exBox button:disabled{opacity:.4;cursor:default}#exBox .err{color:#ffc8be}#exBox li{margin:2px 0}';
  function modal() { if (!document.getElementById('exCss')) { const s = h('style'); s.id = 'exCss'; s.textContent = css; document.head.append(s); } document.getElementById('exBox')?.remove(); const box = h('div'); box.id = 'exBox'; const card = h('div', 'card'); box.append(card); document.body.append(box); box.onclick = (e) => { if (e.target === box) close(); }; return card; }
  let curId = '';
  function close() { if (curId) { window.sllm.execCancel(curId); curId = ''; } document.getElementById('exBox')?.remove(); }
  async function past(card) {
    let st = null; try { st = await window.sllm.execState(); } catch (e) { /* 무시 */ } if (!st || !st.cases.length) return;
    card.append(h('div', 'sec', L('지난 처형 기록', 'Past executions')));
    for (const c of st.cases) { const d = h('div', 'note'); d.append(skip(h('b', '', c.target)), h('span', '', ` · ${c.reason} · ${c.publicity === 'public' ? L('공개', 'public') : L('비공개', 'private')} · ${c.state === 'applied' ? c.on : c.state === 'outcome_unknown' ? L('결과 미확인', 'outcome unknown') : L('실행 안 됨', 'not carried out')}`)); card.append(d);
      if (c.reactions.length) { const ul = h('ul', 'note'); for (const r of c.reactions.slice(0, 8)) ul.append(skip(h('li', '', `${r.name} — ${r.stance}${r.emotion ? ' (' + r.emotion + ')' : ''}`))); card.append(ul); } }
  }
  function step1(p) {
    const card = modal(); curId = '';
    card.append(skip(h('h4', '', L(`처형 준비 — ${p.name}`, `Prepare an execution — ${p.name}`))));
    card.append(h('div', 'sec', L('사유', 'Reason')));
    for (const [id, k, e] of REASONS) { const lb = h('label'); const r = h('input'); r.type = 'radio'; r.name = 'exr'; r.value = id; if (id === 'treason') r.checked = true; lb.append(r, document.createTextNode(' ' + L(k, e))); card.append(lb); }
    const ta = skip(h('textarea')); ta.placeholder = L('설명(기타는 필수)', 'Details (required for Other)'); card.append(ta);
    card.append(h('p', 'note', L('사유는 혐의의 분류일 뿐 입증된 사실이 아닙니다. 지금은 연결된 근거 기록이 없어 「플레이어 주장」으로 남습니다.', 'The reason is a classification of the charge, not proof. No supporting record is linked, so it stays on file as your claim.')));
    card.append(h('div', 'sec', L('방식', 'Method')));
    for (const [id, k, e, dk, de] of [['public', '공개 처형', 'Public', '사유를 공식 발표하고, 우리 지도자들이 알게 되어 반응합니다.', 'The reason is announced; your leaders learn of it and react.'], ['private', '비공개 처형', 'Private', '발표하지 않습니다. 다른 지도자들은 사망 소식만 듣고 진상은 모릅니다.', 'No announcement; other leaders only hear of the death, not the truth.']]) { const lb = h('label'); const r = h('input'); r.type = 'radio'; r.name = 'exp'; r.value = id; if (id === 'private') r.checked = true; lb.append(r, document.createTextNode(` ${L(k, e)} — `), h('span', 'note', L(dk, de))); card.append(lb); }
    const err = h('p', 'err'); card.append(err);
    const row = h('div', 'row'), no = h('button', '', L('그만두기', 'Never mind')), go = h('button', 'red', L('다음 — 최종 확인', 'Next — final confirmation'));
    no.type = go.type = 'button'; no.onclick = close;
    go.onclick = async () => { go.disabled = true; const r = await window.sllm.execPrepare({ key: p.key, reason: card.querySelector('input[name=exr]:checked').value, note: ta.value, publicity: card.querySelector('input[name=exp]:checked').value }).catch((e) => ({ ok: false, error: String(e) })); go.disabled = false; if (!r.ok) { err.textContent = r.error || ''; return; } step2(p, r); };
    row.append(no, go); card.append(row); past(card);
  }
  function step2(p, r) {
    const card = modal(); curId = r.id;
    card.append(h('h4', '', L('최종 확인', 'Final confirmation')), skip(h('div', 'conf', r.confirm)));
    const lb = h('label'), cb = h('input'); cb.type = 'checkbox'; lb.append(cb, document.createTextNode(' ' + L('되돌릴 수 없다는 것을 이해했습니다', 'I understand this cannot be undone'))); card.append(lb);
    const err = h('p', 'err'); card.append(err);
    const row = h('div', 'row'), no = h('button', '', L('취소', 'Cancel')), go = h('button', 'red', L('처형 실행', 'Carry out the execution'));
    no.type = go.type = 'button'; go.disabled = true; cb.onchange = () => { go.disabled = !cb.checked; }; no.onclick = close;
    go.onclick = async () => { go.disabled = no.disabled = true; err.textContent = L('게임에 요청하는 중…', 'Sending to the game…'); const x = await window.sllm.execRun(r.id).catch((e) => ({ ok: false, error: String(e) })); curId = ''; if (!x.ok) { err.textContent = x.error || ''; no.disabled = false; return; } step3(p, x); };
    row.append(no, go); card.append(row);
  }
  function step3(p, x) {
    const card = modal();
    const msg = x.status === 'applied' ? L(`${p.name}이(가) 처형되었습니다.`, `${p.name} has been executed.`) : x.status === 'rejected' ? L('게임에서 대상을 찾지 못해 실행되지 않았습니다.', 'The game could not find the target; nothing was done.') : L('게임 결과를 확인하지 못했습니다. 사망 소식이 오면 처형으로 확정합니다(다시 보내지 않습니다).', 'The game result is unconfirmed. If news of the death arrives it will be recorded as the execution (it will not be resent).');
    card.append(skip(h('h4', '', msg)));
    if (x.status === 'applied') { const c = (x.state.cases || [])[0]; if (c && c.reactions.length) { card.append(h('div', 'sec', L('알게 된 지도자들의 입장', 'Stances of leaders who know'))); const ul = h('ul', 'note'); for (const r of c.reactions) ul.append(skip(h('li', '', `${r.name} — ${r.stance}${r.emotion ? ' (' + r.emotion + ')' : ''}`))); card.append(ul); } else card.append(h('p', 'note', L('공식 발표가 없어 진상을 아는 지도자가 없습니다. 다른 지도자들은 사망 소식만 들었습니다.', 'There was no announcement, so no leader knows the truth; the others only heard of the death.'))); }
    card.append(h('p', 'note', L('반발한 인물도 이것만으로 반란·사임하지는 않습니다. 그들과 통신하면 이 일을 기억하고 있습니다.', 'Those who oppose it will not rebel or resign from this alone, but they remember it when you speak with them.')));
    const row = h('div', 'row'), ok = h('button', '', L('닫기', 'Close')); ok.type = 'button'; ok.onclick = close; row.append(ok); card.append(row);
  }
  window.SLLMExecution = { open: (p) => step1(p) };
})();
